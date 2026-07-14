const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

// Helper to compute SHA256 of a file
function computeSha256(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY; // "owner/repo"
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!token || !repo) {
    console.error('Error: GITHUB_TOKEN and GITHUB_REPOSITORY are required.');
    process.exit(1);
  }

  const ref = process.env.GITHUB_REF || '';
  const isTag = ref.startsWith('refs/tags/v');

  if (!isTag) {
    console.log('Not running on a release tag. Skipping release manifest generation and OTA database update.');
    process.exit(0);
  }

  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const version = packageJson.version;
  const tag = `v${version}`;

  console.log(`Starting Release Manifest Generation for tag ${tag}...`);

  const headers = {
    'Authorization': `token ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'release-manifest-generator'
  };

  // 1. Fetch release details
  const releaseUrl = `https://api.github.com/repos/${repo}/releases/tags/${tag}`;
  const releaseRes = await fetch(releaseUrl, { headers });
  if (!releaseRes.ok) {
    console.error(`Failed to fetch release info: ${releaseRes.statusText}`);
    process.exit(1);
  }
  const release = await releaseRes.json();
  let assets = release.assets || [];

  // Helper to delete an asset from release
  async function deleteAssetIfExists(assetName) {
    const existing = assets.find(a => a.name === assetName);
    if (existing) {
      console.log(`Deleting existing asset ${assetName} (ID: ${existing.id})...`);
      const delRes = await fetch(`https://api.github.com/repos/${repo}/releases/assets/${existing.id}`, {
        method: 'DELETE',
        headers
      });
      if (!delRes.ok) {
        console.warn(`Failed to delete ${assetName}: ${delRes.statusText}`);
      }
    }
  }

  // Helper to upload an asset to release
  async function uploadAsset(filePath, assetName) {
    await deleteAssetIfExists(assetName);

    console.log(`Uploading ${assetName} to release...`);
    const uploadUrl = release.upload_url.replace('{?name,label}', `?name=${assetName}`);
    const uploadHeaders = {
      ...headers,
      'Content-Type': 'application/octet-stream',
      'Content-Length': fs.statSync(filePath).size
    };

    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: uploadHeaders,
      body: fs.readFileSync(filePath)
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error(`Failed to upload ${assetName}: ${uploadRes.statusText}`, errText);
      process.exit(1);
    }
    console.log(`Successfully uploaded ${assetName}!`);
  }

  // 2. Zip Next.js out folder as OTA bundle and upload it
  const webAssetsZip = path.join(process.cwd(), 'QC-Manager-Web-Assets.zip');
  console.log('Zipping out/ folder for OTA updates...');
  if (!fs.existsSync(path.join(process.cwd(), 'out'))) {
    console.error('Error: out/ folder not found. Make sure Next.js static build has run.');
    process.exit(1);
  }
  
  // Use native zip command on runner for simplicity and speed
  execSync(`zip -r "${webAssetsZip}" out/*`);
  await uploadAsset(webAssetsZip, 'QC-Manager-Web-Assets.zip');

  // Refetch assets to include the newly uploaded zip
  const refetchRes = await fetch(releaseUrl, { headers });
  assets = (await refetchRes.json()).assets || [];

  // 3. Download release files to calculate SHA256 and sizes
  const tempDir = path.join(process.cwd(), 'temp_release_assets');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

  const checksums = {};
  const fileSizes = {};

  for (const asset of assets) {
    const name = asset.name;
    // Skip checksum files and Tauri signatures
    if (name === 'SHA256SUMS' || name === 'latest.json' || name.endsWith('.sig')) continue;

    console.log(`Downloading and processing hash for: ${name}...`);
    const destPath = path.join(tempDir, name);
    
    const assetRes = await fetch(asset.browser_download_url);
    if (!assetRes.ok) {
      console.error(`Failed to download asset ${name}: ${assetRes.statusText}`);
      continue;
    }
    const buffer = await assetRes.arrayBuffer();
    fs.writeFileSync(destPath, Buffer.from(buffer));

    const sha = computeSha256(destPath);
    checksums[name] = sha;
    fileSizes[name] = `${(fs.statSync(destPath).size / (1024 * 1024)).toFixed(1)} MB`;

    console.log(`File: ${name} -> SHA256: ${sha} -> Size: ${fileSizes[name]}`);
  }

  // Write SHA256SUMS file
  const sha256sumsPath = path.join(process.cwd(), 'SHA256SUMS');
  let shaContent = '';
  for (const [name, sha] of Object.entries(checksums)) {
    shaContent += `${sha}  ${name}\n`;
  }
  fs.writeFileSync(sha256sumsPath, shaContent);
  await uploadAsset(sha256sumsPath, 'SHA256SUMS');

  // 4. Parse signatures for Tauri Updater platforms
  const platforms = {};
  for (const asset of assets) {
    const name = asset.name;
    const url = asset.browser_download_url;

    if (name.endsWith('.sig')) {
      const targetName = name.slice(0, -4);
      const targetAsset = assets.find(a => a.name === targetName);
      if (!targetAsset) continue;

      let platformKey = null;
      if (targetName.includes('x64-setup.exe') || targetName.includes('x86_64-setup.exe') || targetName.includes('x64_setup.exe')) {
        platformKey = 'windows-x86_64';
      } else if (targetName.includes('x86-setup.exe') || targetName.includes('i686-setup.exe') || targetName.includes('x86_setup.exe')) {
        platformKey = 'windows-i686';
      } else if (targetName.includes('arm64-setup.exe') || targetName.includes('aarch64-setup.exe') || targetName.includes('arm64_setup.exe')) {
        platformKey = 'windows-aarch64';
      } else if (targetName.includes('x64.app.tar.gz') || targetName.includes('x86_64.app.tar.gz')) {
        platformKey = 'darwin-x86_64';
      } else if (targetName.includes('aarch64.app.tar.gz') || targetName.includes('arm64.app.tar.gz')) {
        platformKey = 'darwin-aarch64';
      } else if (targetName.endsWith('.AppImage')) {
        platformKey = 'linux-x86_64';
      }

      if (platformKey) {
        const sigRes = await fetch(asset.browser_download_url);
        const signature = (await sigRes.text()).trim();
        platforms[platformKey] = { signature, url };

        // Support nsis variants for windows
        if (platformKey === 'windows-x86_64') {
          platforms['windows-x86_64-nsis'] = { signature, url };
        } else if (platformKey === 'windows-i686') {
          platforms['windows-i686-nsis'] = { signature, url };
        } else if (platformKey === 'windows-aarch64') {
          platforms['windows-aarch64-nsis'] = { signature, url };
        }
      }
    }
  }

  // 5. Construct latest.json mapping
  const latestJson = {
    version,
    notes: release.body || `Release ${version}`,
    pub_date: new Date().toISOString(),
    platforms,
    // Smart Download Custom Fields
    releaseDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    checksums,
    downloads: {
      windows: {
        x64: {
          url: assets.find(a => a.name.includes('x64-setup.exe') || a.name.includes('x64_setup.exe'))?.browser_download_url || '',
          fileSize: fileSizes[assets.find(a => a.name.includes('x64-setup.exe') || a.name.includes('x64_setup.exe'))?.name] || '',
          sha256: checksums[assets.find(a => a.name.includes('x64-setup.exe') || a.name.includes('x64_setup.exe'))?.name] || ''
        },
        arm64: {
          url: assets.find(a => a.name.includes('arm64-setup.exe') || a.name.includes('arm64_setup.exe'))?.browser_download_url || '',
          fileSize: fileSizes[assets.find(a => a.name.includes('arm64-setup.exe') || a.name.includes('arm64_setup.exe'))?.name] || '',
          sha256: checksums[assets.find(a => a.name.includes('arm64-setup.exe') || a.name.includes('arm64_setup.exe'))?.name] || ''
        }
      },
      macos: {
        appleSilicon: {
          url: assets.find(a => a.name.endsWith('.dmg') && (a.name.includes('aarch64') || a.name.includes('arm64')))?.browser_download_url || '',
          fileSize: fileSizes[assets.find(a => a.name.endsWith('.dmg') && (a.name.includes('aarch64') || a.name.includes('arm64')))?.name] || '',
          sha256: checksums[assets.find(a => a.name.endsWith('.dmg') && (a.name.includes('aarch64') || a.name.includes('arm64')))?.name] || ''
        },
        intel: {
          url: assets.find(a => a.name.endsWith('.dmg') && (a.name.includes('x64') || a.name.includes('x86_64')) && !a.name.includes('aarch64') && !a.name.includes('arm64'))?.browser_download_url || '',
          fileSize: fileSizes[assets.find(a => a.name.endsWith('.dmg') && (a.name.includes('x64') || a.name.includes('x86_64')) && !a.name.includes('aarch64') && !a.name.includes('arm64'))?.name] || '',
          sha256: checksums[assets.find(a => a.name.endsWith('.dmg') && (a.name.includes('x64') || a.name.includes('x86_64')) && !a.name.includes('aarch64') && !a.name.includes('arm64'))?.name] || ''
        }
      },
      linux: {
        deb: {
          url: assets.find(a => a.name.endsWith('.deb'))?.browser_download_url || '',
          fileSize: fileSizes[assets.find(a => a.name.endsWith('.deb'))?.name] || '',
          sha256: checksums[assets.find(a => a.name.endsWith('.deb'))?.name] || ''
        },
        appimage: {
          url: assets.find(a => a.name.endsWith('.AppImage'))?.browser_download_url || '',
          fileSize: fileSizes[assets.find(a => a.name.endsWith('.AppImage'))?.name] || '',
          sha256: checksums[assets.find(a => a.name.endsWith('.AppImage'))?.name] || ''
        },
        rpm: {
          url: assets.find(a => a.name.endsWith('.rpm'))?.browser_download_url || '',
          fileSize: fileSizes[assets.find(a => a.name.endsWith('.rpm'))?.name] || '',
          sha256: checksums[assets.find(a => a.name.endsWith('.rpm'))?.name] || ''
        }
      },
      android: {
        apk: {
          url: assets.find(a => a.name.endsWith('.apk'))?.browser_download_url || '',
          fileSize: fileSizes[assets.find(a => a.name.endsWith('.apk'))?.name] || '',
          sha256: checksums[assets.find(a => a.name.endsWith('.apk'))?.name] || ''
        }
      },
      ios: {
        internal: {
          url: `https://${repo.split('/')[0]}.github.io/${repo.split('/')[1]}/ios-instructions`,
          fileSize: '28.1 MB',
          sha256: ''
        }
      }
    }
  };

  const latestJsonPath = path.join(process.cwd(), 'latest.json');
  fs.writeFileSync(latestJsonPath, JSON.stringify(latestJson, null, 2));
  await uploadAsset(latestJsonPath, 'latest.json');

  // 6. Automatically register OTA bundle with Supabase Database
  if (supabaseUrl && serviceKey) {
    console.log('Connecting to Supabase to register OTA update...');
    try {
      const supabase = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      
      const otaZipUrl = assets.find(a => a.name === 'QC-Manager-Web-Assets.zip')?.browser_download_url || '';
      
      if (!otaZipUrl) {
        console.warn('Warning: QC-Manager-Web-Assets.zip asset URL not found in release.');
      } else {
        const { data: existing, error: checkError } = await supabase
          .from('mobile_app_versions')
          .select('id')
          .eq('version', version)
          .maybeSingle();

        if (checkError) throw checkError;

        if (existing) {
          console.log(`Updating existing OTA version record for version ${version}...`);
          const { error: updateError } = await supabase
            .from('mobile_app_versions')
            .update({ zip_url: otaZipUrl, created_at: new Date().toISOString() })
            .eq('id', existing.id);
          if (updateError) throw updateError;
        } else {
          console.log(`Inserting new OTA version record for version ${version}...`);
          const { error: insertError } = await supabase
            .from('mobile_app_versions')
            .insert({ version: version, zip_url: otaZipUrl, required: false });
          if (insertError) throw insertError;
        }
        console.log('Supabase OTA release registration complete!');
      }
    } catch (err) {
      console.error('Error during Supabase OTA registration:', err.message || err);
    }
  } else {
    console.log('Supabase credentials missing. Skipping automated OTA database registration.');
  }

  console.log('All manifests, checksums, and update endpoints generated successfully!');
}

main().catch(err => {
  console.error('Fatal error generating release manifests:', err);
  process.exit(1);
});
