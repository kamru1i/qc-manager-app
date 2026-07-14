const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const repo = process.env.GITHUB_REPOSITORY; // e.g., "owner/repo"

  if (!supabaseUrl || !serviceKey) {
    console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env variables are required.');
    process.exit(1);
  }

  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const version = packageJson.version;

  const zipUrl = `https://github.com/${repo || 'kamru1i/qc-manager-app'}/releases/download/v${version}/QC-Manager-Web-Assets.zip`;

  console.log(`Publishing Capacitor OTA version v${version} to Supabase...`);
  console.log(`Zip URL target: ${zipUrl}`);

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  // 1. Check if the version already exists in the table
  const { data: existing, error: checkError } = await supabase
    .from('mobile_app_versions')
    .select('id')
    .eq('version', version)
    .maybeSingle();

  if (checkError) {
    console.error('Error checking existing version:', checkError.message);
    process.exit(1);
  }

  if (existing) {
    console.log(`Version ${version} already exists in database. Updating record...`);
    const { error: updateError } = await supabase
      .from('mobile_app_versions')
      .update({
        zip_url: zipUrl,
        created_at: new Date().toISOString()
      })
      .eq('id', existing.id);

    if (updateError) {
      console.error('Failed to update OTA version record:', updateError.message);
      process.exit(1);
    }
    console.log('Successfully updated OTA release record!');
  } else {
    console.log(`Version ${version} is new. Inserting release record...`);
    const { error: insertError } = await supabase
      .from('mobile_app_versions')
      .insert({
        version: version,
        zip_url: zipUrl,
        required: false
      });

    if (insertError) {
      console.error('Failed to insert OTA version record:', insertError.message);
      process.exit(1);
    }
    console.log('Successfully published new OTA release record!');
  }
}

main().catch(err => {
  console.error('Fatal error publishing OTA release:', err);
  process.exit(1);
});
