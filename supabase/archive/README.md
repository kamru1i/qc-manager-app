# Supabase Archive — Historical SQL Patches

> **⛔ DO NOT RUN these files against any database.**
>
> All files in this directory have been renamed to `.sql.archived` to prevent
> accidental execution via CLI tools (`psql`, `supabase db execute`, etc.).
>
> These are **superseded** function and policy definitions kept only as
> historical evidence. The authoritative replayable state is the ordered
> migration chain beginning at
> `supabase/migrations/20260811074118_remote_schema.sql`.

## Why `.sql.archived`?

Several of these files contain stripped-down or outdated function definitions
that are **missing security guards** present in the live production database.
Re-executing them would silently overwrite production functions and could:

- Remove role/permission checks from `update_global_settings_key()` (allowing
  any authenticated user to modify admin feature flags)
- Regress RLS policies on the `records` table
- Downgrade `admin_update_user_credentials()` permission hierarchy

Renaming to `.sql.archived` ensures that no SQL runner, IDE plugin, or CLI
tool will accidentally treat them as executable SQL.

## Files

| File | Original Purpose | Audit Codes |
|---|---|---|
| `fix_user_self_edit_privilege_escalation.sql.archived` | Canonical `check_profile_updates()` trigger | C1, C3, H3 |
| `allow_supervisors_update_user_credentials.sql.archived` | `admin_update_user_credentials()` hierarchy guard | H1 |
| `create_mistakes_table.sql.archived` | `quotation_mistakes` table + role-based RLS | C2 |
| `fix_global_settings_race.sql.archived` | `update_global_settings_key()` atomic JSONB RPC | M9 |
| `fix_leaderboard_sargable.sql.archived` | Sargable `get_leaderboard_data()` + indexes | H6 |
| `fix_records_rls_and_sales_summary_guard.sql.archived` | Records RLS team-scoping + sales summary guard | H2, H7 |
| `fix_superadmin_profile_updates.sql.archived` | **DEPRECATED** — neutralized no-op | C3 |
| `add_role_guards_to_security_definer.sql.archived` | **DEPRECATED** — neutralized no-op | — |

## Future Changes

Do not edit or copy SQL from this archive into an active migration. Compare
against the **live database** (not `schema.sql`) and add a new timestamped
migration instead.

All future database changes should use the Supabase migration workflow:

```bash
# 1. Create a new migration
npx supabase migration new <descriptive_name>

# 2. Edit the generated file in supabase/migrations/

# 3. Deploy to remote
npx supabase db push --linked
```
