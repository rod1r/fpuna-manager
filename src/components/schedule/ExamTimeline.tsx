import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CalendarClock, CalendarPlus, Pencil, Trash2, X } from "lucide-react";
import { createExamId, getExamTimestamp, normalizeExamText } from "../../domain/exams";
import { useAcademicStore } from "../../store/useAcademicStore";
import type { Exam, Subject } from "../../types/catalog";

type ExamForm = Pick<Exam, "materia" | "seccion" | "tipo" | "fecha" | "horaInicio" | "horaFin" | "aula" | "observaciones">;

function emptyForm(): ExamForm {
  return {
    materia: "",
    seccion: "",
    tipo: "1er Parcial",
    fecha: localDateInputValue(new Date()),
    horaInicio: "",
    horaFin: "",
    aula: "",
    observaciones: "",
  };
}

function localDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function examDay(exam: Exam): Date {
  const [year, month, day] = exam.fecha.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function examHasFinished(exam: Exam, now: Date): boolean {
  const day = examDay(exam);
  if (exam.horaFin) {
    const [hour, minute] = exam.horaFin.split(":").map(Number);
    day.setHours(hour, minute, 0, 0);
  } else {
    day.setHours(23, 59, 59, 999);
  }
  return day.getTime() < now.getTime();
}

function remainingLabel(exam: Exam, now: Date): string {
  if (examHasFinished(exam, now)) return "Finalizado";
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = examDay(exam);
  const days = Math.round((day.getTime() - today.getTime()) / 86_400_000);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Mañana";
  return `En ${days} días`;
}

function formattedDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("es-PY", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })
    .format(new Date(year, month - 1, day));
}

function examBelongsToSubject(exam: Exam, subject: Subject): boolean {
  if (exam.subjectId) return exam.subjectId === subject.id;
  return normalizeExamText(exam.materia) === normalizeExamText(subject.name) &&
    (!exam.seccion || normalizeExamText(exam.seccion) === normalizeExamText(subject.section ?? "")) &&
    (!exam.sede || normalizeExamText(exam.sede) === normalizeExamText(subject.campus)) &&
    (!exam.carrera || normalizeExamText(exam.carrera) === normalizeExamText(subject.career)) &&
    (!exam.turno || normalizeExamText(exam.turno) === normalizeExamText(subject.shift));
}

function badgeVariant(type: string): string {
  const normalized = normalizeExamText(type);
  if (normalized.includes("revision")) return "exam-badge-review";
  if (normalized.includes("final")) return "exam-badge-final";
  if (normalized.includes("recuperatorio")) return "exam-badge-recovery";
  if (normalized.includes("parcial")) return "exam-badge-partial";
  return "exam-badge-default";
}

function ExamEditor({
  initial,
  materiaOptions,
  onClose,
  onSave,
}: {
  initial: ExamForm;
  materiaOptions: string[];
  onClose: () => void;
  onSave: (form: ExamForm) => void;
}) {
  const [form, setForm] = useState(initial);
  const update = (patch: Partial<ExamForm>) => setForm((current) => ({ ...current, ...patch }));
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave({ ...form, materia: form.materia.trim(), seccion: form.seccion.trim(), observaciones: form.observaciones.trim() });
  };

  return (
    <div className="exam-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="exam-editor" role="dialog" aria-modal="true" aria-labelledby="exam-editor-title" onSubmit={submit}>
        <div className="exam-editor-heading">
          <div><p className="eyebrow">AGENDA DE EVALUACIONES</p><h2 id="exam-editor-title">{initial.materia ? "Editar examen" : "Agregar examen"}</h2></div>
          <button type="button" className="icon-button compact editor-close" aria-label="Cerrar formulario" onClick={onClose}><X size={18} /></button>
        </div>
        <label>Materia
          <input required list="exam-materia-options" value={form.materia} onChange={(event) => update({ materia: event.target.value })} placeholder="Nombre de la materia" />
          <datalist id="exam-materia-options">{materiaOptions.map((name) => <option key={name} value={name} />)}</datalist>
        </label>
        <div className="exam-editor-grid">
          <label>Sección<input value={form.seccion} onChange={(event) => update({ seccion: event.target.value })} /></label>
          <label>Tipo
            <input required list="exam-type-options" value={form.tipo} onChange={(event) => update({ tipo: event.target.value })} />
            <datalist id="exam-type-options">{["1er Parcial", "2do Parcial", "1er Final", "2do Final", "Final", "Recuperatorio", "Revisión"].map((type) => <option key={type} value={type} />)}</datalist>
          </label>
          <label>Fecha<input required type="date" value={form.fecha} onChange={(event) => update({ fecha: event.target.value })} /></label>
          <label>Hora de inicio<input type="time" value={form.horaInicio} onChange={(event) => update({ horaInicio: event.target.value })} /></label>
          <label>Hora de fin<input type="time" value={form.horaFin} onChange={(event) => update({ horaFin: event.target.value })} /></label>
          <label>Aula<input value={form.aula} onChange={(event) => update({ aula: event.target.value })} /></label>
        </div>
        <label>Observaciones<textarea rows={3} value={form.observaciones} onChange={(event) => update({ observaciones: event.target.value })} /></label>
        <div className="exam-editor-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-button">Guardar examen</button></div>
      </form>
    </div>
  );
}

export function ExamTimeline() {
  const { exams, enrolled, addExam, updateExam, deleteExam } = useAcademicStore();
  const [subjectFilter, setSubjectFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [editing, setEditing] = useState<Exam>();
  const [adding, setAdding] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [upcomingLimit, setUpcomingLimit] = useState(40);
  const [pastLimit, setPastLimit] = useState(40);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const enrolledExams = useMemo(
    () => exams.filter((exam) => enrolled.some(({ subject }) => examBelongsToSubject(exam, subject))),
    [exams, enrolled],
  );
  const subjectOptions = useMemo(
    () => [...new Set(enrolled.map(({ subject }) => subject.name))].filter(Boolean).sort(),
    [enrolled],
  );
  const typeOptions = useMemo(() => [...new Set(enrolledExams.map(({ tipo }) => tipo))].sort(), [enrolledExams]);
  const visible = useMemo(() => enrolledExams
    .filter((exam) =>
      (!subjectFilter || normalizeExamText(exam.materia) === normalizeExamText(subjectFilter)) &&
      (!typeFilter || exam.tipo === typeFilter),
    )
    .sort((a, b) => getExamTimestamp(a) - getExamTimestamp(b)), [enrolledExams, subjectFilter, typeFilter]);
  const upcoming = visible.filter((exam) => !examHasFinished(exam, now));
  const past = visible.filter((exam) => examHasFinished(exam, now)).sort((a, b) => getExamTimestamp(b) - getExamTimestamp(a));
  const editForm: ExamForm | undefined = editing ? {
    materia: editing.materia,
    seccion: editing.seccion,
    tipo: editing.tipo,
    fecha: editing.fecha,
    horaInicio: editing.horaInicio,
    horaFin: editing.horaFin,
    aula: editing.aula,
    observaciones: editing.observaciones,
  } : undefined;

  const saveNewExam = (form: ExamForm) => {
    const exam: Exam = { ...form, id: "", origen: "manual" };
    exam.id = `${createExamId(exam)}-manual-${Date.now()}`;
    addExam(exam);
    setAdding(false);
  };
  const saveEditedExam = (form: ExamForm) => {
    if (!editing) return;
    updateExam(editing.id, form);
    setEditing(undefined);
  };

  const renderExam = (exam: Exam) => {
    const finished = examHasFinished(exam, now);
    return (
      <article className={`exam-card ${finished ? "exam-card-finished" : ""}`} key={exam.id}>
        <div className="exam-card-main">
          <div className="exam-card-title">
            <div><h3>{exam.materia}</h3><span>{exam.seccion ? `Sección ${exam.seccion}` : "Sección no especificada"}{exam.turno ? ` · Turno ${exam.turno}` : ""}</span></div>
            <span className={`exam-badge ${badgeVariant(exam.tipo)}`}>{exam.tipo}</span>
          </div>
          <div className="exam-card-meta">
            <span><CalendarClock size={15} />{formattedDate(exam.fecha)}</span>
            {(exam.horaInicio || exam.horaFin) && <span className="exam-tabular">{exam.horaInicio || "—"}{exam.horaFin ? `–${exam.horaFin}` : ""}</span>}
            {exam.aula && <span>Aula {exam.aula}</span>}
          </div>
          {exam.observaciones && <p className="exam-observations">{exam.observaciones}</p>}
        </div>
        <div className="exam-card-actions">
          <span className={`exam-countdown ${finished ? "finished" : ""}`}>{remainingLabel(exam, now)}</span>
          <button className="icon-button compact exam-action" title="Editar examen" aria-label={`Editar ${exam.tipo}: ${exam.materia}`} onClick={() => setEditing(exam)}><Pencil size={16} /></button>
          <button className="icon-button compact exam-action delete" title="Eliminar examen" aria-label={`Eliminar ${exam.tipo}: ${exam.materia}`} onClick={() => deleteExam(exam.id)}><Trash2 size={16} /></button>
        </div>
      </article>
    );
  };

  return (
    <section className="exam-timeline">
      <div className="exam-toolbar">
        <div><h2>Fechas de exámenes</h2><p>{visible.length} {visible.length === 1 ? "evaluación" : "evaluaciones"} · Solo materias de tu horario.</p></div>
        <button className="primary-button exam-add-button" onClick={() => setAdding(true)}><CalendarPlus size={16} /> Agregar examen</button>
      </div>
      <div className="exam-filters">
        <label>Materia<select value={subjectFilter} onChange={(event) => { setSubjectFilter(event.target.value); setUpcomingLimit(40); setPastLimit(40); }}><option value="">Todas las materias</option>{subjectOptions.map((name) => <option key={name}>{name}</option>)}</select></label>
        <label>Tipo de examen<select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setUpcomingLimit(40); setPastLimit(40); }}><option value="">Todos los tipos</option>{typeOptions.map((type) => <option key={type}>{type}</option>)}</select></label>
      </div>
      {upcoming.length > 0 && <section className="exam-group"><h3>Próximos <span>{upcoming.length}</span></h3><div className="exam-cards">{upcoming.slice(0, upcomingLimit).map(renderExam)}</div>{upcoming.length > upcomingLimit && <button className="exam-load-more" onClick={() => setUpcomingLimit((limit) => limit + 40)}>Mostrar más próximos</button>}</section>}
      {past.length > 0 && <section className="exam-group exam-past-group"><h3>Finalizados <span>{past.length}</span></h3><div className="exam-cards">{past.slice(0, pastLimit).map(renderExam)}</div>{past.length > pastLimit && <button className="exam-load-more" onClick={() => setPastLimit((limit) => limit + 40)}>Mostrar más finalizados</button>}</section>}
      {!visible.length && <div className="empty-inline">
        {!enrolled.length
          ? "Agrega materias a Mi Horario para ver sus exámenes."
          : enrolledExams.length
            ? "No hay exámenes que coincidan con los filtros."
            : "No hay fechas de exámenes para las materias de tu horario. Importa una planilla o agrega una fecha manualmente."}
      </div>}
      {adding && <ExamEditor initial={emptyForm()} materiaOptions={subjectOptions} onClose={() => setAdding(false)} onSave={saveNewExam} />}
      {editing && editForm && <ExamEditor initial={editForm} materiaOptions={subjectOptions} onClose={() => setEditing(undefined)} onSave={saveEditedExam} />}
    </section>
  );
}
