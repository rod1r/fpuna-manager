import { useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { hasScheduleConflict } from "../../domain/schedule";
import { useAcademicStore } from "../../store/useAcademicStore";
import type { Subject } from "../../types/catalog";
import { CourseCard } from "./CourseCard";
import { SemesterGroup } from "./SemesterGroup";

export function ExplorerView() {
  const { catalog, enrolled, addSubject } = useAcademicStore();
  const [search, setSearch] = useState("");
  const [campus, setCampus] = useState("Todas las sedes");
  const [career, setCareer] = useState("Todas las carreras");
  const [emphasis, setEmphasis] = useState("Todos los énfasis");
  const [shift, setShift] = useState("Todos los turnos");
  const [onlyFinal, setOnlyFinal] = useState(false);

  const careers = useMemo(() => [...new Set(catalog.map(({ career }) => career).filter(Boolean))].sort(), [catalog]);
  const emphases = useMemo(() => [...new Set(catalog.map(({ emphasis }) => emphasis).filter((value): value is string => Boolean(value)))].sort(), [catalog]);
  const subjects = useMemo(
    () => catalog.filter((subject) => {
      const text = `${subject.name} ${subject.teacher ?? ""} ${subject.career}`.toLocaleLowerCase("es");
      return (
        (campus === "Todas las sedes" || subject.campus === campus) &&
        (career === "Todas las carreras" || subject.career === career) &&
        (emphasis === "Todos los énfasis" || subject.emphasis === emphasis) &&
        (shift === "Todos los turnos" || subject.shift === shift) &&
        (!onlyFinal || subject.onlyFinal) &&
        text.includes(search.toLocaleLowerCase("es"))
      );
    }),
    [catalog, campus, career, emphasis, shift, onlyFinal, search],
  );
  const groups = useMemo(() => {
    const map = new Map<number, Subject[]>();
    subjects.forEach((subject) => map.set(subject.semester, [...(map.get(subject.semester) ?? []), subject]));
    return [...map.entries()].sort(([a], [b]) => a - b);
  }, [subjects]);
  const enrolledSubjects = enrolled.map(({ subject }) => subject);

  return (
    <section className="view">
      <div className="view-heading">
        <div><p className="eyebrow">CATÁLOGO ACADÉMICO</p><h1>Explorar materias</h1></div>
        <span className="result-count">{subjects.length} secciones</span>
      </div>
      <div className="filter-panel">
        <label className="search-field"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar asignatura o docente" /></label>
        <div className="filters">
          <label><span>Sede</span><select value={campus} onChange={(event) => setCampus(event.target.value)}><option>Todas las sedes</option>{[...new Set(catalog.map(({ campus: value }) => value))].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span>Carrera</span><select value={career} onChange={(event) => setCareer(event.target.value)}><option>Todas las carreras</option>{careers.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span>Énfasis</span><select value={emphasis} onChange={(event) => setEmphasis(event.target.value)}><option>Todos los énfasis</option>{emphases.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label><span>Turno</span><select value={shift} onChange={(event) => setShift(event.target.value)}><option>Todos los turnos</option>{[...new Set(catalog.map(({ shift: value }) => value).filter(Boolean))].map((value) => <option key={value}>{value}</option>)}</select></label>
        </div>
        <label className="checkbox-line"><input type="checkbox" checked={onlyFinal} onChange={(event) => setOnlyFinal(event.target.checked)} /><span>Mostrar solo materias con derecho a examen Final</span></label>
      </div>
      {groups.length ? groups.map(([semester, entries]) => (
        <SemesterGroup key={semester} semester={semester} count={entries.length}>
          {entries.map((subject) => {
            const conflict = hasScheduleConflict(subject, enrolledSubjects.filter(({ id }) => id !== subject.id));
            return <CourseCard key={subject.id} subject={subject} conflict={conflict} enrolled={enrolledSubjects.some(({ id }) => id === subject.id)} onAdd={() => addSubject(subject)} />;
          })}
        </SemesterGroup>
      )) : (
        <div className="empty-state"><SlidersHorizontal size={26} /><h2>No hay materias para mostrar</h2><p>Importa la planilla oficial o cambia los filtros aplicados.</p></div>
      )}
    </section>
  );
}
