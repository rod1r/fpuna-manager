import type { AttendancePermission } from "../types/academic";

export function estimateClassCount(daysPerWeek: number, weeksSemester = 16): number {
  return Math.max(0, Math.floor(daysPerWeek)) * Math.max(0, Math.floor(weeksSemester));
}

export function attendancePercentage(totalClasses: number, absences: number): number {
  if (totalClasses <= 0) return 0;
  return Math.max(0, Math.min(100, Math.ceil(((totalClasses - absences) / totalClasses) * 100)));
}

export function attendancePermission(percentage: number): AttendancePermission {
  if (percentage >= 70) return "first-and-second";
  if (percentage >= 50) return "second-only";
  return "none";
}

export function maximumAbsencesBeforeThreshold(totalClasses: number, threshold: number): number {
  if (totalClasses <= 0) return 0;
  let absences = 0;
  while (absences <= totalClasses && attendancePercentage(totalClasses, absences) >= threshold) absences += 1;
  return Math.max(0, absences - 1);
}

export function absencesRemaining(totalClasses: number, absences: number, threshold: number): number {
  return Math.max(0, maximumAbsencesBeforeThreshold(totalClasses, threshold) - absences);
}
