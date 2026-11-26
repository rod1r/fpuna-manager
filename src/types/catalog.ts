export const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"] as const;
export type Day = (typeof DAYS)[number];
export type Campus = "San Lorenzo" | "Cnel. Oviedo" | "Villarrica";

export interface ClassBlock {
  day: Day;
  time: string;
  room?: string;
}

export interface ExamDate {
  type: string;
  date: string;
  time?: string;
}

export interface Exam {
  id: string;
  materia: string;
  seccion: string;
  tipo: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  aula: string;
  observaciones: string;
  origen?: "excel" | "manual";
  subjectId?: string;
  sede?: Campus;
  carrera?: string;
  turno?: string;
}

export interface Subject {
  id: string;
  campus: Campus;
  career: string;
  emphasis?: string;
  semester: number;
  name: string;
  section?: string;
  shift: string;
  teacher?: string;
  schedule: ClassBlock[];
  exams: ExamDate[];
  onlyFinal: boolean;
  hasLab: boolean;
  saturdayNightDates?: string;
}
