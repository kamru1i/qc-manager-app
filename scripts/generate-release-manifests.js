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

  // 1. Fetch release details (create release tag if it doesn't exist)
  const releaseUrl = `https://api.github.com/repos/${repo}/releases/tags/${tag}`;
  let releaseRes = await fetch(releaseUrl, { headers });
  let release;
  
  if (releaseRes.status === 404) {
    console.log(`Release tag ${tag} not found. Creating a new release...`);
    const createUrl = `https://api.github.com/repos/${repo}/releases`;
    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tag_name: tag,
        name: `QC Manager v${version}`,
        body: `### QC Manager v${version} (Stability & Hardening Release)\n\nThis release focuses on data accuracy, realtime resilience, and platform hardening:\n\n- **Leaderboard Data Accuracy:** Removed 4,200 duplicate records caused by a faulty auto-restore path, added a database unique index so duplicate uploads are now impossible, and removed the risky auto-restore code entirely. Monthly, yearly, and today columns now reflect exact submission counts.\n- **Expanded Working Hours:** Working Hours options now range from 4 Hours to 10 Hours in 30-minute steps, driven by a single shared source of truth across Profile Setup, Profile Settings, and Admin/Supervisor user management.\n- **Save File Helper Fix:** The save directory is now asked at most once per day — manual folder selection and "Save As" share the same remembered directory.\n- **Realtime Resilience:** Server-closed realtime channels now automatically resubscribe with exponential backoff, and misleading console noise (CLOSED undefined) has been eliminated.\n- **Desktop Hardening:** Strict Content-Security-Policy, minimized filesystem permissions (write-only via save dialogs), and the update-signing key moved out of the repository.\n- **Android Improvements:** R8 code shrinking enabled (45% smaller APK) and versionCode now derives automatically from the app version.\n- **CI/CD:** Releases are now built only from version tags, and partial releases fail loudly instead of silently succeeding.`,
        draft: false,
        prerelease: false
      })
    });
    if (!createRes.ok) {
      console.error(`Failed to create release: ${createRes.statusText}`);
      process.exit(1);
    }
    release = await createRes.json();
  } else if (!releaseRes.ok) {
    console.error(`Failed to fetch release info: ${releaseRes.statusText}`);
    process.exit(1);
  } else {
    release = await releaseRes.json();
  }

  let assets = release.assets || [];

  // Print all existing release assets for auditing
  console.log(`=== Existing Release Assets for Tag ${tag} ===`);
  if (assets.length === 0) {
    console.log('No existing assets found.');
  } else {
    assets.forEach(asset => {
      console.log(`- Asset ID: ${asset.id} | Name: "${asset.name}"`);
    });
  }
  console.log(`===============================================`);

  // Helper to normalize spaces/dots/dashes/underscores for space/dot-insensitive matching
  function getNormalizedMatchKey(name) {
    return name.toLowerCase().replace(/[\s_.-]+/g, '');
  }

  // Helper to delete an asset from release and poll to confirm deletion propagation
  async function deleteAssetIfExists(assetName) {
    const searchKey = getNormalizedMatchKey(assetName);
    const toDelete = assets.filter(a => a.name === assetName || getNormalizedMatchKey(a.name) === searchKey);

    if (toDelete.length > 0) {
      for (const existing of toDelete) {
        console.log(`Deleting existing asset "${existing.name}" (ID: ${existing.id}) matching search "${assetName}"...`);
        const delRes = await fetch(`https://api.github.com/repos/${repo}/releases/assets/${existing.id}`, {
          method: 'DELETE',
          headers
        });
        if (!delRes.ok) {
          console.warn(`Failed to delete ${existing.name}: ${delRes.statusText}`);
        }

        // Poll until confirmed deleted to handle eventual consistency
        console.log(`Waiting for deletion of ${existing.name} to propagate...`);
        const checkUrl = `https://api.github.com/repos/${repo}/releases/assets/${existing.id}`;
        let deleted = false;
        for (let attempt = 1; attempt <= 15; attempt++) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          const checkRes = await fetch(checkUrl, { headers });
          if (checkRes.status === 404) {
            deleted = true;
            break;
          }
          console.log(`Attempt ${attempt}: Asset ${existing.name} still exists in GitHub API...`);
        }

        if (deleted) {
          console.log(`Confirmed deletion of ${existing.name}.`);
        } else {
          console.warn(`Warning: Deletion of ${existing.name} did not propagate. Proceeding anyway...`);
        }
        // Small delay for safety
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Sync local assets list
      assets = assets.filter(a => !toDelete.some(d => d.id === a.id));
    }
  }

  // Helper to upload an asset to release with retry logic
  async function uploadAsset(filePath, assetName, attempt = 1) {
    // Standardize local names to replace spaces with dots to align with GitHub's backend normalization
    const normalizedName = assetName.replace(/\s+/g, '.');
    await deleteAssetIfExists(normalizedName);

    console.log(`Uploading "${normalizedName}" to release (Attempt ${attempt}/3)...`);
    const uploadUrl = release.upload_url.replace('{?name,label}', `?name=${encodeURIComponent(normalizedName)}`);
    const uploadHeaders = {
      ...headers,
      'Content-Type': 'application/octet-stream',
      'Content-Length': fs.statSync(filePath).size
    };

    try {
      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: uploadHeaders,
        body: fs.readFileSync(filePath)
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        console.error(`Upload request failed for ${normalizedName} (HTTP ${uploadRes.status}): ${uploadRes.statusText}`, errText);

        if (errText.includes('already_exists') || uploadRes.status === 422) {
          if (attempt < 3) {
            console.log(`Collision detected (already_exists) for "${normalizedName}". Retrying in 5 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Re-fetch current assets list from GitHub to get fresh IDs
            console.log('Refetching release assets from GitHub...');
            const refetchRes = await fetch(releaseUrl, { headers });
            if (refetchRes.ok) {
              const freshData = await refetchRes.json();
              assets = freshData.assets || [];
              console.log(`Refetched ${assets.length} assets.`);
            }

            return await uploadAsset(filePath, assetName, attempt + 1);
          } else {
            console.error(`Fatal: Already exists error persisted for ${normalizedName} after 3 attempts.`);
            process.exit(1);
          }
        }

        if (attempt < 3) {
          console.log(`Retrying upload of ${normalizedName} in 3 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
          return await uploadAsset(filePath, assetName, attempt + 1);
        } else {
          console.error(`Fatal: Failed to upload ${normalizedName} after 3 attempts.`);
          process.exit(1);
        }
      }

      console.log(`Successfully uploaded ${normalizedName}!`);
    } catch (error) {
      console.error(`Network or system error uploading ${normalizedName}:`, error.message || error);
      if (attempt < 3) {
        console.log(`Retrying upload of ${normalizedName} in 5 seconds due to error...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        return await uploadAsset(filePath, assetName, attempt + 1);
      } else {
        process.exit(1);
      }
    }
  }

  // 2. Discover and upload all artifacts built in matrix/android jobs
  const tempArtifactsDir = path.join(process.cwd(), 'temp_artifacts');
  const filesToUpload = [];

  function findFiles(dir) {
    if (!fs.existsSync(dir)) return;
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        findFiles(fullPath);
      } else {
        const ext = path.extname(file).toLowerCase();

        if (
          ext === '.exe' ||
          ext === '.msi' ||
          ext === '.dmg' ||
          ext === '.deb' ||
          ext === '.rpm' ||
          ext === '.appimage' ||
          ext === '.apk' ||
          file.endsWith('.tar.gz') ||
          file.endsWith('.sig') ||
          file.endsWith('.nsis.zip') ||
          file.endsWith('.msi.zip')
        ) {
          // Normalize filename immediately on discovery to replace spaces with dots
          const normalizedName = file.replace(/\s+/g, '.');
          filesToUpload.push({ filePath: fullPath, name: normalizedName });
        }
      }
    }
  }

  findFiles(tempArtifactsDir);
  console.log(`=== Discovered Local Artifacts to Upload ===`);
  filesToUpload.forEach(f => {
    console.log(`- Path: "${f.filePath}" -> Upload Name: "${f.name}"`);
  });
  console.log(`============================================`);
  console.log(`Found ${filesToUpload.length} artifacts to upload.`);

  for (const file of filesToUpload) {
    await uploadAsset(file.filePath, file.name);
  }

  // 3. Zip Next.js out folder as OTA bundle and upload it
  const webAssetsZip = path.join(process.cwd(), 'QC-Manager-Web-Assets.zip');
  console.log('Zipping out/ folder for OTA updates...');
  if (!fs.existsSync(path.join(process.cwd(), 'out'))) {
    console.error('Error: out/ folder not found. Make sure Next.js static build has run.');
    process.exit(1);
  }
  
  execSync(`zip -r "${webAssetsZip}" out/*`);
  await uploadAsset(webAssetsZip, 'QC-Manager-Web-Assets.zip');

  // Refetch assets list from GitHub API to include all uploaded files
  const refetchRes = await fetch(releaseUrl, { headers });
  if (!refetchRes.ok) {
    console.error(`Failed to refetch assets list: ${refetchRes.statusText}`);
    process.exit(1);
  }
  assets = (await refetchRes.json()).assets || [];

  // 4. Calculate SHA256 and sizes using local artifacts where possible
  const tempDir = path.join(process.cwd(), 'temp_release_assets');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

  // Copy local artifact files to tempDir to avoid downloading them
  for (const file of filesToUpload) {
    const dest = path.join(tempDir, file.name);
    fs.copyFileSync(file.filePath, dest);
  }
  if (fs.existsSync(webAssetsZip)) {
    fs.copyFileSync(webAssetsZip, path.join(tempDir, 'QC-Manager-Web-Assets.zip'));
  }

  const checksums = {};
  const fileSizes = {};

  for (const asset of assets) {
    const name = asset.name;
    if (name === 'SHA256SUMS' || name === 'latest.json' || name.endsWith('.sig')) continue;

    const destPath = path.join(tempDir, name);
    
    if (!fs.existsSync(destPath)) {
      console.log(`Downloading and processing hash for: ${name}...`);
      const assetRes = await fetch(asset.browser_download_url);
      if (!assetRes.ok) {
        console.error(`Failed to download asset ${name}: ${assetRes.statusText}`);
        continue;
      }
      const buffer = await assetRes.arrayBuffer();
      fs.writeFileSync(destPath, Buffer.from(buffer));
    } else {
      console.log(`Using local cached file for hash: ${name}`);
    }

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
      if (
        targetName.includes('x64-setup.nsis.zip') ||
        targetName.includes('x86_64-setup.nsis.zip') ||
        targetName.includes('x64-setup.exe') ||
        targetName.includes('x86_64-setup.exe') ||
        targetName.includes('x64_setup.exe')
      ) {
        platformKey = 'windows-x86_64';
      } else if (
        targetName.includes('x86-setup.nsis.zip') ||
        targetName.includes('i686-setup.nsis.zip') ||
        targetName.includes('x86-setup.exe') ||
        targetName.includes('i686-setup.exe') ||
        targetName.includes('x86_setup.exe')
      ) {
        platformKey = 'windows-i686';
      } else if (
        targetName.includes('arm64-setup.nsis.zip') ||
        targetName.includes('aarch64-setup.nsis.zip') ||
        targetName.includes('arm64-setup.exe') ||
        targetName.includes('aarch64-setup.exe') ||
        targetName.includes('arm64_setup.exe')
      ) {
        platformKey = 'windows-aarch64';
      } else if (targetName.includes('universal.app.tar.gz')) {
        platformKey = 'darwin-universal';
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
        const targetUrl = targetAsset.browser_download_url;
        
        platforms[platformKey] = { signature, url: targetUrl };

        // Support nsis variants for windows
        if (platformKey === 'windows-x86_64') {
          platforms['windows-x86_64-nsis'] = { signature, url: targetUrl };
        } else if (platformKey === 'windows-i686') {
          platforms['windows-i686-nsis'] = { signature, url: targetUrl };
        } else if (platformKey === 'windows-aarch64') {
          platforms['windows-aarch64-nsis'] = { signature, url: targetUrl };
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
        universal: {
          url: assets.find(a => a.name.endsWith('.dmg') && a.name.includes('universal'))?.browser_download_url || '',
          fileSize: fileSizes[assets.find(a => a.name.endsWith('.dmg') && a.name.includes('universal'))?.name] || '',
          sha256: checksums[assets.find(a => a.name.endsWith('.dmg') && a.name.includes('universal'))?.name] || ''
        },
        appleSilicon: {
          url: assets.find(a => a.name.endsWith('.dmg') && (a.name.includes('aarch64') || a.name.includes('arm64')))?.browser_download_url || '',
          fileSize: fileSizes[assets.find(a => a.name.endsWith('.dmg') && (a.name.includes('aarch64') || a.name.includes('arm64')))?.name] || '',
          sha256: checksums[assets.find(a => a.name.endsWith('.dmg') && (a.name.includes('aarch64') || a.name.includes('arm64')))?.name] || ''
        },
        intel: {
          url: assets.find(a => a.name.endsWith('.dmg') && (a.name.includes('x64') || a.name.includes('x86_64')) && !a.name.includes('aarch64') && !a.name.includes('arm64') && !a.name.includes('universal'))?.browser_download_url || '',
          fileSize: fileSizes[assets.find(a => a.name.endsWith('.dmg') && (a.name.includes('x64') || a.name.includes('x86_64')) && !a.name.includes('aarch64') && !a.name.includes('arm64') && !a.name.includes('universal'))?.name] || '',
          sha256: checksums[assets.find(a => a.name.endsWith('.dmg') && (a.name.includes('x64') || a.name.includes('x86_64')) && !a.name.includes('aarch64') && !a.name.includes('arm64') && !a.name.includes('universal'))?.name] || ''
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
        // Same partial-release rule as the catch below: the zip is always
        // produced by the build job, so its absence means a broken release.
        console.error('Error: QC-Manager-Web-Assets.zip asset URL not found in release.');
        process.exit(1);
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
      // Fail the job: assets are already uploaded at this point, so swallowing
      // this error would leave a partial release (binaries published, mobile
      // OTA never registered) behind a green checkmark. The script is
      // idempotent — re-running the workflow re-uploads assets (duplicate-safe)
      // and retries this registration.
      console.error('Error during Supabase OTA registration:', err.message || err);
      process.exit(1);
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
