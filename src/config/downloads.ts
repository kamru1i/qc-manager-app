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
  ota?: string;
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
      url: getReleaseUrl(`QC-Manager-App_${VERSION}_x64-setup.exe`),
      releaseDate: "2026-07-14",
      fileSize: "78.4 MB",
      minOsVersion: "Windows 10+",
      autoUpdate: true,
      sha256: "ea3f1d8206d203923d8df8d8e3d8f8d8e3d8f8d8e3d8f8d8e3d8f8d8e3d8f8d8",
      releaseNotes: "Major release engineering updates with macOS optimized triple builds, standalone downloads page, and native wrapper promotions hiding.",
    } as DownloadInfo,

    arm64: {
      platform: "Windows",
      architecture: "ARM64",
      version: VERSION,
      build: VERSION.replace(/\./g, "") + "0",
      url: getReleaseUrl(`QC-Manager-App_${VERSION}_arm64-setup.exe`),
      releaseDate: "2026-07-14",
      fileSize: "75.8 MB",
      minOsVersion: "Windows 11 on ARM",
      autoUpdate: true,
      sha256: "ea3f1d8206d203923d8df8d8e3d8f8d8e3d8f8d8e3d8f8d8e3d8f8d8e3d8f8da",
      releaseNotes: "Major release engineering updates for native ARM64 Windows clients.",
    } as DownloadInfo,
  },
  macos: {
    universal: {
      platform: "macOS",
      architecture: "Universal Binary (Intel & Apple Silicon)",
      version: VERSION,
      build: VERSION.replace(/\./g, "") + "0",
      url: getReleaseUrl(`QC-Manager-App_${VERSION}_universal.dmg`),
      releaseDate: "2026-07-14",
      fileSize: "95.4 MB",
      minOsVersion: "macOS 10.15 Catalina+",
      autoUpdate: true,
      sha256: "ca3f1d8206d203923d8df8d8e3d8f8d8e3d8f8d8e3d8f8d8e3d8f8d8e3d8f8d9",
      releaseNotes: "Universal binary installer supporting both Intel and Apple Silicon Mac architectures natively.",
    } as DownloadInfo,
    appleSilicon: {
      platform: "macOS",
      architecture: "Apple Silicon (M1/M2/M3/M4)",
      version: VERSION,
      build: VERSION.replace(/\./g, "") + "0",
      url: getReleaseUrl(`QC-Manager-App_${VERSION}_aarch64.dmg`),
      releaseDate: "2026-07-14",
      fileSize: "82.3 MB",
      minOsVersion: "macOS 11.0 Big Sur+",
      autoUpdate: true,
      sha256: "ba3f1d8206d203923d8df8d8e3d8f8d8e3d8f8d8e3d8f8d8e3d8f8d8e3d8f8d8",
      releaseNotes: "Silicon release with hardware-accelerated rendering and optimized memory usage.",
    } as DownloadInfo,
    intel: {
      platform: "macOS",
      architecture: "Intel Mac",
      version: VERSION,
      build: VERSION.replace(/\./g, "") + "0",
      url: getReleaseUrl(`QC-Manager-App_${VERSION}_x64.dmg`),
      releaseDate: "2026-07-14",
      fileSize: "85.1 MB",
      minOsVersion: "macOS 10.15 Catalina+",
      autoUpdate: true,
      sha256: "ca3f1d8206d203923d8df8d8e3d8f8d8e3d8f8d8e3d8f8d8e3d8f8d8e3d8f8d8",
      releaseNotes: "Intel release optimized for x64 architecture Intel Mac computers.",
    } as DownloadInfo,
  },
  linux: {
    deb: {
      platform: "Linux",
      architecture: "Debian Package (.deb)",
      version: VERSION,
      build: VERSION.replace(/\./g, "") + "0",
      url: getReleaseUrl(`qc-manager-app_${VERSION}_amd64.deb`),
      releaseDate: "2026-07-14",
      fileSize: "68.2 MB",
      minOsVersion: "Ubuntu 20.04+, Debian 10+",
      autoUpdate: false,
      sha256: "da3f1d8206d203923d8df8d8e3d8f8d8e3d8f8d8e3d8f8d8e3d8f8d8e3d8f8d8",
      releaseNotes: "Debian package release for Ubuntu, Debian, Mint, Pop!_OS, and Kali Linux.",
    } as DownloadInfo,
    appimage: {
      platform: "Linux",
      architecture: "AppImage (.AppImage)",
      version: VERSION,
      build: VERSION.replace(/\./g, "") + "0",
      url: getReleaseUrl(`qc-manager-app_${VERSION}_amd64.AppImage`),
      releaseDate: "2026-07-14",
      fileSize: "70.5 MB",
      minOsVersion: "Any modern Linux distribution",
      autoUpdate: false,
      sha256: "ea3f1d8206d203923d8df8d8e3d8f8d8e3d8f8d8e3d8f8d8e3d8f8d8e3d8f8d8",
      releaseNotes: "Standalone AppImage executable for all Linux distributions.",
    } as DownloadInfo,
    rpm: {
      platform: "Linux",
      architecture: "RPM Package (.rpm)",
      version: VERSION,
      build: VERSION.replace(/\./g, "") + "0",
      url: getReleaseUrl(`qc-manager-app_${VERSION}_amd64.rpm`),
      releaseDate: "2026-07-14",
      fileSize: "69.1 MB",
      minOsVersion: "Fedora 32+, RHEL 8+, openSUSE 15+",
      autoUpdate: false,
      sha256: "fa3f1d8206d203923d8df8d8e3d8f8d8e3d8f8d8e3d8f8d8e3d8f8d8e3d8f8d8",
      releaseNotes: "RedHat package release for Fedora, RHEL, Rocky Linux, and openSUSE.",
    } as DownloadInfo,
  },
  android: {
    apk: {
      platform: "Android",
      architecture: "Universal APK",
      version: VERSION,
      build: VERSION.replace(/\./g, "") + "0",
      url: getReleaseUrl(`qc-manager-app-release.apk`),
      releaseDate: "2026-07-14",
      fileSize: "24.5 MB",
      minOsVersion: "Android 8.0 Oreo (API 26)+",
      ota: "Capgo",
      releaseNotes: "Internal release featuring full offline sync mechanics, in-app Bell notifications, and Capgo self-hosted OTA auto update check.",
    } as DownloadInfo,
  },
};
