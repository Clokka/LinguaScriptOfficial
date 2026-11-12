// LinguaScript Classroom UI kit: the exact look of design "A · Calm Command".
// Calm black ground; red / orange / green / gold / blue only mean word or
// progress states; green is the one action colour.
import type { ReactNode, SVGProps } from "react";
import { Link } from "react-router-dom";
import type { Clip } from "@/lib/classroom/teacherData";
import { clipLength, dueLabel } from "@/lib/classroom/teacherData";

export const C = {
  ground: "#0B0B0D", card: "#131316", line: "#1E1E23", raised: "#17171B", chip: "#1C1C21",
  track: "#232329", outline: "#2A2A30", text: "#F2F2F5", soft: "#D4D4D8", muted: "#A1A1AA", faint: "#8E8E98",
  red: "#FF5A4F", orange: "#FF9F0A", green: "#34C759", gold: "#FFD60A", blue: "#6C8CF2",
};

export const cardCls = "rounded-[20px] border border-[#1E1E23] bg-[#131316]";
export const primaryBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#34C759] px-5 text-sm font-bold text-[#0B0B0D] transition-colors hover:bg-[#5EDC7E] disabled:opacity-50";
export const outlineBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#2A2A30] bg-transparent px-[18px] text-sm font-semibold text-[#F2F2F5] transition-colors hover:bg-[#17171B] disabled:opacity-50";
export const softBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#2A2A30] bg-[#17171B] px-4 text-sm font-semibold text-[#F2F2F5] transition-colors hover:bg-[#1F1F25] disabled:opacity-50";
export const inputCls = "h-11 w-full rounded-xl border border-[#2A2A30] bg-[#0F0F12] px-3 text-sm text-[#F2F2F5] placeholder:text-[#6B6B75] focus:border-[#34C759] focus:outline-none";
export const linkCls = "text-sm font-semibold text-[#34C759] hover:text-[#5EDC7E]";

/** The logo chameleon (same art as public/logo.svg). */
export function Chameleon({ size = 44, ...rest }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="14 76 372 184" width={size} height={size / 2} aria-hidden="true" {...rest}>
      <path d="M20 236 Q200 222 380 240 L380 254 Q200 236 20 250 Z" fill="#5b4332" />
      <path d="M272 176 C322 168 348 190 344 214 C340 236 316 242 304 230 C295 220 302 206 314 207" fill="none" stroke="#26A047" strokeWidth="15" strokeLinecap="round" />
      <rect x="233" y="196" width="15" height="38" rx="7.5" fill="#26A047" />
      <path d="M136 196 Q128 118 205 106 Q276 96 285 160 Q290 202 244 208 L164 210 Q140 208 136 196 Z" fill="#34C759" />
      <path d="M158 130 q7 -14 14 0 q7 -14 14 0 q7 -14 14 0 q7 -14 14 0 q7 -14 14 0 q7 -14 14 0 q7 -14 14 0 l-2 10 q-49 -10 -94 2 Z" fill="#1B7A35" />
      <path d="M150 196 Q152 168 178 166 Q166 190 190 206 L164 208 Q152 206 150 196 Z" fill="#B8EFC8" />
      <rect x="182" y="198" width="15" height="40" rx="7.5" fill="#26A047" />
      <path d="M162 118 Q160 92 134 88 Q104 84 88 112 Q74 138 84 162 Q94 186 126 188 Q152 189 160 168 Q166 148 162 118 Z" fill="#34C759" />
      <path d="M82 148 Q104 162 128 154" fill="none" stroke="#3d2b1f" strokeWidth="4.5" strokeLinecap="round" />
      <circle cx="118" cy="126" r="21" fill="#B8EFC8" />
      <circle cx="118" cy="126" r="11.5" fill="#fffef9" />
      <circle cx="122.27" cy="124.58" r="5.5" fill="#241a12" />
    </svg>
  );
}

const ico = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, "aria-hidden": true };
export const Icon = {
  home: () => <svg {...ico}><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /></svg>,
  film: () => <svg {...ico}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M10 9l5 3-5 3z" /></svg>,
  users: () => <svg {...ico}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5c2 .7 3.2 2.6 3.5 5.5" /></svg>,
  book: () => <svg {...ico}><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 21V5" /></svg>,
  calendar: () => <svg {...ico}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>,
  plus: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>,
  shield: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6C8CF2" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" /><path d="M9 12l2 2 4-4" /></svg>,
  trash: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>,
};

export function PageHeader({ eyebrow, title, sub, actions }: { eyebrow?: ReactNode; title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        {eyebrow && <span className="text-[13px] font-medium text-[#8E8E98]">{eyebrow}</span>}
        <h1 className="m-0 text-[32px] font-extrabold leading-tight tracking-[-0.02em]">{title}</h1>
        {sub && <p className="m-0 text-[15px] text-[#A1A1AA]">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
    </header>
  );
}

export function SectionTitle({ id, children, right }: { id?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 id={id} className="m-0 text-lg font-bold">{children}</h2>
      {right}
    </div>
  );
}

export function StatTile({ label, value, color, caption }: { label: string; value: ReactNode; color?: string; caption: ReactNode }) {
  return (
    <div className={`${cardCls} flex flex-col gap-2 p-5`}>
      <span className="text-[13px] font-medium text-[#8E8E98]">{label}</span>
      <span className="text-[34px] font-extrabold leading-none tracking-[-0.02em]" style={color ? { color } : undefined}>{value}</span>
      <span className="text-[13px] text-[#A1A1AA]">{caption}</span>
    </div>
  );
}

const THUMBS = ["linear-gradient(135deg,#2B2118,#14110E)", "linear-gradient(135deg,#16222B,#0E1216)", "linear-gradient(135deg,#132416,#0C120D)"];

export function ClipCard({ clip, index = 0, right }: { clip: Clip; index?: number; right?: ReactNode }) {
  const total = clip.students.length || 1;
  const due = dueLabel(clip);
  const len = clipLength(clip.duration_seconds);
  return (
    <article className={`${cardCls} flex flex-wrap items-center gap-[18px] p-4`}>
      <Link to={`/watch/${clip.film_id}`} aria-label={`Watch ${clip.title}`}
        className="relative flex h-[84px] w-[148px] flex-none items-center justify-center overflow-hidden rounded-[14px]"
        style={{ background: THUMBS[index % THUMBS.length] }}>
        {clip.thumbnail_url && <img src={clip.thumbnail_url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-80" />}
        <svg className="relative" width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="rgba(0,0,0,0.55)" /><path d="M10 8l6 4-6 4z" fill="#F2F2F5" /></svg>
        {len && <span className="absolute bottom-1.5 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-bold text-[#F2F2F5]">{len}</span>}
      </Link>
      <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="m-0 text-base font-bold">{clip.title}</h3>
          <span className="rounded-full bg-[#1C1C21] px-[9px] py-[3px] text-xs font-semibold text-[#A1A1AA]">{clip.group}</span>
        </div>
        <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-[#232329]" role="img"
          aria-label={`${clip.doneN} finished, ${clip.goingN} watching, ${clip.notN} not started`}>
          <div className="bg-[#34C759]" style={{ width: `${(clip.doneN / total) * 100}%` }} />
          <div className="bg-[#FF9F0A]" style={{ width: `${(clip.goingN / total) * 100}%` }} />
        </div>
        <div className="flex flex-wrap gap-3.5 text-[13px] text-[#A1A1AA]">
          <span><b className="text-[#F2F2F5]">{clip.doneN}</b> finished</span>
          <span><b className="text-[#F2F2F5]">{clip.goingN}</b> watching</span>
          <span><b className="text-[#F2F2F5]">{clip.notN}</b> not started</span>
          <span className="ml-auto font-semibold" style={{ color: due.color }}>{due.text}</span>
        </div>
      </div>
      {right}
    </article>
  );
}

export function StatusPill({ status }: { status: "done" | "going" | "not" }) {
  const map = {
    done: ["Finished", "#34C759", "rgba(52,199,89,0.12)"],
    going: ["Watching", "#FF9F0A", "rgba(255,159,10,0.12)"],
    not: ["Not started", "#A1A1AA", "#1F1F25"],
  } as const;
  const [label, color, bg] = map[status];
  return <span className="whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold" style={{ color, background: bg }}>{label}</span>;
}

export function PrivacyLine({ children }: { children?: ReactNode }) {
  return (
    <p className="m-0 flex items-center gap-2.5 text-[13px] text-[#8E8E98]">
      <Icon.shield />{children ?? "You only see the clips you set. Your students can see exactly what you see."}
    </p>
  );
}

export function EmptyCard({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className={`${cardCls} flex flex-col items-start gap-3 p-6`}>
      <span className="text-[15px] font-bold">{title}</span>
      <p className="m-0 text-sm text-[#A1A1AA]">{children}</p>
      {action}
    </div>
  );
}
