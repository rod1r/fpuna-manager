import type { Subject } from "./catalog";

export interface GradeInputs {
  p1?: number;
  p2?: number;
  tps: Array<number | undefined>;
  weightParciales: number;
  weightTPs: number;
  recoveryEnabled: boolean;
  recoveryScore?: number;
  recoveryTarget: "p1" | "p2" | "lowest";
  finalExam?: number;
}

export interface AttendanceInputs {
  absences: number;
  weeksSemester: number;
  manualPercentage?: number;
}

export interface EnrolledSubject {
  subject: Subject;
  grades: GradeInputs;
  attendance: AttendanceInputs;
}

export type AttendancePermission = "first-and-second" | "second-only" | "none";

export interface GradeResult {
  pep?: number;
  rp?: number;
  grade: 1 | 2 | 3 | 4 | 5;
  label: string;
  eligible: boolean;
}
