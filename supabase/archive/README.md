# Supabase Archive — Historical SQL Patches

> **⚠️ DO NOT RUN these files directly.** This directory is outside
> `supabase/migrations/`, is never part of `db push`, and contains superseded
> function and policy definitions kept only as historical evidence. The
> authoritative replayable state is the ordered migration chain beginning at
> `supabase/migrations/20260811074118_remote_schema.sql`.

## What's in this directory?

These are **historical SQL patch files** that were manually applied before the
migration framework was established. Some definitions are intentionally stale;
copying or executing them can regress current authorization and performance
controls. They are preserved for the audit trail only.

## Files

| File | Original Purpose | Audit Codes |
|---|---|---|
| `fix_user_self_edit_privilege_escalation.sql` | Canonical `check_profile_updates()` trigger | C1, C3, H3 |
| `allow_supervisors_update_user_credentials.sql` | `admin_update_user_credentials()` hierarchy guard | H1 |
| `create_mistakes_table.sql` | `quotation_mistakes` table + role-based RLS | C2 |
| `fix_global_settings_race.sql` | `update_global_settings_key()` atomic JSONB RPC | M9 |
| `fix_leaderboard_sargable.sql` | Sargable `get_leaderboard_data()` + indexes | H6 |
| `fix_records_rls_and_sales_summary_guard.sql` | Records RLS team-scoping + sales summary guard | H2, H7 |
| `fix_superadmin_profile_updates.sql` | **DEPRECATED** — neutralized no-op | C3 |
| `add_role_guards_to_security_definer.sql` | **DEPRECATED** — neutralized no-op | — |

## Future Changes

Do not edit or copy SQL from this archive into an active migration. Compare
against `supabase/schema.sql` and add a new timestamped migration instead.

All future database changes should use the Supabase migration workflow:

```bash
# 1. Create a new migration
npx supabase migration new <descriptive_name>

# 2. Edit the generated file in supabase/migrations/

# 3. Deploy to remote
npx supabase db push --linked
```
