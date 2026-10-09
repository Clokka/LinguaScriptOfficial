import { supabase } from "@/integrations/supabase/client";

let synced = false;

/**
 * Save the browser's time zone on the profile so push reminders
 * (dispatch-push-notifications) arrive at the learner's local time and never
 * in their quiet hours. Once per page load.
 */
export async function syncTimezone(userId: string): Promise<void> {
  if (synced) return;
  synced = true;
  let tz: string | undefined;
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return;
  }
  if (!tz) return;
  await supabase
    .from("profiles")
    .update({ timezone: tz } as any)
    .eq("user_id", userId)
    .neq("timezone", tz);
}
