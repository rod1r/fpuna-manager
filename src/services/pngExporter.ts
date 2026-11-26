import { DAYS, type Subject } from "../types/catalog";
import { formatMinutes, parseTimeRange } from "../domain/schedule";

export function downloadSchedulePng(subjects: Subject[]): void {
  const scale = 2;
  const width = 1000;
  const height = 760;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo crear el canvas para exportar el horario.");
  context.scale(scale, scale);
  context.fillStyle = "#f8fafc";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#0f172a";
  context.font = "700 24px system-ui, sans-serif";
  context.fillText("Mi Horario · FP-UNA", 32, 42);

  const left = 96;
  const top = 88;
  const cellWidth = 142;
  const gridHeight = 600;
  const weeklySubjects = subjects.filter(({ onlyFinal }) => !onlyFinal);
  const allIntervals = weeklySubjects.flatMap((subject) => subject.schedule.map(({ time }) => parseTimeRange(time)).filter((interval) => interval !== undefined));
  const startMinute = allIntervals.length ? Math.floor(Math.min(...allIntervals.map(({ start }) => start)) / 60) * 60 : 6 * 60;
  const endMinute = allIntervals.length ? Math.ceil(Math.max(...allIntervals.map(({ end }) => end)) / 60) * 60 : 22 * 60;
  context.font = "600 13px system-ui, sans-serif";
  DAYS.forEach((day, index) => {
    const x = left + index * cellWidth;
    context.fillStyle = "#1e293b";
    context.fillText(day, x + 7, top - 12);
    context.strokeStyle = "#cbd5e1";
    context.strokeRect(x, top, cellWidth, gridHeight);
  });
  for (let hour = startMinute / 60; hour <= endMinute / 60; hour += 1) {
    const y = top + ((hour * 60 - startMinute) / (endMinute - startMinute)) * gridHeight;
    context.fillStyle = "#475569";
    context.fillText(`${String(hour).padStart(2, "0")}:00`, 34, y + 4);
    context.strokeStyle = "#e2e8f0";
    context.beginPath();
    context.moveTo(left, y);
    context.lineTo(left + cellWidth * DAYS.length, y);
    context.stroke();
  }
  weeklySubjects.forEach((subject, subjectIndex) => {
    subject.schedule.forEach((block) => {
      const interval = parseTimeRange(block.time);
      const dayIndex = DAYS.indexOf(block.day);
      if (!interval || dayIndex < 0) return;
      const x = left + dayIndex * cellWidth + 4;
      const y = top + ((interval.start - startMinute) / (endMinute - startMinute)) * gridHeight;
      const blockHeight = ((interval.end - interval.start) / (endMinute - startMinute)) * gridHeight;
      context.fillStyle = ["#dbeafe", "#dcfce7", "#fef3c7", "#fce7f3"][subjectIndex % 4];
      context.fillRect(x, y, cellWidth - 8, blockHeight);
      context.fillStyle = "#0f172a";
      context.font = "600 11px system-ui, sans-serif";
      context.fillText(subject.name.slice(0, 21), x + 5, y + 15);
      context.font = "10px system-ui, sans-serif";
      context.fillText(`${formatMinutes(interval.start)}-${formatMinutes(interval.end)}`, x + 5, y + 29);
      if (block.room) context.fillText(block.room.slice(0, 21), x + 5, y + 42);
    });
  });
  canvas.toBlob((blob) => {
    if (!blob) {
      window.alert("No se pudo generar la imagen PNG.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "mi-horario-fpuna.png";
    anchor.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}
