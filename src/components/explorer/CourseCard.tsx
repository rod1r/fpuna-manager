import { AlertTriangle, BookPlus, Check, FlaskConical } from "lucide-react";
import type { Subject } from "../../types/catalog";

export function CourseCard({
  subject,
  conflict,
  enrolled,
  onAdd,
}: {
  subject: Subject;
  conflict: boolean;
  enrolled: boolean;
  onAdd: () => void;
}) {
  return (
    <article className={`course-card ${conflict ? "course-conflict" : ""}`}>
      <div className="course-topline">
        <div>
          <div className="course-meta">{subject.career} · {subject.shift}{subject.section ? ` · Sección ${subject.section}` : ""}</div>
          <h3>{subject.name}</h3>
        </div>
        <button className={`add-button ${enrolled ? "added" : ""}`} onClick={onAdd} disabled={enrolled} aria-label={enrolled ? "Materia agregada" : "Agregar materia"}>
          {enrolled ? <Check size={18} /> : <BookPlus size={18} />}
          <span>{enrolled ? "Agregada" : "Agregar"}</span>
        </button>
      </div>
      {subject.teacher && <div className="course-details"><span>Profesor: {subject.teacher}</span></div>}
      <div className="badges">
        {subject.onlyFinal && <span className="badge badge-special">Solo derecho a examen Final</span>}
        {subject.hasLab && <span className="badge badge-lab"><FlaskConical size={13} /> Ver horario de prácticas de laboratorio</span>}
        {conflict && <span className="badge badge-conflict"><AlertTriangle size={13} /> Choque con tu horario</span>}
      </div>
    </article>
  );
}
