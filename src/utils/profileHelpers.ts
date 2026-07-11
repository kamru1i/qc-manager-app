/**
 * Maps a raw profile row from Supabase to include the virtual `password_reset_status` field.
 * `password_reset_status` is stored inside `global_settings` JSONB but consumed
 * as a top-level field throughout the app. This helper centralizes the 6+ duplicated
 * mapping expressions.
 */
export function mapProfilePasswordResetStatus<T extends Record<string, any>>(profile: T): T & { password_reset_status: string } {
  return {
    ...profile,
    password_reset_status:
      profile.password_reset_status ||
      (profile.global_settings as Record<string, string> | undefined)?.password_reset_status ||
      'none',
  };
}
