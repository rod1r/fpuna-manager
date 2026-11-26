import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

export function SemesterGroup({ semester, count, children }: { semester: number; count: number; children: ReactNode }) {
  return (
    <details className="semester-group" open={semester === 1}>
      <summary><span>{semester ? `${semester}° Semestre` : "Semestre no especificado"}</span><span className="semester-count">{count}</span><ChevronDown size={18} /></summary>
      <div className="semester-courses">{children}</div>
    </details>
  );
}
