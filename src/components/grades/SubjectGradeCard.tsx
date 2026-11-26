import { useAcademicStore } from "../../store/useAcademicStore";
import type { EnrolledSubject } from "../../types/academic";
import { AttendancePanel } from "./AttendancePanel";

export function SubjectGradeCard({ item }: { item: EnrolledSubject }) {
  const updateAttendance = useAcademicStore((state) => state.updateAttendance);
  return (
    <details className="grade-card" open>
      <summary><span><strong>{item.subject.name}</strong><small>{item.subject.career} · {item.subject.shift}</small></span><span className="grade-section">{item.subject.section ? `Sección ${item.subject.section}` : item.subject.campus}</span></summary>
      <div className="grade-card-content">
        {item.subject.onlyFinal && <div className="notice">Solo derecho a examen Final. Esta materia no genera bloques semanales.</div>}
        {item.subject.hasLab && <div className="notice">Ver horario de prácticas de laboratorio.</div>}
        <AttendancePanel item={item} onChange={(patch) => updateAttendance(item.subject.id, patch)} />
      </div>
    </details>
  );
}
