import type { ClassBlock, Day, Subject } from "../types/catalog";

export interface TimeInterval {
  start: number;
  end: number;
}

export function parseTimeRange(value: string): TimeInterval | undefined {
  const matches = [...value.matchAll(/(\d{1,2})[:.](\d{2})/g)];
  if (matches.length < 2) return undefined;
  if (matches.slice(0, 2).some((match) => Number(match[1]) > 24 || Number(match[2]) > 59)) return undefined;
  const toMinutes = (match: RegExpMatchArray) => Number(match[1]) * 60 + Number(match[2]);
  const start = toMinutes(matches[0]);
  const end = toMinutes(matches[1]);
  if (start < 0 || start >= 24 * 60 || end <= start || end > 24 * 60) return undefined;
  return { start, end };
}

export function intervalsOverlap(a: TimeInterval, b: TimeInterval): boolean {
  return a.start < b.end && b.start < a.end;
}

export function blocksOverlap(a: ClassBlock, b: ClassBlock): boolean {
  if (a.day !== b.day) return false;
  const first = parseTimeRange(a.time);
  const second = parseTimeRange(b.time);
  return first !== undefined && second !== undefined && intervalsOverlap(first, second);
}

export function hasScheduleConflict(subject: Subject, enrolled: Subject[]): boolean {
  if (subject.onlyFinal) return false;
  return enrolled.some((existing) => !existing.onlyFinal && existing.schedule.some((a) => subject.schedule.some((b) => blocksOverlap(a, b))));
}

export function formatMinutes(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function asDay(value: string): Day | undefined {
  const normalized = value.toLocaleLowerCase("es").normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const map: Record<string, Day> = {
    lunes: "Lunes",
    martes: "Martes",
    miercoles: "Miércoles",
    jueves: "Jueves",
    viernes: "Viernes",
    sabado: "Sábado",
  };
  return map[normalized];
}
