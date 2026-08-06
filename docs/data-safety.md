# Google Play — Data Safety form answers

Paste-ready answers for the Play Console **Data Safety** section. Every question
you must answer is here in Play Console's own wording, followed by the LinguaScript
answer and the reasoning.

Last reviewed: 2026-08-04.

---

## 1. Does your app collect or share any of the required user data types?

**Yes.**

## 2. Is all of the user data collected by your app encrypted in transit?

**Yes.** All API traffic goes to Supabase over HTTPS (TLS 1.2+). Push tokens are
delivered to Expo/FCM over HTTPS.

## 3. Do you provide a way for users to request that their data be deleted?

**Yes.** Users can email rowan@linguascript.xyz to request deletion. The account
and all associated rows are removed within 30 days (see Privacy Policy).

## 4. Have you committed to following the Google Play Families Policy?

**No** (app is not primarily targeted at children).

---

## Data types collected

Declare each data type you actually touch. Everything below is what LinguaScript
mobile collects; anything not listed here you should NOT declare.

### Personal info

| Data type   | Collected | Shared | Purpose(s)                        | Optional? |
| ----------- | --------- | ------ | --------------------------------- | --------- |
| Email address | Yes     | No     | Account management, Communications | Required |
| Name (display name) | Yes | No | Account management, App functionality | Optional |
| User IDs    | Yes       | No     | Account management, App functionality, Analytics | Required |

Notes:
- Email is used for the magic-link sign-in flow.
- Display name is chosen by the user and shown on their profile / leaderboard.
- The "User ID" is the Supabase user UUID + the Expo push token per install.

### App activity

| Data type              | Collected | Shared | Purpose(s)                    | Optional? |
| ---------------------- | --------- | ------ | ----------------------------- | --------- |
| App interactions       | Yes       | No     | App functionality, Analytics  | Required  |
| In-app search history  | Yes       | No     | App functionality             | Required  |
| Other user-generated content | Yes | No   | App functionality             | Required  |

Notes:
- App interactions = watch history, flashcard reviews, XP events, streak activity.
- Search history = only the vocabulary search bar; scoped to the user.
- User-generated content = the words the user saves to their vocabulary and any
  display name / avatar they upload.

### App info and performance

| Data type       | Collected | Shared | Purpose(s)             | Optional? |
| --------------- | --------- | ------ | ---------------------- | --------- |
| Crash logs      | Yes       | No     | Analytics              | Required  |
| Diagnostics     | Yes       | No     | Analytics              | Required  |

Notes: Expo's built-in crash reporting; retained 30 days.

### Device or other IDs

| Data type          | Collected | Shared | Purpose(s)                | Optional? |
| ------------------ | --------- | ------ | ------------------------- | --------- |
| Device or other IDs | Yes      | No     | App functionality         | Required  |

Notes:
- The Expo push token is a per-install identifier delivered by Expo/FCM. It is
  used to deliver push notifications. It is NOT the Android Advertising ID.
- No advertising IDs are collected.

---

## Data types NOT collected

For clarity when filling the form, LinguaScript does NOT collect:

- Location (approximate or precise)
- Financial info (payments are handled by RevenueCat / Google Play Billing; those
  providers collect payment data — LinguaScript never sees card numbers)
- Health & fitness
- Messages
- Photos or videos
- Audio files (voice pronunciation feature is planned; not shipping in v1)
- Files & docs
- Calendar
- Contacts
- Web browsing history
- Advertising ID
- Sexual orientation, race, ethnicity, political / religious views
- Any data from installed apps

---

## Third-party SDKs & where data goes

Declare these under the "Third-party providers" section if asked:

| Provider                    | What it receives                              | Purpose            |
| --------------------------- | --------------------------------------------- | ------------------ |
| Supabase (Postgres, Auth, Storage, Edge Functions) | All account and app data | Backend            |
| Expo Push / Google FCM      | Push tokens + notification content            | Notification delivery |
| Google Sign-In              | Google account ID + email (only if user opts in) | Authentication  |
| YouTube (embedded iframe)   | Video ID, playback events                     | Content playback   |

---

## App access

- **Camera:** not requested (planned future feature — will re-declare)
- **Microphone:** not requested in v1 (pronunciation practice is a future feature — will re-declare)
- **Location:** not requested
- **Notifications (POST_NOTIFICATIONS on Android 13+):** requested, purpose:
  "Send you daily study reminders and flashcards-due alerts."
- **Exact alarms (SCHEDULE_EXACT_ALARM):** requested for reliable daily reminders.

---

## Content rating (IARC questionnaire)

Answer honestly — LinguaScript is:

- Educational language-learning app
- No violence, no sexual content, no profanity, no drug references
- No user-generated content that is broadcast (vocabulary is private per user)
- No unrestricted internet browsing
- No social features beyond an opt-in friends leaderboard

Expected rating: **Everyone / PEGI 3**.

---

## Ads

- **Does your app contain ads?** **No.** (LinguaScript does not display ads.)

---

## Store listing — required text

**Short description (80 char max):**
> Learn languages by watching real films with tap-to-save subtitles.

**Full description (draft — refine with your own copy):**
See `store-listing.md` (or paste your own).

**Category:** Education

**Tags (up to 5):**
Education · Language Learning · Vocabulary · Flashcards · Video

---

## Submission checklist

- [ ] Privacy Policy URL published at https://linguascript.xyz/privacy (already live)
- [ ] Data Safety form filled per above
- [ ] Content rating questionnaire completed
- [ ] App icon (512x512 PNG) uploaded — from `mobile/assets/images/icon.png`
- [ ] Feature graphic (1024x500) uploaded — from `mobile/assets/images/feature-graphic.png`
- [ ] Screenshots uploaded (min 2 phone screenshots)
- [ ] Target API level 34+ verified (Expo SDK 51 default)
- [ ] 64-bit build verified (Expo default)
- [ ] .aab uploaded (produced by `eas build --profile production`)
- [ ] Internal testing → closed testing → production track
