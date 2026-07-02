const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const apiSrc = path.join(__dirname, '..', 'src', 'app', 'api');
const apiBackup = path.join(__dirname, '..', 'src', 'api_backup');

let renamed = false;
try {
  if (fs.existsSync(apiSrc)) {
    console.log('Temporarily moving src/app/api to src/api_backup for static export...');
    try {
      fs.renameSync(apiSrc, apiBackup);
      renamed = true;
    } catch (renameError) {
      if (renameError.code === 'EPERM' || renameError.code === 'EBUSY') {
        console.error('\n❌ ERROR: Cannot rename src/app/api folder because it is locked by another process.');
        console.error('👉 Please STOP the development server (npm run dev) if it is running, and try again.\n');
      } else {
        console.error('Rename error:', renameError);
      }
      process.exit(1);
    }
  }

  console.log('Running Next.js production build...');
  execSync('npx next build', { 
    env: { 
      ...process.env, 
      IS_TAURI_BUILD: 'true' 
    }, 
    stdio: 'inherit' 
  });

  console.log('Static export build completed successfully.');
} catch (error) {
  console.error('Next.js build failed:', error);
  process.exit(1);
} finally {
  if (renamed && fs.existsSync(apiBackup)) {
    console.log('Restoring src/app/api...');
    fs.renameSync(apiBackup, apiSrc);
  }
}
