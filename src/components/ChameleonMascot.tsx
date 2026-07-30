// ChameleonMascot — the hand-crafted animated chameleon from the LinguaScript
// mascot concept. Its skin transitions red → orange → green with the learner's
// progress (via CSS custom properties) and it gently "bobs" while idle.
// Ported faithfully from the concept artifact (SVG + scoped CSS).
import { useEffect } from "react";

export type ChameleonTier = "red" | "orange" | "green";

// Exact SVG from the concept (the id was removed so multiple instances are safe).
const CHAM_SVG = `
<svg viewBox="0 0 400 270" class="cham-idle" role="img" aria-label="LinguaScript chameleon">
  <path d="M20 236 Q200 222 380 240 L380 254 Q200 236 20 250 Z" fill="#5b4332"></path>
  <path class="tailstroke" d="M272 176 C322 168 348 190 344 214 C340 236 316 242 304 230 C295 220 302 206 314 207" fill="none" stroke-width="15" stroke-linecap="round"></path>
  <rect class="skin2" x="233" y="196" width="15" height="38" rx="7.5"></rect>
  <path class="skin" d="M136 196 Q128 118 205 106 Q276 96 285 160 Q290 202 244 208 L164 210 Q140 208 136 196 Z"></path>
  <path class="ridge" d="M158 130 q7 -14 14 0 q7 -14 14 0 q7 -14 14 0 q7 -14 14 0 q7 -14 14 0 q7 -14 14 0 q7 -14 14 0 l-2 10 q-49 -10 -94 2 Z"></path>
  <path class="belly" d="M150 196 Q152 168 178 166 Q166 190 190 206 L164 208 Q152 206 150 196 Z"></path>
  <rect class="skin2" x="182" y="198" width="15" height="40" rx="7.5"></rect>
  <circle class="skin2" cx="189.5" cy="238" r="9"></circle>
  <path class="skin" d="M162 118 Q160 92 134 88 Q104 84 88 112 Q74 138 84 162 Q94 186 126 188 Q152 189 160 168 Q166 148 162 118 Z"></path>
  <path d="M82 148 Q104 162 128 154" fill="none" stroke="#3d2b1f" stroke-width="4.5" stroke-linecap="round"></path>
  <circle class="belly" cx="118" cy="126" r="21"></circle>
  <circle cx="118" cy="126" r="11.5" fill="#fffef9"></circle>
  <circle class="pupil" cx="118" cy="126" r="5.5" fill="#241a12" transform="translate(4.27 -1.42)"></circle>
  <circle cx="120.5" cy="123.5" r="2" fill="#ffffff" opacity="0.9" transform="translate(4.27 -1.42)"></circle>
</svg>`;

const CHAM_CSS = `
/* Skin tones derive from the canonical deck colours in brand/README.md:
   red #FF3B30 · orange #FF8A00 · green #34C759. These must not drift — the
   mascot's colour IS the deck state, on every surface. See src/lib/deck-colors.ts */
.ls-cham { --skin:#FF8A00; --skin2:#D97100; --belly:#FFE0B8; --ridge:#B35A00; display:inline-block; line-height:0; }
.ls-cham.tier-red    { --skin:#FF3B30; --skin2:#D32B22; --belly:#FFC4C0; --ridge:#B02018; }
.ls-cham.tier-orange { --skin:#FF8A00; --skin2:#D97100; --belly:#FFE0B8; --ridge:#B35A00; }
.ls-cham.tier-green  { --skin:#34C759; --skin2:#26A047; --belly:#B8EFC8; --ridge:#1B7A35; }
.ls-cham .skin  { fill:var(--skin);  transition:fill .7s; }
.ls-cham .skin2 { fill:var(--skin2); transition:fill .7s; }
.ls-cham .belly { fill:var(--belly); transition:fill .7s; }
.ls-cham .ridge { fill:var(--ridge); transition:fill .7s; }
.ls-cham .tailstroke { stroke:var(--skin2); transition:stroke .7s; }
.ls-cham svg { width:100%; height:auto; display:block; overflow:visible; }
@media (prefers-reduced-motion: no-preference) {
  .ls-cham .cham-idle { animation: ls-cham-bob 3.2s ease-in-out infinite; transform-origin:50% 78%; }
  @keyframes ls-cham-bob { 50% { transform: translateY(-5px); } }
  .ls-cham.party .cham-idle { animation: ls-cham-party .55s ease-in-out 3; }
  @keyframes ls-cham-party { 25% { transform: translateY(-10px) rotate(-2.5deg); } 75% { transform: translateY(-10px) rotate(2.5deg); } }
}`;

let injected = false;
function useChameleonStyles() {
  useEffect(() => {
    if (injected || document.getElementById("ls-cham-css")) { injected = true; return; }
    const s = document.createElement("style");
    s.id = "ls-cham-css";
    s.textContent = CHAM_CSS;
    document.head.appendChild(s);
    injected = true;
  }, []);
}

export function ChameleonMascot({
  tier = "orange",
  party = false,
  className = "",
  style,
}: {
  tier?: ChameleonTier;
  party?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  useChameleonStyles();
  return (
    <div
      className={`ls-cham tier-${tier}${party ? " party" : ""} ${className}`}
      style={style}
      dangerouslySetInnerHTML={{ __html: CHAM_SVG }}
    />
  );
}
