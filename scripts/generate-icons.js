const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Colors for console logging
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const NC = "\x1b[0m"; // No Color

console.log(`${YELLOW}Step 1: Generating Tauri desktop icons...${NC}`);
try {
  execSync("npx tauri icon ./app-icon.png", { stdio: "inherit" });
  console.log(`${GREEN}Tauri desktop icons generated successfully.${NC}\n`);
} catch (e) {
  console.error("Failed to generate Tauri desktop icons:", e);
  process.exit(1);
}

console.log(`${YELLOW}Step 2: Generating Android Capacitor icons...${NC}`);

// Define the Android resources path
const androidResPath = path.resolve(__dirname, "../android/app/src/main/res");

// Mipmap sizes configuration
const mipmaps = [
  { name: "mipmap-mdpi", legacySize: 48, adaptiveSize: 108 },
  { name: "mipmap-hdpi", legacySize: 72, adaptiveSize: 162 },
  { name: "mipmap-xhdpi", legacySize: 96, adaptiveSize: 216 },
  { name: "mipmap-xxhdpi", legacySize: 144, adaptiveSize: 324 },
  { name: "mipmap-xxxhdpi", legacySize: 192, adaptiveSize: 432 },
];

const sourceIcon = path.resolve(__dirname, "../app-icon.png");

if (!fs.existsSync(sourceIcon)) {
  console.error(`Error: Source icon not found at ${sourceIcon}`);
  process.exit(1);
}

// Generate each mipmap size
mipmaps.forEach((m) => {
  const dirPath = path.join(androidResPath, m.name);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  // 1. Generate legacy ic_launcher.png
  const legacyDest = path.join(dirPath, "ic_launcher.png");
  console.log(`Generating legacy icon: ${m.name} (${m.legacySize}x${m.legacySize})`);
  execSync(`sips -z ${m.legacySize} ${m.legacySize} "${sourceIcon}" --out "${legacyDest}"`, { stdio: "ignore" });

  // 2. Generate legacy ic_launcher_round.png
  const legacyRoundDest = path.join(dirPath, "ic_launcher_round.png");
  console.log(`Generating legacy round icon: ${m.name} (${m.legacySize}x${m.legacySize})`);
  execSync(`sips -z ${m.legacySize} ${m.legacySize} "${sourceIcon}" --out "${legacyRoundDest}"`, { stdio: "ignore" });

  // 3. Generate adaptive ic_launcher_foreground.png
  // To keep the logo inside the safe zone (65% of the adaptive size) and pad it with transparency to the full size
  const safeSize = Math.round(m.adaptiveSize * 0.65);
  const fgDest = path.join(dirPath, "ic_launcher_foreground.png");
  console.log(`Generating adaptive foreground: ${m.name} (logo scaled to ${safeSize}x${safeSize}, padded to ${m.adaptiveSize}x${m.adaptiveSize})`);
  
  // First scale to safeSize, then pad to adaptiveSize
  execSync(`sips -z ${safeSize} ${safeSize} "${sourceIcon}" --out "${fgDest}"`, { stdio: "ignore" });
  execSync(`sips -p ${m.adaptiveSize} ${m.adaptiveSize} "${fgDest}"`, { stdio: "ignore" });
});

// Ensure values/ic_launcher_background.xml exists with white background (#ffffff)
const valuesPath = path.join(androidResPath, "values");
if (!fs.existsSync(valuesPath)) {
  fs.mkdirSync(valuesPath, { recursive: true });
}
const bgXmlDest = path.join(valuesPath, "ic_launcher_background.xml");
const bgXmlContent = `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <color name="ic_launcher_background">#ffffff</color>
</resources>
`;
fs.writeFileSync(bgXmlDest, bgXmlContent, "utf8");
console.log(`Verified adaptive background color: ${bgXmlDest}\n`);

// Ensure mipmap-anydpi-v26/ic_launcher.xml exists
const anydpiPath = path.join(androidResPath, "mipmap-anydpi-v26");
if (!fs.existsSync(anydpiPath)) {
  fs.mkdirSync(anydpiPath, { recursive: true });
}
const adaptiveXmlContent = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
  <background android:drawable="@color/ic_launcher_background"/>
  <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;
fs.writeFileSync(path.join(anydpiPath, "ic_launcher.xml"), adaptiveXmlContent, "utf8");
fs.writeFileSync(path.join(anydpiPath, "ic_launcher_round.xml"), adaptiveXmlContent, "utf8");
console.log(`Verified adaptive xml files inside: ${anydpiPath}\n`);

console.log(`${GREEN}Android launcher icons generated and verified successfully.${NC}`);
