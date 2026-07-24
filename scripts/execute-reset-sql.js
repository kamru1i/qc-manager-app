const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function inspectProfiles() {
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, global_settings');

  console.log(`Inspecting ${profiles.length} profiles...`);
  for (const p of profiles) {
    const keys = p.global_settings ? Object.keys(p.global_settings) : [];
    console.log(`User ${p.username}: keys = [${keys.join(', ')}]`);
    if (p.global_settings?.feature_flags) {
      console.log(`  -> feature_flags:`, p.global_settings.feature_flags);
    }
    if (p.global_settings?.user_feature_flags) {
      console.log(`  -> user_feature_flags:`, p.global_settings.user_feature_flags);
    }
  }
}

inspectProfiles();
