import { useMemo } from "react";
import { calculateGrade, calculatePEP, minimumFinalScores, minimumPartialScore, minimumRecoveryScore } from "../../domain/grades";
import type { GradeInputs } from "../../types/academic";

const scoreValue = (value: number | null | undefined) => value === undefined || value === null ? "" : value;

export function GradeSimulator({ grades, onChange }: { grades: GradeInputs; onChange: (patch: Partial<GradeInputs>) => void }) {
  const pep = calculatePEP(grades);
  const result = calculateGrade(pep, grades.finalExam);
  const inverse = useMemo(
    () => grades.p1 !== undefined
      ? minimumPartialScore(grades.p1, grades.tps, { weightParciales: grades.weightParciales, weightTPs: grades.weightTPs })
      : undefined,
    [grades.p1, grades.tps, grades.weightParciales, grades.weightTPs],
  );
  const recoveryMinimum = useMemo(() => minimumRecoveryScore(grades), [grades]);
  const updateScore = (key: "p1" | "p2" | "finalExam" | "recoveryScore", value: string) => {
    const score = value === "" ? undefined : Math.max(0, Math.min(100, Number(value)));
    if (key === "p1") onChange({ p1: score });
    else if (key === "p2") onChange({ p2: score });
    else if (key === "finalExam") onChange({ finalExam: score });
    else onChange({ recoveryScore: score });
  };

  return (
    <section className="academic-panel">
      <div className="panel-title-row"><div><h3>Calculadora general</h3><p>Evaluaciones parciales, trabajos prácticos y examen final</p></div><div className="pep-result tabular-nums">{pep ?? "—"}<small>PEP</small></div></div>
      <div className="score-grid">
        <label>P1<input type="number" min="0" max="100" value={scoreValue(grades.p1)} onChange={(event) => updateScore("p1", event.target.value)} /></label>
        <label>P2<input type="number" min="0" max="100" value={scoreValue(grades.p2)} onChange={(event) => updateScore("p2", event.target.value)} /></label>
        {grades.tps.map((score, index) => <label key={index}>TP{index + 1}<input type="number" min="0" max="100" value={scoreValue(score)} onChange={(event) => {
          const next = [...grades.tps];
          next[index] = event.target.value === "" ? undefined : Math.max(0, Math.min(100, Number(event.target.value)));
          onChange({ tps: next });
        }} /></label>)}
      </div>
      <div className="weight-row">
        <label>Peso parciales (%)<input type="number" min="0" max="100" value={grades.weightParciales} onChange={(event) => {
          const value = Math.max(0, Math.min(100, Number(event.target.value) || 0));
          onChange({ weightParciales: value, weightTPs: 100 - value });
        }} /></label>
        <label>Peso TPs (%)<input type="number" min="0" max="100" value={grades.weightTPs} onChange={(event) => {
          const value = Math.max(0, Math.min(100, Number(event.target.value) || 0));
          onChange({ weightTPs: value, weightParciales: 100 - value });
        }} /></label>
      </div>
      {grades.weightParciales + grades.weightTPs !== 100 && <div className="field-error">Los pesos deben sumar 100%.</div>}
      <label className="checkbox-line"><input type="checkbox" checked={grades.recoveryEnabled} onChange={(event) => onChange({ recoveryEnabled: event.target.checked })} /><span>Habilitar Examen Recuperatorio</span></label>
      {grades.recoveryEnabled && <div className="recovery-row">
        <label>Reemplaza<select value={grades.recoveryTarget} onChange={(event) => onChange({ recoveryTarget: event.target.value as GradeInputs["recoveryTarget"] })}><option value="lowest">Parcial de menor puntaje</option><option value="p1">P1</option><option value="p2">P2</option></select></label>
        <label>Nota recuperatorio<input type="number" min="0" max="100" value={scoreValue(grades.recoveryScore)} onChange={(event) => updateScore("recoveryScore", event.target.value)} /></label>
      </div>}
      {grades.p1 !== undefined && grades.tps.every((score) => score !== undefined) && <div className="simulation-note">
        {inverse !== undefined ? <>Con P1 y los TPs actuales, necesitas al menos <strong>{inverse}</strong> puntos en P2 para alcanzar PEP 60.</> : <>No es posible alcanzar PEP 60 con estos puntajes.</>}
      </div>}
      {grades.recoveryEnabled && grades.p1 !== undefined && grades.p2 !== undefined && grades.tps.every((score) => score !== undefined) && <div className="simulation-note">
        {recoveryMinimum !== undefined ? <>Puntaje mínimo de Recuperatorio para alcanzar PEP 60: <strong>{recoveryMinimum}</strong>.</> : <>No es posible alcanzar PEP 60 con el Recuperatorio.</>}
      </div>}
      {pep !== undefined && <div className={pep >= 60 ? "attendance-status status-good" : "attendance-status status-danger"}>{pep >= 60 ? "Habilitado académicamente: PEP ≥ 60" : "No habilitado: se requiere PEP ≥ 60"}</div>}
      <div className="final-row"><label>Examen Final (EF)<input type="number" min="0" max="100" value={scoreValue(grades.finalExam)} onChange={(event) => updateScore("finalExam", event.target.value)} /></label><div className="rp-result">RP <strong className="tabular-nums">{result.rp ?? "—"}</strong><span>Nota {result.grade} · {result.label}</span></div></div>
      {pep !== undefined && pep >= 60 ? <div className="minimum-table-wrap"><p className="table-caption">Puntaje mínimo requerido en EF para cada calificación</p><table className="minimum-table"><thead><tr><th>Calificación</th><th>Nota mínima EF</th></tr></thead><tbody>
        {minimumFinalScores(pep).map((target) => <tr key={target.grade}><td>{target.grade} · {target.label}</td><td className="tabular-nums">{target.score ?? "No alcanzable"}</td></tr>)}
      </tbody></table></div> : <div className="simulation-note">El simulador de EF estará disponible cuando el PEP alcance 60.</div>}
    </section>
  );
}
