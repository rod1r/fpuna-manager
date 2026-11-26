import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AttendanceInputs, EnrolledSubject, GradeInputs } from "../types/academic";
import { createExamId, legacyExamToExam } from "../domain/exams";
import type { Exam, Subject } from "../types/catalog";
import { sampleCatalog } from "../data/sampleCatalog";

interface AcademicState {
  catalog: Subject[];
  enrolled: EnrolledSubject[];
  exams: Exam[];
  calculatorGrades: GradeInputs;
  setCatalog: (subjects: Subject[]) => void;
  importPlan: (subjects: Subject[], exams: Exam[]) => void;
  addSubject: (subject: Subject) => void;
  removeSubject: (id: string) => void;
  updateGrades: (id: string, patch: Partial<GradeInputs>) => void;
  updateCalculatorGrades: (patch: Partial<GradeInputs>) => void;
  updateAttendance: (id: string, patch: Partial<AttendanceInputs>) => void;
  addExam: (exam: Exam) => void;
  updateExam: (id: string, patch: Partial<Exam>) => void;
  deleteExam: (id: string) => void;
  replaceState: (catalog: Subject[], enrolled: EnrolledSubject[], exams?: Exam[], calculatorGrades?: GradeInputs) => void;
}

function initialGrades(): GradeInputs {
  return {
    tps: [undefined, undefined, undefined, undefined],
    weightParciales: 50,
    weightTPs: 50,
    recoveryEnabled: false,
    recoveryTarget: "lowest",
  };
}

function validScore(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100 ? value : undefined;
}

function validWeight(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100 ? value : undefined;
}

function normalizeCalculatorGrades(value: unknown): GradeInputs {
  const data = typeof value === "object" && value !== null ? value as Partial<GradeInputs> : {};
  const weightParciales = validWeight(data.weightParciales) ?? 50;
  const weightTPs = validWeight(data.weightTPs) ?? 100 - weightParciales;
  const recoveryTarget = data.recoveryTarget === "p1" || data.recoveryTarget === "p2" || data.recoveryTarget === "lowest"
    ? data.recoveryTarget
    : "lowest";
  return {
    p1: validScore(data.p1),
    p2: validScore(data.p2),
    tps: Array.from({ length: 4 }, (_, index) => validScore(Array.isArray(data.tps) ? data.tps[index] : undefined)),
    weightParciales,
    weightTPs,
    recoveryEnabled: data.recoveryEnabled === true,
    recoveryScore: validScore(data.recoveryScore),
    recoveryTarget,
    finalExam: validScore(data.finalExam),
  };
}

function uniqueExams(exams: Exam[]): Exam[] {
  const byId = new Map<string, Exam>();
  for (const exam of exams) {
    const id = exam.id || createExamId(exam);
    byId.set(id, { ...exam, id });
  }
  return [...byId.values()];
}

function migratePersistedState(persisted: unknown): Pick<AcademicState, "catalog" | "enrolled" | "exams" | "calculatorGrades"> {
  const data = (typeof persisted === "object" && persisted !== null ? persisted : {}) as {
    catalog?: Subject[];
    enrolled?: EnrolledSubject[];
    exams?: Exam[];
    calculatorGrades?: GradeInputs;
  };
  const catalog = Array.isArray(data.catalog) ? data.catalog : sampleCatalog;
  const enrolled = Array.isArray(data.enrolled) ? data.enrolled : [];
  const legacySubjects = Array.isArray(data.exams) ? [] : [...catalog, ...enrolled.map(({ subject }) => subject)];
  const legacyExams = legacySubjects.flatMap((subject) => Array.isArray(subject.exams)
    ? subject.exams.flatMap((exam, index) => {
        const migrated = legacyExamToExam(subject, exam, index);
        return migrated ? [migrated] : [];
      })
    : []);
  return {
    catalog,
    enrolled,
    exams: uniqueExams([...legacyExams, ...(Array.isArray(data.exams) ? data.exams : [])]),
    calculatorGrades: normalizeCalculatorGrades(data.calculatorGrades),
  };
}

export const useAcademicStore = create<AcademicState>()(
  persist(
    (set, get) => ({
      catalog: sampleCatalog,
      enrolled: [],
      exams: [],
      calculatorGrades: initialGrades(),
      setCatalog: (catalog) => set({ catalog }),
      importPlan: (catalog, importedExams) =>
        set((state) => ({
          catalog: catalog.length ? catalog : state.catalog,
          exams: uniqueExams([...state.exams.filter(({ origen }) => origen !== "excel"), ...importedExams]),
        })),
      addSubject: (subject) =>
        set((state) => {
          if (state.enrolled.some(({ subject: current }) => current.id === subject.id)) return state;
          return {
            enrolled: [
              ...state.enrolled,
              {
                subject,
                grades: initialGrades(),
                attendance: { absences: 0, weeksSemester: 16 },
              },
            ],
          };
        }),
      removeSubject: (id) => set((state) => ({ enrolled: state.enrolled.filter(({ subject }) => subject.id !== id) })),
      updateGrades: (id, patch) =>
        set((state) => ({
          enrolled: state.enrolled.map((item) =>
            item.subject.id === id ? { ...item, grades: { ...item.grades, ...patch } } : item,
          ),
        })),
      updateCalculatorGrades: (patch) =>
        set((state) => ({ calculatorGrades: { ...state.calculatorGrades, ...patch } })),
      updateAttendance: (id, patch) =>
        set((state) => ({
          enrolled: state.enrolled.map((item) =>
            item.subject.id === id ? { ...item, attendance: { ...item.attendance, ...patch } } : item,
          ),
        })),
      addExam: (exam) => set((state) => ({ exams: uniqueExams([...state.exams, { ...exam, origen: exam.origen ?? "manual" }]) })),
      updateExam: (id, patch) =>
        set((state) => ({
          exams: state.exams.map((exam) => exam.id === id ? { ...exam, ...patch, id } : exam),
        })),
      deleteExam: (id) => set((state) => ({ exams: state.exams.filter((exam) => exam.id !== id) })),
      replaceState: (catalog, enrolled, exams, calculatorGrades) => {
        const migrated = migratePersistedState({ catalog, enrolled, exams, calculatorGrades: calculatorGrades ?? get().calculatorGrades });
        set(migrated);
      },
    }),
    {
      name: "fpuna-manager-state",
      version: 3,
      migrate: (persisted) => migratePersistedState(persisted),
    },
  ),
);
