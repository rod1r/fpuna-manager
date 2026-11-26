import type { Exam, ExamDate, Subject } from "../types/catalog";

export function normalizeExamText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseExamDateText(value: string, defaultYear = new Date().getFullYear()): string | undefined {
  const cleaned = normalizeExamText(value)
    .trim()
    .replace(/^(?:lun(?:es)?|mar(?:tes)?|mie(?:rcoles)?|jue(?:ves)?|vie(?:rnes)?|sab(?:ado)?|dom(?:ingo)?)[.,]?\s+/, "");
  const iso = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const match = iso ?? cleaned.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/);
  if (!match) return undefined;
  const year = iso ? Number(match[1]) : match[3] ? Number(match[3]) : defaultYear;
  const month = iso ? Number(match[2]) : Number(match[2]);
  const day = iso ? Number(match[3]) : Number(match[1]);
  const fullYear = year < 100 ? 2000 + year : year;
  const date = new Date(Date.UTC(fullYear, month - 1, day));
  if (date.getUTCFullYear() !== fullYear || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return `${String(fullYear).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function createExamId(exam: Pick<Exam, "materia" | "seccion" | "tipo" | "fecha" | "horaInicio" | "aula" | "sede" | "carrera" | "turno">): string {
  const identity = [
    exam.materia,
    exam.seccion,
    exam.tipo,
    exam.fecha,
    exam.horaInicio,
    exam.aula,
    exam.sede ?? "",
    exam.carrera ?? "",
    exam.turno ?? "",
  ].map(normalizeExamText).join("|");
  let hash = 2166136261;
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `exam-${(hash >>> 0).toString(36)}`;
}

export function legacyExamToExam(subject: Subject, examDate: ExamDate, index = 0): Exam | undefined {
  const fecha = parseExamDateText(examDate.date);
  if (!fecha) return undefined;
  const time = examDate.time?.match(/\d{1,2}[:.]\d{2}/)?.[0].replace(".", ":") ?? "";
  const exam: Exam = {
    id: "",
    materia: subject.name,
    seccion: subject.section ?? "",
    tipo: examDate.type || "Examen",
    fecha,
    horaInicio: time,
    horaFin: "",
    aula: "",
    observaciones: "",
    origen: "excel",
    subjectId: subject.id,
    sede: subject.campus,
    carrera: subject.career,
    turno: subject.shift,
  };
  exam.id = `${createExamId(exam)}-${index}`;
  return exam;
}

export function getExamTimestamp(exam: Exam): number {
  const [year, month, day] = exam.fecha.split("-").map(Number);
  const time = exam.horaInicio.match(/^(\d{1,2}):(\d{2})$/);
  return new Date(year, month - 1, day, time ? Number(time[1]) : 0, time ? Number(time[2]) : 0).getTime();
}
