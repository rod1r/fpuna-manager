export function roundFPUNA(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.floor(Number(value.toFixed(6)) + 0.5);
}
