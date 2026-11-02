// npm run test:cognates — every word in src/lib/cognates/french.ts follows its rule.
import { FRENCH_RULES, frenchCognates } from "../src/lib/cognates/french";

const words = frenchCognates();
const problems: string[] = [];
const seenEn = new Set<string>(), seenFr = new Set<string>();
for (const w of words) {
  const r = FRENCH_RULES.find((x) => x.id === w.rule)!;
  const endsEn = r.en.some((e) => w.en.endsWith(e.slice(1)));
  const frPlain = w.fr.replace(/ï/g, "i");
  const endsFr = r.fr.some((e) => frPlain.endsWith(e.slice(1)));
  if (!endsEn) problems.push(`${r.id}: "${w.en}" doesn't end in ${r.en.join("/")}`);
  if (!endsFr) problems.push(`${r.id}: "${w.fr}" doesn't end in ${r.fr.join("/")}`);
  if (seenEn.has(w.en)) problems.push(`duplicate English "${w.en}"`);
  if (seenFr.has(w.fr)) problems.push(`duplicate French "${w.fr}"`);
  if (/[^a-z\-]/.test(w.en)) problems.push(`odd English "${w.en}"`);
  if (/[^a-zàâäçéèêëîïôöùûüœæ\-]/.test(w.fr)) problems.push(`odd French "${w.fr}"`);
  seenEn.add(w.en); seenFr.add(w.fr);
}
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
const byRule = FRENCH_RULES.map((r) => `${r.id} ${words.filter((w) => w.rule === r.id).length}`).join(", ");
console.log(`✓ ${words.length} French cognates OK (${byRule})`);
