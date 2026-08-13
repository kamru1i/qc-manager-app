import fs from "node:fs";
import pg from "pg";

function getEnvValue(name) {
  const raw = fs.readFileSync(".env.local", "utf8");
  const line = raw
    .split(/\r?\n/)
    .find((entry) => entry.startsWith(`${name}=`));

  if (!line) {
    throw new Error(`${name} is not configured`);
  }

  const value = line.slice(line.indexOf("=") + 1).trim();
  return value.replace(/^(["'])|(["'])$/g, "");
}

const client = new pg.Client({
  connectionString: getEnvValue("SUPABASE_DB_URL"),
  ssl: { rejectUnauthorized: false },
  application_name: "qc-manager-read-only-forensic-audit",
});

const queries = {
  metadata: `
    select
      current_setting('server_version') as server_version,
      current_setting('transaction_read_only') as transaction_read_only
  `,
  migrations: `
    select version, name, statements
    from supabase_migrations.schema_migrations
    order by version
  `,
  tables: `
    select
      n.nspname as schema_name,
      c.relname as table_name,
      c.relrowsecurity as rls_enabled,
      c.relforcerowsecurity as force_rls,
      coalesce(s.n_live_tup, c.reltuples)::bigint as estimated_rows,
      pg_relation_size(c.oid) as table_bytes,
      pg_total_relation_size(c.oid) as total_bytes,
      s.seq_scan,
      s.idx_scan,
      s.n_tup_ins,
      s.n_tup_upd,
      s.n_tup_del
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    left join pg_stat_user_tables s
      on s.relid = c.oid
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
    order by c.relname
  `,
  columns: `
    select
      table_name,
      ordinal_position,
      column_name,
      data_type,
      udt_name,
      is_nullable,
      column_default
    from information_schema.columns
    where table_schema = 'public'
    order by table_name, ordinal_position
  `,
  policies: `
    select
      schemaname,
      tablename,
      policyname,
      permissive,
      roles,
      cmd,
      qual,
      with_check
    from pg_policies
    where schemaname = 'public'
    order by tablename, policyname
  `,
  functions: `
    select
      n.nspname as schema_name,
      p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as identity_arguments,
      pg_get_function_result(p.oid) as result_type,
      l.lanname as language,
      p.prosecdef as security_definer,
      p.provolatile as volatility,
      p.proconfig as runtime_config,
      pg_get_userbyid(p.proowner) as owner,
      p.proacl as acl,
      pg_get_functiondef(p.oid) as definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_language l on l.oid = p.prolang
    where n.nspname = 'public'
    order by p.proname, pg_get_function_identity_arguments(p.oid)
  `,
  routine_privileges: `
    select routine_name, specific_name, grantee, privilege_type
    from information_schema.routine_privileges
    where routine_schema = 'public'
    order by routine_name, grantee, privilege_type
  `,
  indexes: `
    select
      i.tablename,
      i.indexname,
      i.indexdef,
      pg_relation_size(format('%I.%I', i.schemaname, i.indexname)::regclass) as index_bytes,
      s.idx_scan
    from pg_indexes i
    left join pg_stat_user_indexes s
      on s.schemaname = i.schemaname
      and s.indexrelname = i.indexname
    where i.schemaname = 'public'
    order by i.tablename, i.indexname
  `,
  triggers: `
    select
      event_object_table as table_name,
      trigger_name,
      action_timing,
      event_manipulation,
      action_statement,
      action_condition
    from information_schema.triggers
    where trigger_schema = 'public'
    order by event_object_table, trigger_name, event_manipulation
  `,
  constraints: `
    select
      c.conrelid::regclass::text as table_name,
      c.conname as constraint_name,
      c.contype as constraint_type,
      c.convalidated as validated,
      pg_get_constraintdef(c.oid, true) as definition
    from pg_constraint c
    join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public'
    order by c.conrelid::regclass::text, c.conname
  `,
  publications: `
    select pubname, schemaname, tablename, attnames, rowfilter
    from pg_publication_tables
    where schemaname = 'public'
    order by pubname, tablename
  `,
  table_privileges: `
    select table_name, grantee, privilege_type
    from information_schema.table_privileges
    where table_schema = 'public'
      and grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC')
    order by table_name, grantee, privilege_type
  `,
  views: `
    select
      c.relname as view_name,
      c.relkind,
      c.reloptions,
      pg_get_viewdef(c.oid, true) as definition
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('v', 'm')
    order by c.relname
  `,
  extensions: `
    select extname, extversion
    from pg_extension
    order by extname
  `,
  replica_identity: `
    select
      n.nspname as schema_name,
      c.relname as table_name,
      c.relreplident as replica_identity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
    order by c.relname
  `,
  profile_role_counts: `
    select role, count(*)::int as count
    from public.profiles
    group by role
    order by role
  `,
  profile_settings_metrics: `
    select
      count(*)::int as profile_count,
      round(avg(pg_column_size(global_settings)))::int as avg_settings_bytes,
      max(pg_column_size(global_settings))::int as max_settings_bytes,
      sum(pg_column_size(global_settings))::bigint as total_settings_bytes
    from public.profiles
  `,
  profile_settings_keys: `
    select key, count(*)::int as profile_count
    from public.profiles p
    cross join lateral jsonb_object_keys(coalesce(p.global_settings, '{}'::jsonb)) as key
    group by key
    order by key
  `,
  active_session_shapes: `
    select
      jsonb_typeof(global_settings->'active_sessions') as json_type,
      count(*)::int as profile_count
    from public.profiles
    where global_settings ? 'active_sessions'
    group by jsonb_typeof(global_settings->'active_sessions')
    order by json_type
  `,
  recent_record_counts: `
    select
      to_char(date_trunc('month', submitted_at), 'YYYY-MM') as month,
      count(*)::int as row_count,
      round(avg(pg_column_size(r)))::int as avg_row_bytes
    from public.records r
    where submitted_at >= date_trunc('month', now()) - interval '23 months'
    group by date_trunc('month', submitted_at)
    order by date_trunc('month', submitted_at)
  `,
  recent_chuti_counts: `
    select
      to_char(date_trunc('month', date), 'YYYY-MM') as month,
      count(*)::int as row_count,
      round(avg(pg_column_size(c)))::int as avg_row_bytes
    from public.chuti c
    where date >= date_trunc('month', current_date) - interval '23 months'
    group by date_trunc('month', date)
    order by date_trunc('month', date)
  `,
  top_statements: `
    select
      queryid::text,
      calls,
      rows,
      round(total_exec_time::numeric, 2) as total_exec_time_ms,
      round(mean_exec_time::numeric, 2) as mean_exec_time_ms,
      shared_blks_hit,
      shared_blks_read,
      temp_blks_read,
      temp_blks_written,
      left(regexp_replace(query, '[[:space:]]+', ' ', 'g'), 800) as query
    from extensions.pg_stat_statements
    where dbid = (select oid from pg_database where datname = current_database())
      and query ~* '(profiles|records|chuti|quotation_mistakes|govt_holiday_responses|leave_settlements|compliance_rules)'
    order by total_exec_time desc
    limit 60
  `,
  cron_jobs: `
    select jobid, schedule, command, nodename, database, active
    from cron.job
    order by jobid
  `,
};

await client.connect();

try {
  await client.query("begin read only");
  const audit = {};

  for (const [name, sql] of Object.entries(queries)) {
    const { rows } = await client.query(sql);
    audit[name] = rows;
  }

  await client.query("commit");
  fs.writeFileSync(
    "/private/tmp/qc-manager-live-catalog.json",
    `${JSON.stringify(audit, null, 2)}\n`,
  );
  console.log(
    JSON.stringify({
      output: "/private/tmp/qc-manager-live-catalog.json",
      sections: Object.fromEntries(
        Object.entries(audit).map(([name, rows]) => [name, rows.length]),
      ),
    }),
  );
} catch (error) {
  await client.query("rollback").catch(() => {});
  throw error;
} finally {
  await client.end();
}
