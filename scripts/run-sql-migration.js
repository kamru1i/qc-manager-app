const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.substring(0, idx).trim();
        const val = trimmed.substring(idx + 1).trim();
        process.env[key] = val;
      }
    }
  });
}

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error('SUPABASE_DB_URL missing in .env.local');
  process.exit(1);
}

const sqlPath = path.resolve(__dirname, '../supabase/add_reset_user_feature_flags_rpc.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

async function run() {
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to Supabase PostgreSQL database...');
    await client.connect();
    console.log('Executing add_reset_user_feature_flags_rpc.sql...');
    await client.query(sql);
    console.log('SUCCESS: SQL Migration executed successfully!');
  } catch (err) {
    console.error('Error executing SQL migration:', err);
  } finally {
    await client.end();
  }
}

run();
