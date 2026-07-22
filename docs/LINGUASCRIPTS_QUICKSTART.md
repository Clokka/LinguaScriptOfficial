# LinguaScripts Phase 1 — Quick Start Guide

## What's Included

✅ **Core Feature Ready** — All Phase 1 functionality is implemented and committed.

- AI-generated contextual sentences
- Gap-fill exercise mode
- Multiple-choice exercise mode
- Combo tracking (×1-5)
- XP rewards (15 × combo)
- SRS word scheduling
- Celebration animations
- Pet integration

## How to Use

### 1. **Apply Database Migration**

```bash
cd /home/user/LinguaScriptOfficial
supabase migration up
```

This creates the `linguascripts` table and helper functions.

### 2. **Deploy Edge Function**

```bash
supabase functions deploy generate-linguascript
```

Ensure `LOVABLE_API_KEY` is set in your Supabase environment.

### 3. **Visit the Feature**

Navigate to `/linguascripts` in your browser.

You'll see:
- **Today's Mission** card (empty until you click a mode)
- **Feature cards** for Gap-Fill, MCQ, Speaking (coming soon)
- **How It Works** explainer

### 4. **Start an Exercise**

Click "Try Gap-Fill" or "Try MCQ" to:
1. Generate a random word + AI sentence
2. Practice with the exercise
3. See result + XP gained
4. Word auto-adds to your saved words

---

## Feature Walkthrough

### Gap-Fill Mode

1. See French sentence with blank: `Je voudrais un ____ noir`
2. Type the word: `café`
3. Click "Check Answer"
4. Result: ✓ Correct! +15 XP

### Multiple-Choice Mode

1. See sentence + "What does 'café' mean?"
2. Select from 4 options
3. Click "Check Answer"
4. Result: ✓ Correct! +15 XP

### Combo Multiplier

Each consecutive correct answer increases the multiplier:
- 1st correct: ×1 (15 XP)
- 2nd correct: ×2 (30 XP)
- 3rd correct: ×3 (45 XP)
- 4th correct: ×4 (60 XP)
- 5th correct: ×5 (75 XP)

**Resets if:**
- 30 minutes pass without an exercise
- You skip 8 times in a row

### Animations

When you get 3+ correct in a row:
- ✨ Confetti bursts
- 💛 XP counter floats up
- 🎉 Praise message ("AMAZING!")
- 🌟 Pet celebrates

---

## Integration Points

### With Your Existing Systems

**XP System** (src/lib/xp.ts)
- Awards inserted as `"review_card"` action
- Tracked in `xp_events` table
- Levels up on thresholds

**Vocabulary/SRS** (src/lib/vocab.ts)
- Completed words auto-add to `saved_words`
- Red → Orange → Green progression
- Scheduled reviews via existing deck system

**Pets** (src/lib/pets.ts)
- Celebrates on correct answers
- Uses existing `celebrate()` API
- Future: interest-aware messages

**Flashcards** (src/pages/Flashcards.tsx)
- Words from LinguaScripts auto-appear
- No changes needed, it just works

---

## File Locations Reference

**Core Components:**
- Exercise UI: `src/components/LinguaScriptExercise.tsx`
- Daily Mission: `src/components/TodaysMission.tsx`
- Animations: `src/components/LineBlastEffect.tsx`

**Business Logic:**
- API calls: `src/lib/linguascripts.ts`
- Combo tracking: `src/hooks/useComboTracker.ts`
- Page layout: `src/pages/LinguaScripts.tsx`

**Backend:**
- AI generation: `supabase/functions/generate-linguascript/index.ts`
- Database schema: `supabase/migrations/20260722_linguascripts.sql`

**Routes:**
- Main page: `/linguascripts`
- Added to `src/App.tsx`

---

## Troubleshooting

### "API key not configured"

The edge function couldn't find `LOVABLE_API_KEY`.

**Fix:** In Supabase Dashboard → Settings → Secrets, add:
```
LOVABLE_API_KEY = (your Lovable API key)
```

### "Generation failed: 500"

The edge function crashed, likely during AI call.

**Fix:** Check Supabase edge function logs in dashboard.

### "Not authenticated"

The user isn't logged in when trying to create a script.

**Fix:** Redirect users to `/auth` before `/linguascripts`, or use guest mode.

### Words not appearing in Flashcards

The SRS scheduling might not have run.

**Fix:** Check `saved_words` table for the word. If missing, check edge function logs for `schedule_linguascript_to_srs()` errors.

---

## Performance Tips

**To optimize before launch:**

1. **Cache generations** — Add a `linguascript_cache(word, language, content)` table to avoid re-generating the same sentence multiple times.

2. **Batch generation** — Pre-generate 10 daily exercises per user during onboarding, not on-demand.

3. **CDN for audio** — When adding audio/pronunciation, use Supabase Storage + CDN, not direct API calls.

4. **Combo visual feedback** — Consider adding combo counter animation that grows brighter as it increases.

---

## Next Steps

### Immediate (Week 2)

- [ ] Deploy and test with real users
- [ ] Monitor AI generation quality and cost
- [ ] Collect feedback on exercise difficulty
- [ ] Fix any UI/UX issues

### Short-term (Week 3-4)

- [ ] Add speaking mode (Deepgram integration)
- [ ] Implement interest-aware pet messages
- [ ] Add content caching to reduce AI costs
- [ ] Create onboarding flow to /linguascripts

### Medium-term (Phase 2)

- [ ] Difficulty levels (easy, medium, hard)
- [ ] Batch pre-generation
- [ ] Analytics dashboard (exercise stats)
- [ ] A/B test gap-fill vs MCQ

---

## Questions?

Refer to:
- **Full Docs:** `docs/LINGUASCRIPTS_PHASE1.md`
- **Implementation:** Commit `06ee5b0` on branch `claude/linguascript-srs-implementation-9z7ik2`
- **Code Comments:** Inline documentation in each component

---

## Launch Readiness Checklist

Before going live:

- [ ] Migration deployed and tables created
- [ ] Edge function deployed with LOVABLE_API_KEY set
- [ ] `/linguascripts` route tested in browser
- [ ] Gap-fill and MCQ exercises work end-to-end
- [ ] XP awards and persist to database
- [ ] Words appear in Flashcards after completion
- [ ] Animations play smoothly on target devices
- [ ] Error handling graceful (no console crashes)
- [ ] Performance acceptable (<3s generation time)
- [ ] Mobile responsiveness verified

✨ You're all set to launch Phase 1!
