import fs from "node:fs";
import { execFileSync } from "node:child_process";
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

const migrationValidationFiles = [
  "supabase/migrations/20260813090000_final_forensic_hardening.sql",
  "supabase/migrations/20260813170000_workspace_and_kpi_integrity.sql",
  "supabase/migrations/20260813180500_exclude_othersite_from_leaderboard.sql",
  "supabase/migrations/20260813181000_exclude_othersite_from_badges.sql",
  "supabase/migrations/20260813181500_exclude_othersite_from_archive.sql",
  "supabase/migrations/20260818180000_attendance_module.sql",
  "supabase/migrations/20260820120000_final_lint_attendance_hardening.sql",
  "supabase/migrations/20260820123000_profile_archive_badge_final_fix.sql",
  "supabase/migrations/20260820124500_revoke_attendance_trigger_execute.sql",
];

if (process.argv.includes("--dump-schema")) {
  const output = "/private/tmp/qc-manager-final-schema.sql";
  execFileSync(
    "/opt/homebrew/Cellar/libpq/18.4/bin/pg_dump",
    [
      "--schema-only",
      "--schema=public",
      "--no-owner",
      `--file=${output}`,
      getEnvValue("SUPABASE_DB_URL"),
    ],
    { stdio: ["ignore", "inherit", "inherit"] },
  );
  console.log(JSON.stringify({ schema_dump: output }));
  process.exit(0);
}

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
    select jobid, jobname, schedule, command, nodename, database, active
    from cron.job
    order by jobid
  `,
};

await client.connect();

try {
  const getPendingMigrationSql = async () => {
    const { rows } = await client.query("select version from supabase_migrations.schema_migrations");
    const applied = new Set(rows.map((row) => String(row.version)));
    return migrationValidationFiles
      .filter((file) => {
        const version = file.match(/\/(\d{14})_[^/]+\.sql$/)?.[1];
        return version && !applied.has(version);
      })
      .map((file) => fs.readFileSync(file, "utf8"))
      .join("\n");
  };

  if (process.argv.includes("--probe-runtime-functions")) {
    const probes = [
      {
        name: "sync_top_performer_badges",
        sql: "select public.sync_top_performer_badges()",
        params: [],
        role: "service_role",
      },
      {
        name: "archive_and_prune_old_records",
        sql: "select public.archive_and_prune_old_records('Asia/Dhaka')",
        params: [],
        role: "service_role",
      },
      {
        name: "create_configured_user",
        sql: `select public.create_configured_user(
          $1, 'Forensic-Test-Password-2026!', $2, 'user', 'Rollback Fixture',
          '{"default_sign_in":"09:30","default_sign_out":"18:00"}'::jsonb
        )`,
        params: [
          `forensic.rollback.${Date.now()}@example.invalid`,
          `ROLLBACK_${Date.now()}`,
        ],
        role: "admin",
      },
    ];
    const results = [];

    for (const probe of probes) {
      await client.query("begin");
      try {
        if (probe.role === "admin") {
          const { rows } = await client.query(`
            select p.id, u.email
            from public.profiles p
            left join auth.users u on u.id = p.id
            where p.role in ('superadmin', 'admin')
            order by case p.role when 'superadmin' then 1 else 2 end
            limit 1
          `);
          if (!rows[0]) throw new Error("No admin actor fixture found.");
          await client.query("set local role authenticated");
          await client.query("select set_config('request.jwt.claims', $1, true)", [
            JSON.stringify({ sub: rows[0].id, role: "authenticated", email: rows[0].email ?? "audit@example.invalid" }),
          ]);
        } else {
          await client.query("select set_config('request.jwt.claim.role', 'service_role', true)");
        }
        await client.query(probe.sql, probe.params);
        results.push({ name: probe.name, passed: true });
      } catch (error) {
        results.push({
          name: probe.name,
          passed: false,
          code: error.code ?? null,
          message: error.message,
        });
      } finally {
        await client.query("rollback");
      }
    }

    console.log(JSON.stringify({ runtime_function_probes: results }, null, 2));
    await client.end();
    process.exit(results.every(({ passed }) => passed) ? 0 : 1);
  }

  if (process.argv.includes("--security-tests") || process.argv.includes("--security-tests-live")) {
    const migrationSql = await getPendingMigrationSql();
    const assertions = [];

    const assert = (condition, name, evidence) => {
      if (!condition) {
        throw new Error(`${name} failed: ${JSON.stringify(evidence)}`);
      }
      assertions.push({ name, evidence });
    };
    const asActor = async (actor) => {
      await client.query("reset role");
      await client.query("set local role authenticated");
      await client.query(
        "select set_config('request.jwt.claims', $1, true)",
        [JSON.stringify({ sub: actor.id, role: "authenticated", email: actor.email ?? "audit@example.invalid" })],
      );
      await client.query(`
        select set_config('request.jwt.claim.role', 'authenticated', true),
               set_config('app.user_role', '', true),
               set_config('app.bypass_profile_security', '', true),
               set_config('app.bypass_chuti_security', '', true),
               set_config('app.bypass_settlement_security', '', true)
      `);
    };
    let savepointCounter = 0;
    const expectDenied = async (name, operation) => {
      const savepoint = `forensic_${++savepointCounter}`;
      await client.query(`savepoint ${savepoint}`);
      let result;
      let operationError;
      try {
        result = await operation();
      } catch (error) {
        operationError = error;
      }
      await client.query(`rollback to savepoint ${savepoint}`);
      if (!operationError) {
        assert(false, name, { unexpectedly_allowed: true, rowCount: result?.rowCount });
      }
      assertions.push({ name, evidence: { denied: true, code: operationError.code ?? null } });
    };
    const expectDeniedOrNoRows = async (name, operation) => {
      const savepoint = `forensic_${++savepointCounter}`;
      await client.query(`savepoint ${savepoint}`);
      let result;
      let operationError;
      try {
        result = await operation();
      } catch (error) {
        operationError = error;
      }
      await client.query(`rollback to savepoint ${savepoint}`);
      if (!operationError && result?.rowCount !== 0) {
        throw new Error(`${name} failed: ${JSON.stringify({
          unexpectedly_allowed: true,
          rowCount: result?.rowCount,
        })}`);
      }
      assertions.push({
        name,
        evidence: operationError
          ? { denied: true, code: operationError.code ?? null }
          : { denied: true, rowCount: 0 },
      });
    };

    await client.query("begin");
    if (!process.argv.includes("--security-tests-live") && migrationSql) {
      await client.query(migrationSql);
    }

    const { rows: actors } = await client.query(`
      select p.id, p.username, p.role, p.supervisor_ids,
             p.delegated_supervisor_id, p.delegated_leave_supervisor_id, u.email,
             (select count(*) from public.records r where r.user_id = p.id) as record_count,
             (select count(*) from public.chuti c where c.user_id = p.id) as leave_count
      from public.profiles p
      left join auth.users u on u.id = p.id
      where p.role in ('user', 'supervisor', 'admin', 'superadmin')
      order by
        case p.role when 'user' then 1 when 'supervisor' then 2 when 'admin' then 3 else 4 end,
        ((select count(*) from public.records r where r.user_id = p.id)
          + (select count(*) from public.chuti c where c.user_id = p.id)) desc
    `);
    const user = actors.find((actor) => actor.role === "user");
    const supervisor = actors.find((actor) => actor.role === "supervisor");
    const admin = actors.find((actor) => actor.role === "admin");
    const superadmin = actors.find((actor) => actor.role === "superadmin");
    assert(Boolean(user && supervisor && admin && superadmin), "role fixtures exist", {
      user: Boolean(user), supervisor: Boolean(supervisor), admin: Boolean(admin), superadmin: Boolean(superadmin),
    });

    const tableOwnerIds = {};
    for (const table of ["records", "chuti", "quotation_mistakes", "leave_settlements"]) {
      const { rows } = await client.query(`select distinct user_id from public.${table}`);
      tableOwnerIds[table] = new Set(rows.map((row) => row.user_id));
    }
    const { rows: attendanceExists } = await client.query(`
      select to_regclass('public.attendance_daily') is not null
         and to_regclass('public.attendance_breaks') is not null as exists
    `);
    const hasAttendanceTables = attendanceExists[0]?.exists === true;
    let ownAttendanceId = null;
    let otherAttendanceId = null;
    let otherAttendanceDate = null;
    const otherAttendanceUser = actors.find((actor) => actor.id !== user.id && actor.role === "user")
      ?? actors.find((actor) => actor.id !== user.id);
    if (hasAttendanceTables && otherAttendanceUser) {
      await client.query("reset role");
      await client.query("select set_config('request.jwt.claim.role', 'service_role', true)");
      const ownAttendance = await client.query(`
        insert into public.attendance_daily (user_id, attendance_date, join_time, status)
        values ($1, current_date - 10, now(), 'WORKING')
        on conflict (user_id, attendance_date) do update
          set join_time = excluded.join_time,
              status = excluded.status
        returning id, attendance_date
      `, [user.id]);
      const otherAttendance = await client.query(`
        insert into public.attendance_daily (user_id, attendance_date, join_time, status)
        values ($1, current_date - 11, now(), 'WORKING')
        on conflict (user_id, attendance_date) do update
          set join_time = excluded.join_time,
              status = excluded.status
        returning id, attendance_date
      `, [otherAttendanceUser.id]);
      ownAttendanceId = ownAttendance.rows[0].id;
      otherAttendanceId = otherAttendance.rows[0].id;
      otherAttendanceDate = otherAttendance.rows[0].attendance_date;
      await client.query(`
        insert into public.attendance_breaks (attendance_id, user_id, attendance_date, type, start_time)
        values ($1, $2, current_date - 10, 'snack', now()),
               ($3, $4, current_date - 11, 'snack', now())
      `, [ownAttendanceId, user.id, otherAttendanceId, otherAttendanceUser.id]);
    }
    const directSupervisors = new Set(user.supervisor_ids ?? []);
    const expectedNormalProfileIds = new Set([user.id, ...directSupervisors]);
    for (const candidate of actors) {
      if (directSupervisors.has(candidate.id) && candidate.delegated_supervisor_id) {
        expectedNormalProfileIds.add(candidate.delegated_supervisor_id);
      }
    }

    await asActor(user);
    const { rows: visibleProfiles } = await client.query("select id from public.profiles order by id");
    const expectedProfiles = [...expectedNormalProfileIds]
      .sort()
      .map((id) => ({ id }));
    assert(
      JSON.stringify(visibleProfiles) === JSON.stringify(expectedProfiles),
      "normal user profile reads are scoped",
      { visible: visibleProfiles.length, expected: expectedProfiles.length },
    );

    for (const table of ["records", "chuti", "quotation_mistakes", "leave_settlements"]) {
      const { rows } = await client.query(`select distinct user_id from public.${table} order by user_id`);
      assert(
        JSON.stringify(rows.map((row) => row.user_id))
          === JSON.stringify(tableOwnerIds[table].has(user.id) ? [user.id] : []),
        `normal user ${table} reads are own-only`,
        { visible_user_ids: rows.map((row) => row.user_id) },
      );
    }
    if (hasAttendanceTables && otherAttendanceUser) {
      const { rows: visibleDaily } = await client.query("select distinct user_id from public.attendance_daily order by user_id");
      assert(
        JSON.stringify(visibleDaily.map((row) => row.user_id)) === JSON.stringify([user.id]),
        "normal user attendance reads are own-only",
        { visible_user_ids: visibleDaily.map((row) => row.user_id) },
      );
      const { rows: visibleBreaks } = await client.query("select distinct user_id from public.attendance_breaks order by user_id");
      assert(
        JSON.stringify(visibleBreaks.map((row) => row.user_id)) === JSON.stringify([user.id]),
        "normal user attendance break reads are own-only",
        { visible_user_ids: visibleBreaks.map((row) => row.user_id) },
      );
      await expectDeniedOrNoRows("normal user cannot attach a break to another attendance row", () => client.query(`
        insert into public.attendance_breaks (attendance_id, user_id, attendance_date, type, start_time)
        values ($1, auth.uid(), $2, 'prayer', now())
      `, [otherAttendanceId, otherAttendanceDate]));
    }

    await expectDenied("normal user cannot forge audit rows", () => client.query(`
      insert into public.audit_logs (actor_id, actor_codename, action_type, details)
      values (auth.uid(), 'forged', 'APPROVE_LEAVE', 'forged')
    `));
    await expectDenied("normal user cannot insert quotation mistakes", () => client.query(`
      insert into public.quotation_mistakes
        (date, filename, branch, user_id, codename, mistake_details, penalty)
      values (current_date, 'forensic', 'forensic', auth.uid(), 'forged', 'forensic', '0')
    `));
    await expectDenied("normal user cannot elevate profile role", () => client.query(
      "update public.profiles set role = 'admin' where id = auth.uid()",
    ));
    await expectDenied("normal user cannot alter global feature flags", () => client.query(`
      update public.profiles
      set global_settings = jsonb_set(coalesce(global_settings, '{}'::jsonb), '{feature_flags}', '{"quote_mistakes_write":true}'::jsonb)
      where id = auth.uid()
    `));
    await expectDenied("normal user cannot call badge synchronization", () => client.query(
      "select public.sync_top_performer_badges()",
    ));
    await expectDenied("normal user cannot call password-reset request RPC", () => client.query(
      "select public.request_password_reset('nobody@example.invalid')",
    ));
    await expectDenied("normal user cannot create approved leave", () => client.query(`
      insert into public.chuti (user_id, date, leave_type, status)
      values (auth.uid(), current_date, 'Full Leave', 'approved')
    `));

    const { rows: approvedLeaves } = await client.query(`
      select id from public.chuti
      where user_id = auth.uid() and status = 'approved' and deleted_at is null
      limit 1
    `);
    if (approvedLeaves[0]) {
      await expectDenied("normal user cannot edit approved leave details", () => client.query(
        "update public.chuti set comment = coalesce(comment, '') || ' forensic' where id = $1",
        [approvedLeaves[0].id],
      ));
      await expectDeniedOrNoRows("normal user cannot delete approved leave", () => client.query(
        "delete from public.chuti where id = $1",
        [approvedLeaves[0].id],
      ));
    } else {
      assertions.push({ name: "normal user approved-leave mutation fixture", evidence: { skipped: true } });
    }

    const { rows: ownRecords } = await client.query("select id from public.records where user_id = auth.uid() limit 1");
    if (ownRecords[0]) {
      await expectDeniedOrNoRows("normal user cannot reassign own record", () => client.query(
        "update public.records set user_id = $1 where id = $2",
        [supervisor.id, ownRecords[0].id],
      ));
    }

    const insertedKpi = await client.query(`
      insert into public.kpi_assessments (
        user_id, month_year, appraiser_name, appraiser_signed,
        appraiser_sign_date, kpis
      ) values (
        auth.uid(), 'forensic-' || gen_random_uuid()::text,
        'forged-appraiser', true, '01-01-2000',
        '{"weightages":{"quality":100},"supervisorScores":{"quality":100},"selfScores":{"quality":10},"comments":{"quality":"self"}}'::jsonb
      )
      returning id, appraiser_name, appraiser_signed, appraiser_sign_date, kpis
    `);
    const kpiRow = insertedKpi.rows[0];
    assert(
      !Object.hasOwn(kpiRow.kpis, "weightages")
        && !Object.hasOwn(kpiRow.kpis, "supervisorScores")
        && kpiRow.kpis.selfScores?.quality === 10
        && kpiRow.appraiser_name !== "forged-appraiser"
        && kpiRow.appraiser_signed === false
        && kpiRow.appraiser_sign_date === null,
      "employee KPI insert strips appraiser-controlled values",
      kpiRow,
    );
    const updatedKpi = await client.query(`
      update public.kpi_assessments
      set appraiser_name = 'forged-again',
          appraiser_signed = true,
          appraiser_sign_date = '01-01-2000',
          kpis = kpis || '{"weightages":{"quality":100},"supervisorScores":{"quality":100}}'::jsonb
      where id = $1
      returning appraiser_name, appraiser_signed, appraiser_sign_date, kpis
    `, [kpiRow.id]);
    assert(
      !Object.hasOwn(updatedKpi.rows[0].kpis, "weightages")
        && !Object.hasOwn(updatedKpi.rows[0].kpis, "supervisorScores")
        && updatedKpi.rows[0].appraiser_name === kpiRow.appraiser_name
        && updatedKpi.rows[0].appraiser_signed === false,
      "employee KPI update preserves appraiser-controlled values",
      updatedKpi.rows[0],
    );
    await expectDeniedOrNoRows("employee cannot delete authoritative KPI history", () =>
      client.query("delete from public.kpi_assessments where id = $1", [kpiRow.id])
    );

    const relationshipProbe = await client.query(
      "select public.has_leave_access($1, $2) as allowed",
      [supervisor.id, user.id],
    );
    assert(
      relationshipProbe.rows[0].allowed === false,
      "authenticated users cannot probe arbitrary supervisory relationships",
      relationshipProbe.rows[0],
    );

    // Simulate revocation without committing it, then prove every detailed
    // workspace path closes for the affected account.
    await client.query("reset role");
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: user.id, role: "service_role" }),
    ]);
    await client.query("select set_config('app.bypass_profile_security', 'true', true)");
    await client.query(`
      update public.profiles
      set has_chuti_access = false, has_quotes_access = false
      where id = $1
    `, [user.id]);
    await asActor(user);
    const workspaceState = await client.query(`
      select public.current_user_has_workspace('chuti') as chuti,
             public.current_user_has_workspace('quotes') as quotes
    `);
    assert(
      workspaceState.rows[0].chuti === false && workspaceState.rows[0].quotes === false,
      "workspace revocation resolves at the database boundary",
      workspaceState.rows[0],
    );
    for (const table of [
      "records", "chuti", "quotation_mistakes", "leave_settlements",
      "govt_holiday_responses", "compliance_rules", "login_codes",
    ]) {
      const result = await client.query(`select count(*)::int as count from public.${table}`);
      assert(
        result.rows[0].count === 0,
        `revoked account cannot read ${table}`,
        result.rows[0],
      );
    }
    await expectDeniedOrNoRows("revoked quotes account cannot insert records", () => client.query(`
      insert into public.records (user_id, file_name, branch_name, codename, file_type, submitted_at)
      values (auth.uid(), 'forensic', 'forensic', 'forensic', 'Quote', now())
    `));
    await expectDeniedOrNoRows("revoked leave account cannot insert leave", () => client.query(`
      insert into public.chuti (user_id, date, leave_type, status)
      values (auth.uid(), current_date, 'Full Leave', 'pending_supervisor')
    `));
    await expectDenied("revoked leave account cannot call conversion RPC", () => client.query(
      "select public.convert_short_leave_to_full_leave(auth.uid(), 'Office Leave')",
    ));

    await asActor(supervisor);
    for (const table of ["records", "chuti", "leave_settlements"]) {
      const { rows: visible } = await client.query(`select distinct user_id from public.${table} order by user_id`);
      const visibleIds = visible.map((row) => row.user_id);
      const expectedIds = actors
        .filter((candidate) => {
          const supervisors = candidate.supervisor_ids ?? [];
          const delegatedViaSupervisor = actors.some(
            (possibleSupervisor) => supervisors.includes(possibleSupervisor.id)
              && possibleSupervisor.delegated_supervisor_id === supervisor.id,
          );
          return candidate.id === supervisor.id
            || supervisors.includes(supervisor.id)
            || candidate.delegated_leave_supervisor_id === supervisor.id
            || delegatedViaSupervisor;
        })
        .map((candidate) => candidate.id)
        .filter((id) => tableOwnerIds[table].has(id))
        .sort();
      assert(
        JSON.stringify(visibleIds) === JSON.stringify(expectedIds),
        `supervisor ${table} reads exclude other teams`,
        { visible_user_ids: visibleIds, allowed_user_ids: expectedIds },
      );
    }

    await asActor(admin);
    await expectDenied("admin cannot reset a superadmin credential", () => client.query(
      "select public.admin_update_user_credentials($1, null, 'Forensic-Only-1234')",
      [superadmin.id],
    ));
    await expectDenied("admin cannot delete a superadmin account", () => client.query(
      "select public.delete_user_by_id($1)",
      [superadmin.id],
    ));

    await asActor(superadmin);
    const { rows: superadminContext } = await client.query(`
      select auth.uid() as uid, public.get_my_role() as role,
             public.can_write_quotation_mistakes() as can_write
    `);
    assert(
      superadminContext[0]?.uid === superadmin.id
        && superadminContext[0]?.role === "superadmin"
        && superadminContext[0]?.can_write === true,
      "superadmin role context resolves inside RLS",
      superadminContext[0],
    );
    const auditBefore = await client.query("select count(*)::int as count from public.audit_logs");
    const insertedMistake = await client.query(`
      insert into public.quotation_mistakes
        (date, filename, branch, user_id, codename, mistake_details, penalty)
      values (current_date, 'forensic-test', 'forensic-test', $1, 'forged-value', 'forensic-test', '0')
      returning id, codename, created_by, updated_by
    `, [user.id]);
    const mistakeAudit = await client.query(`
      select actor_id, target_user_id, action_type, metadata
      from public.audit_logs
      where target_id = $1
    `, [insertedMistake.rows[0].id]);
    assert(
      insertedMistake.rows[0].codename === user.username
        && insertedMistake.rows[0].created_by === superadmin.id
        && insertedMistake.rows[0].updated_by === superadmin.id,
      "mistake metadata is server-derived",
      insertedMistake.rows[0],
    );
    assert(
      mistakeAudit.rows.length === 1
        && mistakeAudit.rows[0].actor_id === superadmin.id
        && mistakeAudit.rows[0].target_user_id === user.id
        && mistakeAudit.rows[0].action_type === "CREATE_MISTAKE",
      "mistake audit row is single, actor-bound, and target-bound",
      mistakeAudit.rows,
    );
    const auditAfter = await client.query("select count(*)::int as count from public.audit_logs");
    assert(
      auditAfter.rows[0].count === auditBefore.rows[0].count + 1,
      "audited mutation emits exactly one audit row",
      { before: auditBefore.rows[0].count, after: auditAfter.rows[0].count },
    );

    await client.query("reset role");
    await client.query("rollback");
    console.log(JSON.stringify({
      security_tests_passed: assertions.length,
      assertion_names: assertions.map(({ name }) => name),
    }, null, 2));
    await client.end();
    process.exit(0);
  }

  if (process.argv.includes("--validate-migration")) {
    const migrationSql = await getPendingMigrationSql();
    await client.query("begin");
    if (migrationSql) {
      await client.query(migrationSql);
    }
    await client.query("rollback");
    console.log(JSON.stringify({ pending_migrations_validated_in_rolled_back_transaction: true }));
    await client.end();
    process.exit(0);
  }

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
