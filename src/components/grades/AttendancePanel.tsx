import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { absencesRemaining, attendancePercentage, attendancePermission, estimateClassCount } from "../../domain/attendance";
import type { EnrolledSubject } from "../../types/academic";

export function AttendancePanel({ item, onChange }: { item: EnrolledSubject; onChange: (patch: Partial<EnrolledSubject["attendance"]>) => void }) {
  const [mode, setMode] = useState<"counter" | "manual">(item.attendance.manualPercentage === undefined ? "counter" : "manual");
  const daysPerWeek = new Set(item.subject.schedule.map(({ day }) => day)).size;
  const total = estimateClassCount(daysPerWeek, item.attendance.weeksSemester);
  const percentage = mode === "manual" && item.attendance.manualPercentage !== undefined
    ? item.attendance.manualPercentage
    : attendancePercentage(total, item.attendance.absences);
  const permission = attendancePermission(percentage);
  const maximumFor = (threshold: number) => absencesRemaining(total, item.attendance.absences, threshold);
  const status = total <= 0 && item.attendance.manualPercentage === undefined
    ? "No hay días de clase para estimar asistencia"
    : permission === "first-and-second"
      ? "Habilitado para 1er Final y 2do Final"
      : permission === "second-only"
        ? "Habilitado únicamente para 2do Final"
        : "Sin derecho a examen final";
  const estimatedAbsences = useMemo(() => {
    if (total <= 0) return 0;
    let best = 0;
    let distance = Number.POSITIVE_INFINITY;
    for (let absences = 0; absences <= total; absences += 1) {
      const current = Math.abs(attendancePercentage(total, absences) - percentage);
      if (current < distance) { distance = current; best = absences; }
    }
    return best;
  }, [total, percentage]);

  const changeMode = (next: "counter" | "manual") => {
    setMode(next);
    if (next === "counter") {
      onChange({ absences: estimatedAbsences, manualPercentage: undefined });
    } else {
      onChange({ manualPercentage: attendancePercentage(total, item.attendance.absences) });
    }
  };
  const setManualPercentage = (value: number) => {
    const bounded = Math.max(0, Math.min(100, value));
    let best = 0;
    let distance = Number.POSITIVE_INFINITY;
    for (let absences = 0; absences <= total; absences += 1) {
      const current = Math.abs(attendancePercentage(total, absences) - bounded);
      if (current < distance) { best = absences; distance = current; }
    }
    onChange({ manualPercentage: bounded, absences: best });
  };

  return (
    <section className="academic-panel">
      <div className="panel-title-row"><div><h3>Asistencia</h3><p>{total} clases estimadas · {daysPerWeek} días por semana</p></div><div className="attendance-percent tabular-nums">{percentage}%</div></div>
      <label className="compact-label">Semanas del semestre
        <input type="number" min="1" max="30" value={item.attendance.weeksSemester} onChange={(event) => onChange({ weeksSemester: Math.max(1, Number(event.target.value) || 1) })} />
      </label>
      <div className="mode-tabs"><button className={mode === "counter" ? "active" : ""} onClick={() => changeMode("counter")}>Contar ausencias</button><button className={mode === "manual" ? "active" : ""} onClick={() => changeMode("manual")}>Porcentaje oficial</button></div>
      {mode === "counter" ? (
        <div className="absence-counter">
          <button aria-label="Restar una ausencia" onClick={() => onChange({ absences: Math.max(0, item.attendance.absences - 1), manualPercentage: undefined })}><Minus size={17} /></button>
          <strong className="tabular-nums">{item.attendance.absences}<small>ausencias</small></strong>
          <button aria-label="Sumar una ausencia" onClick={() => onChange({ absences: Math.min(total, item.attendance.absences + 1), manualPercentage: undefined })}><Plus size={17} /></button>
        </div>
      ) : (
        <label className="compact-label">Porcentaje consultado en el sistema oficial
          <input className="manual-percentage" type="number" min="0" max="100" value={item.attendance.manualPercentage ?? percentage} onChange={(event) => setManualPercentage(Number(event.target.value) || 0)} />
        </label>
      )}
      <div className={`attendance-status ${total <= 0 && item.attendance.manualPercentage === undefined ? "status-neutral" : permission === "none" ? "status-danger" : permission === "second-only" ? "status-warning" : "status-good"}`}>{status}</div>
      {total > 0 && <div className="absence-thresholds">
        <span>Antes de bajar del 70%: <strong>{maximumFor(70)} ausencias más</strong></span>
        <span>Antes de bajar del 50%: <strong>{maximumFor(50)} ausencias más</strong></span>
      </div>}
    </section>
  );
}
