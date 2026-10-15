// Learner choices kept in localStorage (onboarding answers, the chosen
// language, guest onboarding) belong to ONE person. They used to outlive
// sign-out, so the next person on the same browser inherited them — a new
// Thai learner was signed up as Japanese from an earlier account's answers.
//
// Rules: wipe them on sign-out; drop guest answers older than MAX_AGE; and
// forget the cached language when a different account signs in.

const KEYS = [
  "learningLanguage",
  "ls.pendingLearningLanguage",
  "ls.onboardingState.v1",
  "ls.guestOnboarded.v1",
  "ls.guestProfile.v1",
];
const LAST_USER_KEY = "ls.lastUserId";

/** Guest/onboarding answers older than this are someone else's, or stale. */
export const LEARNER_STATE_MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000;

export function clearLearnerDeviceState() {
  try { KEYS.forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ }
}

/** True when a saved snapshot is recent enough to resume. Unstamped = stale. */
export function isFreshSnapshot(saved: { savedAt?: number } | null | undefined): boolean {
  return !!saved?.savedAt && Date.now() - saved.savedAt < LEARNER_STATE_MAX_AGE_MS;
}

/**
 * Called when an account signs in. A different account than last time means
 * the cached learning language is not theirs.
 */
export function noteSignedInUser(userId: string) {
  try {
    const last = localStorage.getItem(LAST_USER_KEY);
    if (last && last !== userId) localStorage.removeItem("learningLanguage");
    localStorage.setItem(LAST_USER_KEY, userId);
  } catch { /* ignore */ }
}
