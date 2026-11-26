import { GraduationCap } from "lucide-react";
import { useAcademicStore } from "../../store/useAcademicStore";
import { GradeSimulator } from "./GradeSimulator";
import { SubjectGradeCard } from "./SubjectGradeCard";

export function GradesView() {
  const enrolled = useAcademicStore((state) => state.enrolled);
  const calculatorGrades = useAcademicStore((state) => state.calculatorGrades);
  const updateCalculatorGrades = useAcademicStore((state) => state.updateCalculatorGrades);
  return (
    <section className="view">
      <div className="view-heading"><div><p className="eyebrow">SEGUIMIENTO ACADÉMICO</p><h1>Notas y habilitación</h1></div><span className="result-count">{enrolled.length} materias</span></div>
      <GradeSimulator grades={calculatorGrades} onChange={updateCalculatorGrades} />
      {enrolled.length
        ? <div className="grade-list"><h2 className="grade-list-title">Asistencia por materia</h2>{enrolled.map((item) => <SubjectGradeCard key={item.subject.id} item={item} />)}</div>
        : <div className="empty-state"><GraduationCap size={28} /><h2>Aún no agregaste materias</h2><p>Explora el catálogo y agrega tus secciones para consultar la asistencia por materia.</p></div>}
    </section>
  );
}
