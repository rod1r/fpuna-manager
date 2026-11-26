import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload, X } from "lucide-react";
import { downloadBackup, readBackup } from "../../services/backupService";
import { parseExcelFile } from "../../services/excelParser";
import { useAcademicStore } from "../../store/useAcademicStore";

export function Header() {
  const excelRef = useRef<HTMLInputElement>(null);
  const backupRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<{ message: string; tone: "success" | "warning" | "error" }>();
  const { catalog, enrolled, exams, calculatorGrades, importPlan, replaceState } = useAcademicStore();

  const importExcel = async (file?: File) => {
    if (!file) return;
    try {
      const result = await parseExcelFile(file);
      if (!result.subjects.length && !result.exams.length) {
        const details = result.diagnostics.map(({ sheet, message, detectedColumns }) =>
          `${sheet}: ${message}${detectedColumns.length ? ` Columnas detectadas: ${detectedColumns.join(", ")}` : ""}`,
        ).join(" ");
        setNotice({ message: details || `No se reconoció contenido importable en ${result.sheetsScanned} hojas.`, tone: "error" });
        return;
      }
      importPlan(result.subjects, result.exams);
      const warningSummary = result.diagnostics.length
        ? ` Avisos: ${result.diagnostics.map(({ sheet, message, detectedColumns }) =>
            `${sheet}: ${message}${detectedColumns.length ? ` Columnas detectadas: ${detectedColumns.join(", ")}` : ""}`,
          ).join(" ")}`
        : "";
      setNotice({
        message: `Se importaron ${result.subjects.length} secciones y ${result.exams.length} exámenes de ${result.sheetsScanned} hojas.${warningSummary}`,
        tone: result.diagnostics.length ? "warning" : "success",
      });
    } catch (error) {
      setNotice({ message: error instanceof Error ? `No se pudo leer el archivo Excel: ${error.message}` : "No se pudo leer el archivo Excel.", tone: "error" });
    }
  };
  const importBackup = async (file?: File) => {
    if (!file) return;
    try {
      const backup = await readBackup(file);
      replaceState(backup.catalog, backup.enrolled, backup.exams, backup.calculatorGrades);
      setNotice({ message: `Respaldo restaurado: ${backup.catalog.length} secciones, ${backup.enrolled.length} materias y ${backup.exams.length} exámenes.`, tone: "success" });
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : "No se pudo importar el respaldo.", tone: "error" });
    }
  };

  return (
    <>
      <header className="app-header">
        <a className="brand" href="#" aria-label="FP-UNA Manager inicio">
          <span className="brand-mark">FP</span>
          <span><strong>FP-UNA</strong><small>Manager académico</small></span>
        </a>
        <div className="header-actions">
          <span className="header-count">{enrolled.length} materias</span>
          <input ref={excelRef} hidden type="file" accept=".xlsx,.xls" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void importExcel(file); }} />
          <input ref={backupRef} hidden type="file" accept=".json,application/json" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void importBackup(file); }} />
          <button className="icon-button" title="Importar planilla Excel" aria-label="Importar planilla Excel" onClick={() => excelRef.current?.click()}><FileSpreadsheet size={18} /><span>Importar Excel</span></button>
          <button className="icon-button compact" title="Importar respaldo" aria-label="Importar respaldo" onClick={() => backupRef.current?.click()}><Upload size={18} /></button>
          <button className="icon-button compact" title="Descargar respaldo" aria-label="Descargar respaldo" onClick={() => downloadBackup(catalog, enrolled, exams, calculatorGrades)}><Download size={18} /></button>
        </div>
      </header>
      {notice && <div className={`import-notice ${notice.tone}`} role="status" aria-live="polite">
        <span>{notice.message}</span>
        <button aria-label="Cerrar aviso" onClick={() => setNotice(undefined)}><X size={16} /></button>
      </div>}
    </>
  );
}
