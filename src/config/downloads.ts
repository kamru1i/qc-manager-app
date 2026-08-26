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
export const REPO = "kamru1i/qc-manager-app";
export const MANIFEST_URL = `https://github.com/${REPO}/releases/latest/download/latest.json`;

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
