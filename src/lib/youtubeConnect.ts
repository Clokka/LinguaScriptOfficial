// "Connect YouTube": reuses the same Google OAuth identity already used for
// sign-in, re-requesting it with an added `youtube.force-ssl` scope so the
// app can subscribe the learner to target-language channels on their behalf.
//
// Deliberately does NOT use a second, separate Google OAuth client — it
// piggybacks on whatever's already configured in Supabase Authentication ->
// Providers -> Google, so no new client/redirect-URI setup is needed.
import { supabase } from "@/integrations/supabase/client";

const YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube.force-ssl";
export const YT_CONNECT_RETURN_PARAM = "yt";
export const YT_CONNECT_RETURN_VALUE = "connect";

/**
 * Kick off the OAuth round trip. Which Supabase method to call matters:
 * `linkIdentity` is for attaching Google to an account that doesn't have it
 * yet (what the existing "Link Google account" button uses); it throws
 * `identity_already_exists` on a second call. For a learner who already
 * signed in with Google, re-running `signInWithOAuth` against the SAME
 * Google account instead re-authenticates to this same Supabase user
 * (matched by provider + provider id) and comes back with fresh tokens
 * carrying the new scope — that's Supabase's own documented path for
 * requesting additional scopes on an already-linked identity, not a
 * workaround. Calling `signInWithOAuth` on an account that never linked
 * Google at all would risk creating or switching to a different account, so
 * the branch here is load-bearing, not cosmetic.
 */
export async function startYouTubeConnect(alreadyLinkedGoogle: boolean): Promise<{ error?: string }> {
  const options = {
    scopes: YOUTUBE_SCOPE,
    // access_type=offline asks for a refresh_token so subscribing doesn't
    // require the learner to re-consent every hour; prompt=consent forces
    // Google to show (and re-issue tokens for) the screen even though
    // they've signed in with Google before, since a silent re-auth would
    // skip granting the new scope.
    queryParams: { access_type: "offline", prompt: "consent" },
    redirectTo: `${window.location.origin}/profile?${YT_CONNECT_RETURN_PARAM}=${YT_CONNECT_RETURN_VALUE}`,
  };
  const { error } = alreadyLinkedGoogle
    ? await supabase.auth.signInWithOAuth({ provider: "google", options })
    : await (supabase.auth as any).linkIdentity({ provider: "google", options });
  return { error: error?.message };
}

/**
 * Call once on the page that receives the OAuth redirect back. Supabase
 * surfaces the provider's access/refresh token on `session.provider_token`/
 * `provider_refresh_token` ONLY right after this specific round trip — it
 * isn't persisted across normal session refreshes — so this has to capture
 * and hand them to the backend for storage immediately or they're gone.
 */
export async function captureYouTubeConnection(): Promise<{ ok: boolean; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  const providerToken = (session as any)?.provider_token as string | undefined;
  const providerRefreshToken = (session as any)?.provider_refresh_token as string | undefined;
  if (!providerToken) {
    return { ok: false, error: "No YouTube access token in this session — try connecting again." };
  }
  const { error } = await supabase.functions.invoke("youtube-store-connection", {
    body: {
      access_token: providerToken,
      refresh_token: providerRefreshToken || null,
      expires_in: 3600,
      scope: YOUTUBE_SCOPE,
    },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export interface YouTubeConnectionStatus {
  connected: boolean;
  connectedAt: string | null;
  channelCount: number;
}

export async function getYouTubeConnectionStatus(): Promise<YouTubeConnectionStatus> {
  const { data, error } = await (supabase as any).rpc("youtube_connection_status");
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) return { connected: false, connectedAt: null, channelCount: 0 };
  return { connected: !!row.connected, connectedAt: row.connected_at ?? null, channelCount: row.channel_count ?? 0 };
}

export interface SubscribeResult {
  channelId: string;
  channelTitle: string;
  source: "core" | "niche";
  interestId: string | null;
  languageVerified: boolean;
  subscribed: boolean;
}

export async function subscribeToLanguageChannels(
  language: string,
  interestIds: string[],
): Promise<{ results: SubscribeResult[]; errors: string[]; error?: string }> {
  const { data, error } = await supabase.functions.invoke("youtube-subscribe", {
    body: { language, interestIds },
  });
  if (error) return { results: [], errors: [], error: error.message };
  return { results: (data as any)?.results || [], errors: (data as any)?.errors || [] };
}

export interface SubscribedChannel {
  channel_id: string;
  channel_title: string | null;
  source: "core" | "niche";
  language: string;
  language_verified: boolean;
}

export async function listSubscribedChannels(): Promise<SubscribedChannel[]> {
  const { data } = await (supabase as any)
    .from("youtube_subscribed_channels")
    .select("channel_id, channel_title, source, language, language_verified")
    .order("subscribed_at", { ascending: false });
  return (data as any[]) || [];
}
