# Supabase Archive — Historical SQL Patches

> **⚠️ DO NOT RUN these files directly.** All changes from these files have
> been deployed to the production database and are now captured in the
> baseline migration at `supabase/migrations/20260811074118_remote_schema.sql`.

## What's in this directory?

These are the **historical SQL patch files** that were manually applied to the
production Supabase database before the migration framework was set up. They
are preserved here for **reference and audit trail** only.

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

All future database changes should use the Supabase migration workflow:

```bash
# 1. Create a new migration
npx supabase migration new <descriptive_name>

# 2. Edit the generated file in supabase/migrations/

# 3. Deploy to remote
npx supabase db push --linked
```
