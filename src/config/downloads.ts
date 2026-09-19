import packageJson from "../../package.json";

export interface DownloadInfo {
  platform: string;
  architecture: string;
  version: string;
  build: string;
  url: string;
  releaseDate: string;
  fileSize: string;
  minOsVersion: string;
  sha256?: string;
  releaseNotes?: string;
  autoUpdate?: boolean;
}

export const VERSION = packageJson.version;
// Public repo that hosts the downloadable binaries. The source repo
// (bnfcorporate/qc-manager-app) is private, and private release assets return 404 to
// the unauthenticated desktop/Android updaters — so binaries are published here instead.
export const REPO = "bnfcorporate/qc-manager-releases";

// B&F-owned, permanent update manifest URL. Served by src/app/updater/latest.json/route.ts,
// which proxies whichever store currently holds the binaries. Every shipped desktop build
// bakes this URL in permanently, so it must never change again — change the route instead.
export const MANIFEST_URL = "https://chuti.bnfcorporate.com/updater/latest.json";

const getReleaseUrl = (fileName: string) =>
  `https://github.com/${REPO}/releases/download/v${VERSION}/${fileName}`;

export const DOWNLOADS = {
  windows: {
    x64: {
      platform: "Windows",
      architecture: "64-bit (x64)",
      version: VERSION,
      build: VERSION.replace(/\./g, "") + "0",
      url: getReleaseUrl(`QC.Manager_${VERSION}_x64-setup.exe`),
      releaseDate: "",
      fileSize: "",
      minOsVersion: "Windows 10+",
      autoUpdate: true,
    } as DownloadInfo,
  },
  macos: {
    appleSilicon: {
      platform: "macOS",
      architecture: "Apple Silicon (M1/M2/M3/M4/M5 & newer)",
      version: VERSION,
      build: VERSION.replace(/\./g, "") + "0",
      url: getReleaseUrl(`QC.Manager_${VERSION}_aarch64.dmg`),
      releaseDate: "",
      fileSize: "",
      minOsVersion: "macOS 11.0 Big Sur+",
      autoUpdate: true,
    } as DownloadInfo,
  },
  android: {
    apk: {
      platform: "Android",
      architecture: "Universal APK",
      version: VERSION,
      build: VERSION.replace(/\./g, "") + "0",
      url: getReleaseUrl(`QC.Manager_${VERSION}.apk`),
      releaseDate: "",
      fileSize: "",
      minOsVersion: "Android 8.0 Oreo (API 26)+",
      autoUpdate: true,
    } as DownloadInfo,
  },
};
