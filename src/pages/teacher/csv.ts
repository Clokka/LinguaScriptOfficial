// CSV downloads for the teacher pages. Cells that start with = + @ - are
// prefixed with ' so spreadsheets (Google Sheets, Excel) never run them.
import type { Clip, Student } from "@/lib/classroom/teacherData";

const esc = (v: unknown) => {
  const text = String(v ?? "");
  const safe = /^[=+@\-\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};
function save(name: string, head: string[], rows: unknown[][]) {
  const blob = new Blob([[head.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name.replace(/[^\w.-]+/g, "-");
  a.click();
  URL.revokeObjectURL(a.href);
}
const label = { done: "Finished", going: "Watching", not: "Not started" } as const;

export function downloadClipCsv(c: Clip) {
  save(`${c.title}-${c.group}.csv`, ["Student", "Watched %", "Watches", "Words green %", "Status", "Last watched"],
    c.students.map((s) => [s.name, s.watched_pct == null ? "" : Math.round(s.watched_pct), s.watch_count ?? "",
      s.green_pct == null ? "" : Math.round(s.green_pct), label[s.status], s.last_watched_at?.slice(0, 10) ?? ""]));
}
export function downloadStudentsCsv(group: string, rows: Student[]) {
  save(`${group}-students.csv`, ["Name", "Email", "Clips set", "Clips started", "Clips finished", "Last clip activity"],
    rows.map((r) => [r.display_name, r.email, r.tasks_set, r.tasks_started, r.tasks_done, r.last_task_activity?.slice(0, 10) ?? ""]));
}
