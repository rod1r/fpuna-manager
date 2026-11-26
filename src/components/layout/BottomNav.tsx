import { BookOpen, CalendarDays, GraduationCap } from "lucide-react";

export type AppView = "explore" | "schedule" | "grades";

const options: Array<{ id: AppView; label: string; Icon: typeof BookOpen }> = [
  { id: "explore", label: "Explorar", Icon: BookOpen },
  { id: "schedule", label: "Mi Horario", Icon: CalendarDays },
  { id: "grades", label: "Notas y asistencia", Icon: GraduationCap },
];

export function BottomNav({ view, onChange }: { view: AppView; onChange: (view: AppView) => void }) {
  return (
    <nav className="bottom-nav" aria-label="Navegación principal">
      {options.map(({ id, label, Icon }) => (
        <button className={`nav-item ${view === id ? "active" : ""}`} key={id} onClick={() => onChange(id)}>
          <Icon size={19} strokeWidth={1.8} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
