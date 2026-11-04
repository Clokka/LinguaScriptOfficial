/** A Pro flag is valid only while its optional grant has not expired. */
export function hasActivePro(profile: { is_pro?: boolean | null; pro_expires_at?: string | null } | null, now = Date.now()): boolean {
  if (profile?.is_pro !== true) return false;
  if (!profile.pro_expires_at) return true;
  const expiry = Date.parse(profile.pro_expires_at);
  return Number.isFinite(expiry) && expiry > now;
}