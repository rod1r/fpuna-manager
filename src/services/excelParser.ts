import * as XLSX from "xlsx";
import { createExamId, normalizeExamText, parseExamDateText } from "../domain/exams";
import { asDay } from "../domain/schedule";
import type { Campus, Day, Exam, ExamDate, Subject } from "../types/catalog";

type CellValue = unknown;
type SheetRows = CellValue[][];

export interface ExcelSheetDiagnostic {
  sheet: string;
  message: string;
  detectedColumns: string[];
}

export interface ExcelImportResult {
  subjects: Subject[];
  exams: Exam[];
  sheetsScanned: number;
  sheetsParsed: string[];
  diagnostics: ExcelSheetDiagnostic[];
}

interface HeaderRow {
  index: number;
  labels: string[];
}

interface ExamContext {
  type: string;
  label: string;
  row: number;
}

const SAN_LORENZO_SHEETS = ["IAE", "ICM", "IEK", "IEL", "IEN", "IIN", "IMK", "ISP", "LCA", "LCI", "LCIk", "LEL", "LGH"];
const BRANCH_SHEETS = ["Cnel. Oviedo", "Villarrica"];
const clean = (value: CellValue) => value instanceof Date ? value.toISOString() : String(value ?? "").trim();
const normalize = normalizeExamText;
const subjectName = (value: CellValue) => clean(value).replace(/\(\*\*?\)/g, "").replace(/\s+/g, " ").trim();

function normalizeCareer(value: CellValue): string {
  const career = clean(value);
  return career.toUpperCase() === "LCIK" ? "LCIk" : career;
}

function normalizeCampus(value: CellValue): Campus {
  const text = normalize(clean(value));
  if (text.includes("oviedo")) return "Cnel. Oviedo";
  if (text.includes("villarrica")) return "Villarrica";
  return "San Lorenzo";
}

function valueAt(row: SheetRows[number] | undefined, index: number | undefined): CellValue {
  return row && index !== undefined ? row[index] : "";
}

function worksheetRows(sheet: XLSX.WorkSheet): SheetRows {
  const rows = XLSX.utils.sheet_to_json<CellValue[]>(sheet, { header: 1, defval: "", raw: true });
  for (const merge of sheet["!merges"] ?? []) {
    const source = rows[merge.s.r]?.[merge.s.c];
    if (source === undefined || source === "") continue;
    for (let rowIndex = merge.s.r; rowIndex <= merge.e.r; rowIndex += 1) {
      rows[rowIndex] ??= [];
      for (let columnIndex = merge.s.c; columnIndex <= merge.e.c; columnIndex += 1) {
        if (rows[rowIndex][columnIndex] === undefined || rows[rowIndex][columnIndex] === "") {
          rows[rowIndex][columnIndex] = source;
        }
      }
    }
  }
  return rows;
}

function findHeader(rows: SheetRows): HeaderRow | undefined {
  let best: { header: HeaderRow; score: number } | undefined;
  rows.forEach((row, index) => {
    const labels = row.map((value) => normalize(clean(value)));
    const hasSubject = labels.some((value) => /^(asignatura|materia|nombre de asignatura|nombre de materia)$/.test(value));
    const hasExamOrScheduleData = labels.some((value) =>
      /\b(dia|fecha|hora|horario|lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/.test(value) ||
      /(parcial|final|examen|revision|recuperatorio)/.test(value),
    );
    if (!hasSubject || !hasExamOrScheduleData) return;
    const uniqueLabels = [...new Set(labels.filter(Boolean))];
    const identityFields = uniqueLabels.filter((value) => /^(turno|seccion|sigla carrera|carrera|sede|grupo)$/.test(value)).length;
    const score = identityFields * 4 + uniqueLabels.length;
    if (!best || score > best.score || (score === best.score && index > best.header.index)) {
      best = { header: { index, labels: row.map((value) => clean(value)) }, score };
    }
  });
  return best?.header;
}

function findColumn(headers: string[], ...names: string[]): number | undefined {
  const normalized = headers.map(normalize);
  const exact = normalized.findIndex((header) => names.some((name) => header === normalize(name)));
  if (exact >= 0) return exact;
  const partial = normalized.findIndex((header) => names.some((name) => header.includes(normalize(name))));
  return partial < 0 ? undefined : partial;
}

function findExactColumn(headers: string[], ...names: string[]): number | undefined {
  const wanted = names.map(normalize);
  const index = headers.findIndex((header) => wanted.includes(normalize(header)));
  return index < 0 ? undefined : index;
}

function parseSemester(row: SheetRows[number], headers: string[]): number {
  const semesterColumn = findColumn(headers, "Sem/Grupo", "Semestre/Grupo", "Sem Grupo");
  const levelColumn = findExactColumn(headers, "Nivel");
  const semesterValue = clean(valueAt(row, semesterColumn));
  const source = semesterValue && semesterValue !== "---" ? semesterValue : clean(valueAt(row, levelColumn));
  const match = source.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function examType(label: string): string | undefined {
  const value = normalize(label).replace(/[.°º]/g, " ");
  if (!value) return undefined;
  const first = /\b(1er|primer|primera|primero)\b/.test(value) || /evaluacion\s+primera/.test(value);
  const second = /\b(2do|segundo|segunda)\b/.test(value) || /evaluacion\s+segunda/.test(value);
  const revision = /\b(revision|revisiones)\b/.test(value);
  if (revision) return first ? "Revisión 1er Final" : second ? "Revisión 2do Final" : "Revisión";
  if (/recuperatorio|recuperacion/.test(value)) return "Recuperatorio";
  if (/final/.test(value)) return first ? "1er Final" : second ? "2do Final" : "Final";
  if (/parcial|evaluacion|etapa/.test(value)) return first ? "1er Parcial" : second ? "2do Parcial" : "Parcial";
  return undefined;
}

function eventContext(rows: SheetRows, headerIndex: number, column: number): ExamContext | undefined {
  for (let row = headerIndex; row >= Math.max(0, headerIndex - 5); row -= 1) {
    const label = clean(rows[row]?.[column]);
    let type = examType(label);
    if (type) {
      if (type === "Revisión") {
        for (let previous = column - 1; previous >= Math.max(0, column - 8); previous -= 1) {
          const previousLabel = clean(rows[row]?.[previous]);
          const previousType = examType(previousLabel);
          if (previousType === "Revisión") continue;
          if (previousType === "1er Final" || previousType === "2do Final" || previousType === "Final") {
            type = `Revisión ${previousType}`;
          }
          break;
        }
      }
      return { type, label: normalize(label), row };
    }
  }
  return undefined;
}

function detectWorkbookYear(rows: SheetRows): number {
  const title = rows.slice(0, 10).flat().map(clean).join(" ");
  const matches = [...title.matchAll(/\b(20\d{2})\b/g)];
  return matches.length ? Number(matches.at(-1)?.[1]) : new Date().getFullYear();
}

function parseExcelDate(value: CellValue, defaultYear: number, date1904 = false): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
  }
  if (typeof value === "number") {
    if (value < (date1904 ? 0 : 1)) return undefined;
    const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
    const date = new Date(epoch + Math.floor(value) * 86_400_000);
    if (date.getUTCFullYear() < 1900 || date.getUTCFullYear() > 2200) return undefined;
    return `${String(date.getUTCFullYear()).padStart(4, "0")}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  }
  const text = clean(value);
  const dateText = text.match(/\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?/);
  return dateText ? parseExamDateText(dateText[0], defaultYear) : undefined;
}

function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseTime(value: CellValue): { start: string; end: string } | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { start: formatTime(value.getUTCHours(), value.getUTCMinutes()), end: "" };
  }
  if (typeof value === "number") {
    if (value < 0 || value >= 1) return undefined;
    const minutes = Math.round(value * 24 * 60) % (24 * 60);
    return { start: formatTime(Math.floor(minutes / 60), minutes % 60), end: "" };
  }
  const matches = [...clean(value).matchAll(/(\d{1,2})[:.](\d{2})/g)];
  if (!matches.length || matches.slice(0, 2).some((match) => Number(match[1]) > 23 || Number(match[2]) > 59)) return undefined;
  const start = formatTime(Number(matches[0][1]), Number(matches[0][2]));
  const end = matches[1] ? formatTime(Number(matches[1][1]), Number(matches[1][2])) : "";
  return { start, end };
}

function stableSubjectId(campus: Campus, career: string, name: string, section: string, shift: string): string {
  const key = [campus, career, name, section, shift].map(normalize).join("|");
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `subject-${(hash >>> 0).toString(36)}`;
}

function makeTeacherMap(workbook: XLSX.WorkBook): Map<string, string> {
  const map = new Map<string, string>();
  const sheetName = workbook.SheetNames.find((name) => normalize(name) === "docentes");
  if (!sheetName) return map;
  const rows = worksheetRows(workbook.Sheets[sheetName]);
  const header = rows.findIndex((row) => {
    const labels = row.map((value) => normalize(clean(value)));
    return labels.some((value) => value === "sede") && labels.some((value) => value === "asignatura") &&
      labels.some((value) => value === "turno") && labels.some((value) => value === "docente");
  });
  if (header < 0) return map;
  const labels = rows[header].map(clean);
  const campusCol = findExactColumn(labels, "Sede");
  const careerCol = findColumn(labels, "Carrera", "Sigla carrera");
  const subjectCol = findExactColumn(labels, "Asignatura", "Materia");
  const shiftCol = findExactColumn(labels, "Turno");
  const teacherCol = findColumn(labels, "Docente", "Profesor");
  if ([campusCol, careerCol, subjectCol, shiftCol, teacherCol].some((column) => column === undefined)) return map;
  rows.slice(header + 1).forEach((row) => {
    const teacher = clean(valueAt(row, teacherCol));
    const key = teacherKey(valueAt(row, campusCol), valueAt(row, careerCol), valueAt(row, subjectCol), valueAt(row, shiftCol));
    if (!teacher || !key) return;
    const current = map.get(key);
    if (!current) map.set(key, teacher);
    else if (!current.split(" / ").includes(teacher)) map.set(key, `${current} / ${teacher}`);
  });
  return map;
}

function teacherKey(campus: CellValue, career: CellValue, subject: CellValue, shift: CellValue): string {
  return [normalizeCampus(campus), normalizeCareer(career), subjectName(subject), clean(shift)].map((value) => normalize(String(value))).join("|");
}

function parseSchedule(row: SheetRows[number], headers: string[]): Subject["schedule"] {
  const schedule: Subject["schedule"] = [];
  headers.forEach((header, index) => {
    const day = asDay(header);
    if (!day) return;
    const time = clean(valueAt(row, index));
    if (!/\d{1,2}[:.]\d{2}/.test(time)) return;
    const previousIsRoom = normalize(headers[index - 1] ?? "") === "aula";
    const nextIsRoom = normalize(headers[index + 1] ?? "") === "aula";
    const room = previousIsRoom ? clean(valueAt(row, index - 1)) : nextIsRoom ? clean(valueAt(row, index + 1)) : "";
    schedule.push({ day, time, ...(room ? { room } : {}) });
  });
  return schedule;
}

function legacyDate(exam: Exam): ExamDate {
  const [, year, month, day] = exam.fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? [];
  const date = year ? `${day}/${month}/${year}` : exam.fecha;
  return { type: exam.tipo, date, ...(exam.horaInicio ? { time: exam.horaInicio } : {}) };
}

function parseExamsForRow(
  rows: SheetRows,
  header: HeaderRow,
  row: SheetRows[number],
  defaultYear: number,
  date1904: boolean,
  subject: Pick<Subject, "id" | "name" | "section" | "campus" | "career" | "shift">,
): Exam[] {
  const contexts = header.labels.map((_, column) => eventContext(rows, header.index, column));
  const candidates: Array<{ column: number; context: ExamContext; date: string }> = [];
  header.labels.forEach((label, column) => {
    const context = contexts[column];
    if (!context) return;
    const normalizedLabel = normalize(label);
    const hasDateLabel = /\b(dia|fecha)\b/.test(normalizedLabel);
    const isTimeOrRoom = /\b(hora|horario|aula|salon|sala)\b/.test(normalizedLabel);
    if (!hasDateLabel && isTimeOrRoom) return;
    const date = parseExcelDate(valueAt(row, column), defaultYear, date1904);
    if (date) candidates.push({ column, context, date });
  });

  return candidates.map(({ column, context, date }) => {
    const relatedColumns = contexts
      .map((candidate, index) => ({ candidate, index, label: normalize(header.labels[index]) }))
      .filter(({ candidate }) => candidate?.row === context.row && candidate.label === context.label && candidate.type === context.type);
    const timeColumns = relatedColumns
      .filter(({ label }) => /\b(hora|horario)\b/.test(label))
      .sort((a, b) => Math.abs(a.index - column) - Math.abs(b.index - column));
    let time = { start: "", end: "" };
    for (const timeColumn of timeColumns) {
      const parsed = parseTime(valueAt(row, timeColumn.index));
      if (parsed) { time = parsed; break; }
    }
    const rowValues = relatedColumns.map(({ index, label }) => ({ index, label, value: clean(valueAt(row, index)) }));
    const roomColumns = rowValues
      .filter(({ label, index, value }) =>
        /\b(aula|salon|sala)\b/.test(label) ||
        (index !== column && value !== "" && !parseExcelDate(value, defaultYear, date1904) && !parseTime(value)),
      )
      .sort((a, b) => Math.abs(a.index - column) - Math.abs(b.index - column));
    const room = roomColumns.find(({ label, value }) => /\b(aula|salon|sala)\b/.test(label) && value)?.value
      ?? roomColumns.find(({ value }) => /^[A-Za-z]{1,5}[- ]?\d{1,4}[A-Za-z]?$/.test(value))?.value
      ?? "";
    const exam: Exam = {
      id: "",
      materia: subject.name,
      seccion: subject.section ?? "",
      tipo: context.type,
      fecha: date,
      horaInicio: time.start,
      horaFin: time.end,
      aula: room,
      observaciones: "",
      origen: "excel",
      subjectId: subject.id,
      sede: subject.campus,
      carrera: subject.career,
      turno: subject.shift,
    };
    exam.id = createExamId(exam);
    return exam;
  });
}

function headerCandidateColumns(rows: SheetRows, headerIndex: number): string[] {
  return rows[headerIndex].map(clean).filter(Boolean);
}

export function parseExcelWorkbook(data: ArrayBuffer): ExcelImportResult {
  const workbook = XLSX.read(data, { type: "array", cellDates: false, cellNF: true });
  const teachers = makeTeacherMap(workbook);
  const subjects: Subject[] = [];
  const exams = new Map<string, Exam>();
  const sheetsParsed: string[] = [];
  const diagnostics: ExcelSheetDiagnostic[] = [];
  let relevantSheets = 0;
  const date1904 = Boolean(workbook.Workbook?.WBProps?.date1904);

  for (const sheetName of workbook.SheetNames) {
    if (normalize(sheetName) === "docentes") continue;
    const rows = worksheetRows(workbook.Sheets[sheetName]);
    const header = findHeader(rows);
    if (!header) {
      const relevant = rows.some((row) =>
        row.some((value) => /asignatura|materia/i.test(clean(value))) &&
        row.some((value) => /dia|fecha|hora|horario|lunes|martes|miercoles|jueves|viernes|sabado|parcial|final|examen|revision|recuperatorio/i.test(clean(value))),
      );
      if (relevant) {
        diagnostics.push({
          sheet: sheetName,
          message: "Se encontraron materias, pero no una fila de encabezados que también identifique fechas, horarios o días.",
          detectedColumns: [],
        });
      }
      continue;
    }
    relevantSheets += 1;
    const headers = header.labels;
    const subjectCol = findColumn(headers, "Asignatura", "Materia");
    if (subjectCol === undefined) {
      diagnostics.push({ sheet: sheetName, message: "No se pudo identificar la columna de asignatura o materia.", detectedColumns: headerCandidateColumns(rows, header.index) });
      continue;
    }
    const careerCol = findColumn(headers, "Sigla carrera", "Carrera");
    const campusCol = findExactColumn(headers, "Sede");
    const sectionCol = findExactColumn(headers, "Sección", "Seccion", "Grupo");
    const shiftCol = findExactColumn(headers, "Turno");
    const emphasisCol = findExactColumn(headers, "Énfasis", "Enfasis");
    const teacherCol = findColumn(headers, "Docente", "Profesor");
    const titleCol = findExactColumn(headers, "Tít", "Título", "Titulo");
    const surnameCol = findExactColumn(headers, "Apellido");
    const givenNameCol = findExactColumn(headers, "Nombre");
    const saturdayDateCol = findColumn(headers, "Fechas de clases de sábados (Turno Noche)");
    const workbookYear = detectWorkbookYear(rows);
    const sheetSubjects: Subject[] = [];
    const eventHeaderLabels = [...new Set(rows
      .slice(Math.max(0, header.index - 5), header.index + 1)
      .flat()
      .map((value) => clean(value))
      .filter((value) => /(parcial|final|examen|revision|recuperatorio)/i.test(value)))];
    const unknownEventLabels = eventHeaderLabels.filter((label) => !examType(label));
    if (unknownEventLabels.length) {
      diagnostics.push({
        sheet: sheetName,
        message: `Se detectaron tipos de evaluación no reconocidos: ${unknownEventLabels.join(", ")}.`,
        detectedColumns: headerCandidateColumns(rows, header.index),
      });
    }
    let rowIndex = header.index + 1;

    for (; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const rawName = clean(valueAt(row, subjectCol));
      if (!rawName || normalize(rawName) === "asignatura" || normalize(rawName) === "materia") continue;
      const name = subjectName(rawName);
      if (!name) continue;
      const actualCampus = campusCol === undefined
        ? normalizeCampus(sheetName)
        : normalizeCampus(valueAt(row, campusCol) || sheetName);
      const career = normalizeCareer(valueAt(row, careerCol));
      const section = clean(valueAt(row, sectionCol));
      const shift = clean(valueAt(row, shiftCol));
      const id = stableSubjectId(actualCampus, career, name, section, shift);
      const directTeacher = teacherCol !== undefined
        ? clean(valueAt(row, teacherCol))
        : [clean(valueAt(row, titleCol)), clean(valueAt(row, givenNameCol)), clean(valueAt(row, surnameCol))].filter(Boolean).join(" ");
      const subject: Subject = {
        id,
        campus: actualCampus,
        career,
        emphasis: clean(valueAt(row, emphasisCol)) || undefined,
        semester: parseSemester(row, headers),
        name,
        section: section || undefined,
        shift,
        teacher: teachers.get(teacherKey(actualCampus, career, name, shift)) || directTeacher || undefined,
        schedule: /\(\*\)/.test(rawName) ? [] : parseSchedule(row, headers),
        exams: [],
        onlyFinal: rawName.includes("(*)"),
        hasLab: rawName.includes("(**)"),
        saturdayNightDates: clean(valueAt(row, saturdayDateCol)) || undefined,
      };
      const rowExams = parseExamsForRow(rows, header, row, workbookYear, date1904, subject);
      subject.exams = rowExams.map(legacyDate);
      const existing = sheetSubjects.findIndex((candidate) => candidate.id === id);
      if (existing < 0) sheetSubjects.push(subject);
      else sheetSubjects[existing] = { ...sheetSubjects[existing], ...subject, exams: [...sheetSubjects[existing].exams, ...subject.exams] };
      for (const exam of rowExams) exams.set(exam.id, exam);
    }
    if (sheetSubjects.length) {
      sheetsParsed.push(sheetName);
      subjects.push(...sheetSubjects);
    } else {
      diagnostics.push({
        sheet: sheetName,
        message: "Se reconocieron los encabezados, pero no se encontraron filas de materias con datos.",
        detectedColumns: headerCandidateColumns(rows, header.index),
      });
    }
  }

  if (relevantSheets === 0 && !diagnostics.length) {
    diagnostics.push({
      sheet: "Libro",
      message: workbook.SheetNames.length
        ? "No se identificaron hojas con columnas de asignatura y fechas u horarios."
        : "El archivo no contiene hojas de cálculo.",
      detectedColumns: workbook.SheetNames,
    });
  }
  if (!subjects.length && !diagnostics.length) {
    diagnostics.push({ sheet: "Libro", message: "No se encontraron materias en las hojas analizadas.", detectedColumns: workbook.SheetNames });
  }

  return { subjects, exams: [...exams.values()], sheetsScanned: workbook.SheetNames.length, sheetsParsed, diagnostics };
}

export async function parseExcelFile(file: File): Promise<ExcelImportResult> {
  return parseExcelWorkbook(await file.arrayBuffer());
}

export const EXCEL_SHEET_RULES = {
  sanLorenzo: SAN_LORENZO_SHEETS,
  branches: BRANCH_SHEETS,
  days: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"] as Day[],
};
