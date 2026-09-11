/**
 * CEFR level -> a YouTube search modifier, so candidate generation starts
 * from the learner's real level instead of a generic query. This is the
 * "base tier" stage of the two-stage funnel: CEFR picks WHAT to search for,
 * the real per-user comprehension scoring in videoRecommendation.ts then
 * picks the BEST specific videos from those candidates. Neither stage
 * alone is enough — CEFR without comprehension scoring is a generic
 * guess ("B1-ish"); comprehension scoring without a CEFR-informed search
 * has no idea what to even search YouTube for.
 */
export function cefrSearchModifier(level: string | null | undefined): string {
  switch ((level || "").toLowerCase()) {
    case "a1":
    case "a2":
      return "for beginners easy slow";
    case "b1":
    case "b2":
      return "intermediate";
    case "c1":
    case "c2":
      return "advanced native level";
    default:
      return "";
  }
}
