
- Verb/word form checks use public.word_forms (UniMorph import + cached analyze-word-form AI results) and sentence_patterns.slots[0].accepts — never suffix heuristics. Why: irregular forms and non-hand-coded languages need exact data.
- UI translation uses the lightweight `src/i18n` (useT, STRINGS) keyed by profile native_language > device choice > browser language; why: reassure non-English beginners without a heavy i18n dependency.
- Vocabulary-coverage thresholds (98 ideal / 95 min / 90 stretch) live only in src/lib/coverage.ts; why: one comprehensible-input rule across recommendations, labels and rails.
- Streak/XP/level/gifts are server-authoritative (keep_streak, grant_xp, claim_return_gift, check_achievements; protect_reward_columns locks xp/streak columns); dates use profiles.timezone via local_today; why: anti-exploit and correct local days.
