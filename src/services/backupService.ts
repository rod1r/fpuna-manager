import type { EnrolledSubject, GradeInputs } from "../types/academic";
import { legacyExamToExam } from "../domain/exams";
import type { Exam, Subject } from "../types/catalog";

interface BackupPayload {
  version: 3;
  catalog: Subject[];
  enrolled: EnrolledSubject[];
  exams: Exam[];
  calculatorGrades?: GradeInputs;
}

export function downloadBackup(catalog: Subject[], enrolled: EnrolledSubject[], exams: Exam[] = [], calculatorGrades?: GradeInputs): void {
  const payload: BackupPayload = { version: 3, catalog, enrolled, exams, calculatorGrades };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "fpuna-manager-respaldo.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function readBackup(file: File): Promise<BackupPayload> {
  const parsed: unknown = JSON.parse(await file.text());
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("version" in parsed) ||
    (parsed.version !== 1 && parsed.version !== 2 && parsed.version !== 3) ||
    !("catalog" in parsed) ||
    !Array.isArray(parsed.catalog) ||
    !("enrolled" in parsed) ||
    !Array.isArray(parsed.enrolled)
  ) {
    throw new Error("El archivo de respaldo no tiene un formato válido.");
  }
  const data = parsed as { version: 1 | 2 | 3; catalog: Subject[]; enrolled: EnrolledSubject[]; exams?: Exam[]; calculatorGrades?: GradeInputs };
  const legacySubjects = data.version === 1 || !Array.isArray(data.exams)
    ? [...data.catalog, ...data.enrolled.map(({ subject }) => subject)]
    : [];
  const legacyExams = legacySubjects.flatMap((subject) =>
    Array.isArray(subject.exams)
      ? subject.exams.flatMap((exam, index) => {
          const migrated = legacyExamToExam(subject, exam, index);
          return migrated ? [migrated] : [];
        })
      : [],
  );
  const exams = new Map<string, Exam>();
  for (const exam of [...legacyExams, ...(Array.isArray(data.exams) ? data.exams : [])]) exams.set(exam.id, exam);
  return { version: 3, catalog: data.catalog, enrolled: data.enrolled, exams: [...exams.values()], calculatorGrades: data.calculatorGrades };
}
