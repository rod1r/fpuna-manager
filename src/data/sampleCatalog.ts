import type { Subject } from "../types/catalog";

export const sampleCatalog: Subject[] = [
  {
    id: "sample-iae-1",
    campus: "San Lorenzo",
    career: "IAE",
    semester: 1,
    name: "Asignatura de ejemplo",
    section: "1",
    shift: "Mañana",
    schedule: [{ day: "Lunes", time: "08:00 - 10:00", room: "Aula de ejemplo" }],
    exams: [],
    onlyFinal: false,
    hasLab: false,
  },
];
