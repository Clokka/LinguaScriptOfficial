# LinguaScripts Feature: The Killer Feature

## Overview

LinguaScripts are the core of LinguaScript's learning model. They represent words captured from real Netflix/YouTube content, organized into structured exercises to help users learn vocabulary through spaced repetition.

**Key principle:** Everything orbits LinguaScripts. The entire app experience is designed around this single feature.

## User Journey

### 1. Capture Phase (While Watching)
- User watches Netflix/YouTube with subtitles
- Clicks any word in the subtitle
- Word is saved as a "saved word" with context phrase
- Example: clicks "café" in "Je vais au café ce matin"
  - Captures: word="café", context_phrase="Je vais au café ce matin"

### 2. Review Phase (Daily LinguaScripts)
- **Home page alert:** "🔥 3 LinguaScripts Ready for Review"
- User starts session
- Completes 3 exercises (Gap-Fill, MCQ, Speaking)
- Each exercise shows the captured context phrase
- Confetti on completion
- Result: 3 words now have appearance_count=1

### 3. Reinforce Phase (Next Day Flashcards)
- Alert: "⏰ 6 Reinforcement Reviews Ready Tomorrow"
- Words with appearance_count >= 3 graduate to flashcard reviews
- Different exercise types, tighter spaced repetition
- Result: Long-term retention through distributed practice

## Home Page States

The home page intelligently shows one state at a time:

### State 1: "LinguaScripts Pending"
Shows when appearance_count < 3 for any word
```
🔥 3 LinguaScripts Ready for Review
Review the words you learned before they fade from memory
[START DAILY LINGUASCRIPTS]
```

### State 2: "LinguaScripts Complete"
Shows when all pending LinguaScripts reviewed today
```
✅ All LinguaScripts Complete!
You've reviewed 3 words today
💡 Pro tip: Click words in subtitles to add them to LinguaScripts
[CONTINUE WATCHING] [DISCOVER NEW CONTENT]
```

### State 3: "Flashcards Due"
Shows when words are ready for reinforcement
```
⏰ 6 Reinforcement Reviews Ready Tomorrow
Come back tomorrow to review them
Next review: Tomorrow at 9:00 AM
```

## Component Architecture

```
HomePage (Browse.tsx)
├── useLinguaScriptStatus (hook)
│   ├── Counts pending LinguaScripts
│   ├── Counts due flashcards
│   └── Returns home state
├── LinguaScriptsPendingAlert
│   └── Hero CTA to start session
├── LinguaScriptSessionFlow
│   ├── Loads 10 words
│   ├── Loops through exercises
│   ├── Shows LinguaScriptExercise
│   └── Session summary
├── LinguaScriptExercise
│   ├── Gap-Fill mode
│   ├── MCQ mode
│   ├── Speaking mode (placeholder)
│   └── Logs review (no state changes)
└── LinguaScriptsCompleteCard
    └── Post-session guidance
```

## Database Schema

### saved_words Table (New Columns)
```
id: UUID
user_id: UUID
word: TEXT
translation: TEXT
language: TEXT
context_phrase: TEXT         ← NEW: "Je vais au café ce matin"
context_translation: TEXT    ← NEW: "I'm going to the cafe this morning"
appearance_count: INT        ← NEW: tracks reviews (0-3+)
next_review_at: TIMESTAMP    ← NEW: for future SRS
last_reviewed_at: TIMESTAMP  ← NEW: when user last reviewed
last_correct_at: TIMESTAMP   ← NEW: when user last got it right
state: TEXT                  ← EXISTING: red/orange/green
```

### linguascript_reviews Table (New)
```
id: UUID (PK)
user_id: UUID (FK → auth.users)
word_id: UUID (FK → saved_words)
correct: BOOLEAN
mode: TEXT (gap-fill | mcq | speaking)
timestamp: TIMESTAMP
created_at: TIMESTAMP
```

## Data Flow

```
User Action                     Database Update
─────────────────────────────────────────────────
1. Click word in subtitle   →   saved_words INSERT
   (while watching)             + context_phrase
                                + context_translation

2. Complete LinguaScript    →   linguascript_reviews INSERT
   exercise                     + saved_words.appearance_count++
                                + saved_words.last_reviewed_at

3. Word hits appearance_3   →   saved_words.next_review_at SET
   (future: when algorithm     (for spaced repetition)
    validates)
```

## MVP Behavior (v1)

✅ Capture words with context from Netflix/YouTube
✅ Show "X LinguaScripts Ready" on home page
✅ Multi-exercise session flow
✅ Context phrases in exercises
✅ Log all reviews (no auto-state updates yet)
✅ Post-session guidance ("now go watch more")

🚀 Future (v2):
- Automatic state transitions based on review data
- Demotion if user forgets
- Spaced repetition intervals
- Speaking exercise
- Multiplayer/friend features

## Feature Flags / Config

```typescript
// LinguaScripts settings (in src/lib/config.ts)
export const LINGUASCRIPT_CONFIG = {
  MAX_DAILY_LINGUASCRIPTS: 10,        // Max in session
  APPEARANCE_THRESHOLD_FOR_FLASHCARD: 3,  // When to move to flashcards
  CONTEXT_REQUIRED: false,            // Enforce context phrase capture
  AUTO_STATE_TRANSITIONS: false,      // Don't auto-promote yet
};
```

## Testing

### Manual Testing
1. Ensure Supabase schema is updated (see SUPABASE_SCHEMA_UPDATES.md)
2. Go to `/discover` (home page)
3. If no saved words exist, create some manually via Supabase
4. Refresh home → should show pending LinguaScripts alert
5. Click "START" → should see multi-exercise session
6. Complete exercises → should see session summary
7. Refresh → should show "Complete" or "Flashcards Due" state

### Debug Queries
```sql
-- See all saved words for current user
SELECT id, word, appearance_count, context_phrase 
FROM saved_words 
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC;

-- See review logs
SELECT word_id, correct, mode, timestamp 
FROM linguascript_reviews 
WHERE user_id = 'YOUR_USER_ID'
ORDER BY timestamp DESC;
```

## Performance Notes

- Home page status check runs on every visit (refetch available)
- Session loads max 10 words at a time (configurable)
- Reviews logged asynchronously (don't block UI)
- Indexes recommended on saved_words for query speed

## Known Limitations (v1)

- No speaking exercise implementation yet (placeholder)
- No actual SRS algorithm (just appearance counting)
- No demotion logic
- Context phrase capture requires manual entry (future: auto-extract from video API)
- No multiplayer/sharing features
