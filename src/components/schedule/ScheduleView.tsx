import { useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { downloadSchedulePng } from "../../services/pngExporter";
import { useAcademicStore } from "../../store/useAcademicStore";
import { hasScheduleConflict } from "../../domain/schedule";
import { WeeklyGrid } from "./WeeklyGrid";
import { ExamTimeline } from "./ExamTimeline";

export function ScheduleView() {
  const { enrolled, removeSubject } = useAcademicStore();
  const [tab, setTab] = useState<"week" | "exams">("week");
  const subjects = enrolled.map(({ subject }) => subject);
  const conflictSubjects = subjects.filter((subject) => hasScheduleConflict(subject, subjects.filter(({ id }) => id !== subject.id)));
  const conflictIds = new Set(conflictSubjects.map(({ id }) => id));
  const exportImage = () => {
    try { downloadSchedulePng(subjects); }
    catch (error) { window.alert(error instanceof Error ? error.message : "No se pudo exportar la imagen."); }
  };

  return (
    <section className="view">
      <div className="view-heading">
        <div><p className="eyebrow">ORGANIZACIÓN SEMANAL</p><h1>Mi Horario</h1></div>
        <button className="primary-button" aria-label="Descargar Horario (PNG)" onClick={exportImage}><Download size={17} /> Descargar Horario (PNG)</button>
      </div>
      <div className="schedule-summary"><strong>{subjects.length}</strong><span>materias agregadas</span>{conflictSubjects.length > 0 && <span className="conflict-summary">{conflictSubjects.length} con posible choque</span>}</div>
      {conflictSubjects.length > 0 && <div className="notice danger">Revisa las materias marcadas: hay intervalos horarios superpuestos.</div>}
      <div className="segmented-control"><button className={tab === "week" ? "selected" : ""} onClick={() => setTab("week")}>Semana</button><button className={tab === "exams" ? "selected" : ""} onClick={() => setTab("exams")}>Exámenes</button></div>
      <div className="surface">{tab === "week" ? <WeeklyGrid subjects={subjects} conflictIds={conflictIds} /> : <ExamTimeline />}</div>
      {enrolled.length > 0 && <div className="enrolled-list"><h2>Materias en tu horario</h2>{enrolled.map(({ subject }) => <div className="enrolled-row" key={subject.id}><span>{subject.name}<small>{subject.career} · {subject.shift}</small></span><button className="icon-button compact danger-icon" aria-label={`Quitar ${subject.name}`} onClick={() => removeSubject(subject.id)}><Trash2 size={17} /></button></div>)}</div>}
    </section>
  );
}
