import type { GradeInputs, GradeResult } from "../types/academic";
import { roundFPUNA } from "./rounding";

const validScore = (value: number | undefined): value is number =>
  value !== undefined && Number.isFinite(value) && value >= 0 && value <= 100;

export function effectivePartials(inputs: GradeInputs): [number | undefined, number | undefined] {
  let { p1, p2 } = inputs;
  if (!inputs.recoveryEnabled || !validScore(inputs.recoveryScore)) return [p1, p2];
  if (inputs.recoveryTarget === "p1") p1 = inputs.recoveryScore;
  else if (inputs.recoveryTarget === "p2") p2 = inputs.recoveryScore;
  else if (p1 === undefined || (p2 !== undefined && p2 < p1)) p2 = inputs.recoveryScore;
  else p1 = inputs.recoveryScore;
  return [p1, p2];
}

export function calculatePEP(inputs: GradeInputs): number | undefined {
  const [p1, p2] = effectivePartials(inputs);
  if (!validScore(p1) || !validScore(p2) || inputs.tps.length !== 4 || inputs.tps.some((score) => !validScore(score))) return undefined;
  const partialAverage = (p1 + p2) / 2;
  const tpAverage = inputs.tps.reduce<number>((sum, score) => sum + (score ?? 0), 0) / 4;
  const totalWeight = inputs.weightParciales + inputs.weightTPs;
  if (totalWeight !== 100 || inputs.weightParciales < 0 || inputs.weightTPs < 0) return undefined;
  return roundFPUNA((inputs.weightParciales / 100) * partialAverage + (inputs.weightTPs / 100) * tpAverage);
}

export function calculateGrade(pep: number | undefined, finalExam: number | undefined): GradeResult {
  const eligible = pep !== undefined && pep >= 60;
  if (!eligible || !validScore(finalExam)) return { pep, grade: 1, label: "Insuficiente", eligible };
  const rp = roundFPUNA(0.4 * finalExam + 0.6 * pep);
  if (finalExam < 50 || rp < 60) return { pep, rp, grade: 1, label: "Insuficiente", eligible };
  if (rp <= 70) return { pep, rp, grade: 2, label: "Aceptable", eligible };
  if (rp <= 80) return { pep, rp, grade: 3, label: "Bueno", eligible };
  if (rp <= 90) return { pep, rp, grade: 4, label: "Distinguido", eligible };
  return { pep, rp, grade: 5, label: "Sobresaliente", eligible };
}

export function minimumPartialScore(
  knownPartial: number,
  tps: Array<number | undefined>,
  weights: Pick<GradeInputs, "weightParciales" | "weightTPs">,
): number | undefined {
  for (let score = 0; score <= 100; score += 1) {
    const pep = calculatePEP({
      p1: knownPartial,
      p2: score,
      tps,
      ...weights,
      recoveryEnabled: false,
      recoveryTarget: "lowest",
    });
    if (pep !== undefined && pep >= 60) return score;
  }
  return undefined;
}

export function minimumRecoveryScore(inputs: GradeInputs): number | undefined {
  for (let score = 0; score <= 100; score += 1) {
    const pep = calculatePEP({ ...inputs, recoveryEnabled: true, recoveryScore: score });
    if (pep !== undefined && pep >= 60) return score;
  }
  return undefined;
}

export function minimumFinalScores(pep: number | undefined): Array<{ grade: number; label: string; score?: number }> {
  const targets = [
    { grade: 2, label: "Aceptable" },
    { grade: 3, label: "Bueno" },
    { grade: 4, label: "Distinguido" },
    { grade: 5, label: "Sobresaliente" },
  ];
  return targets.map((target) => {
    for (let score = 50; score <= 100; score += 1) {
      if (calculateGrade(pep, score).grade >= target.grade) return { ...target, score };
    }
    return target;
  });
}
