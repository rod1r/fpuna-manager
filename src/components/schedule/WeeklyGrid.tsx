import { DAYS, type Subject } from "../../types/catalog";
import { formatMinutes, parseTimeRange } from "../../domain/schedule";

export function WeeklyGrid({ subjects, conflictIds = new Set<string>() }: { subjects: Subject[]; conflictIds?: Set<string> }) {
  const blocks = subjects.filter(({ onlyFinal }) => !onlyFinal).flatMap((subject) => subject.schedule.map((block) => ({ ...block, subject })));
  if (!blocks.length) return <div className="empty-inline">Las materias agregadas no tienen bloques semanales registrados.</div>;
  return (
    <div className="weekly-grid">
      {DAYS.map((day) => {
        const dayBlocks = blocks.filter((block) => block.day === day).sort((a, b) => (parseTimeRange(a.time)?.start ?? 0) - (parseTimeRange(b.time)?.start ?? 0));
        return (
          <section className="day-column" key={day}>
            <h3>{day}</h3>
            {dayBlocks.length ? dayBlocks.map((block, index) => {
              const interval = parseTimeRange(block.time);
              return (
                <article className={`schedule-block ${conflictIds.has(block.subject.id) ? "schedule-block-conflict" : ""}`} key={`${block.subject.id}-${index}`}>
                  <strong>{block.subject.name}</strong>
                  <span>{interval ? `${formatMinutes(interval.start)}–${formatMinutes(interval.end)}` : block.time}</span>
                  {block.room && <small>{block.room}</small>}
                  <small>{block.subject.section ? `Sección ${block.subject.section}` : block.subject.career}</small>
                  {conflictIds.has(block.subject.id) && <small className="schedule-conflict-label">Choque horario</small>}
                </article>
              );
            }) : <p className="no-classes">Sin clases</p>}
          </section>
        );
      })}
    </div>
  );
}
