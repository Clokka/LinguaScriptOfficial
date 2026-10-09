// A guest can finish onboarding before they have an account. Their answers
// are kept on the device and copied onto the profile the first time they sign
// in, so signing in never sends them back through onboarding.
import { supabase } from "@/integrations/supabase/client";
import { videoGoalForWords } from "@/lib/progressStats";
import { addLanguageProfile, type LearningMode } from "@/lib/languageProfiles";

const KEY = "ls.guestOnboarded.v1";

export interface GuestOnboarding {
  native: string;
  target: string;
  level: string | null;
  mode: LearningMode;
  school: string;
  wordGoal: number;
  goal: string;
  interests: string[];
  showOnLeaderboard: boolean;
}

export function rememberGuestOnboarding(answers: GuestOnboarding) {
  try { localStorage.setItem(KEY, JSON.stringify(answers)); } catch { /* ignore */ }
}

function readGuestOnboarding(): GuestOnboarding | null {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.target ? parsed : null;
  } catch { return null; }
}

/**
 * Copies finished guest onboarding onto the signed-in user's profile.
 * Returns true when the user should be treated as onboarded.
 */
export async function applyGuestOnboarding(userId: string): Promise<boolean> {
  const answers = readGuestOnboarding();
  if (!answers) return false;

  const isTotalBeginner = answers.level === "beginner";
  const storedLevel = isTotalBeginner ? "a1" : (answers.level || "a1").toLowerCase();
  const { error } = await supabase.from("profiles").update({
    onboarded: true,
    native_language: answers.native,
    learning_language: answers.target,
    cef_level: storedLevel,
    school: answers.school.trim() || null,
    daily_word_goal: answers.wordGoal,
    daily_video_goal: videoGoalForWords(answers.wordGoal),
    learning_goal: answers.goal.trim() || null,
    interests: answers.interests,
    show_on_global_leaderboard: answers.showOnLeaderboard,
    discoverable_by_search: answers.showOnLeaderboard,
  } as any).eq("user_id", userId);
  if (error) return false;

  try {
    await addLanguageProfile({
      userId,
      language: answers.target,
      mode: answers.mode,
      level: storedLevel,
      totalBeginner: isTotalBeginner,
    });
  } catch { /* seeding retried from Profile; never block sign-in */ }

  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem("ls.onboardingState.v1");
  } catch { /* ignore */ }
  return true;
}
