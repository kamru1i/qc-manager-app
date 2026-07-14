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
      url: getReleaseUrl(`QC.Manager_${VERSION}_x64-setup.exe`),
      releaseDate: "",
      fileSize: "",
      minOsVersion: "Windows 10+",
      autoUpdate: true,
    } as DownloadInfo,

    arm64: {
      platform: "Windows",
      architecture: "ARM64",
      version: VERSION,
      build: VERSION.replace(/\./g, "") + "0",
      url: getReleaseUrl(`QC.Manager_${VERSION}_arm64-setup.exe`),
      releaseDate: "",
      fileSize: "",
      minOsVersion: "Windows 11 on ARM",
      autoUpdate: true,
    } as DownloadInfo,
  },
  macos: {
    universal: {
      platform: "macOS",
      architecture: "Universal Binary (Intel & Apple Silicon)",
      version: VERSION,
      build: VERSION.replace(/\./g, "") + "0",
      url: getReleaseUrl(`QC.Manager_${VERSION}_universal.dmg`),
      releaseDate: "",
      fileSize: "",
      minOsVersion: "macOS 10.15 Catalina+",
      autoUpdate: true,
    } as DownloadInfo,
    appleSilicon: {
      platform: "macOS",
      architecture: "Apple Silicon (M1/M2/M3/M4)",
      version: VERSION,
      build: VERSION.replace(/\./g, "") + "0",
      url: getReleaseUrl(`QC.Manager_${VERSION}_aarch64.dmg`),
      releaseDate: "",
      fileSize: "",
      minOsVersion: "macOS 11.0 Big Sur+",
      autoUpdate: true,
    } as DownloadInfo,
    intel: {
      platform: "macOS",
      architecture: "Intel Mac",
      version: VERSION,
      build: VERSION.replace(/\./g, "") + "0",
      url: getReleaseUrl(`QC.Manager_${VERSION}_x64.dmg`),
      releaseDate: "",
      fileSize: "",
      minOsVersion: "macOS 10.15 Catalina+",
      autoUpdate: true,
    } as DownloadInfo,
  },
  linux: {
    deb: {
      platform: "Linux",
      architecture: "Debian Package (.deb)",
      version: VERSION,
      build: VERSION.replace(/\./g, "") + "0",
      url: getReleaseUrl(`QC.Manager_${VERSION}_amd64.deb`),
      releaseDate: "",
      fileSize: "",
      minOsVersion: "Ubuntu 20.04+, Debian 10+",
      autoUpdate: false,
    } as DownloadInfo,
    appimage: {
      platform: "Linux",
      architecture: "AppImage (.AppImage)",
      version: VERSION,
      build: VERSION.replace(/\./g, "") + "0",
      url: getReleaseUrl(`QC.Manager_${VERSION}_amd64.AppImage`),
      releaseDate: "",
      fileSize: "",
      minOsVersion: "Any modern Linux distribution",
      autoUpdate: false,
    } as DownloadInfo,
    rpm: {
      platform: "Linux",
      architecture: "RPM Package (.rpm)",
      version: VERSION,
      build: VERSION.replace(/\./g, "") + "0",
      url: getReleaseUrl(`QC.Manager-${VERSION}-1.x86_64.rpm`),
      releaseDate: "",
      fileSize: "",
      minOsVersion: "Fedora 32+, RHEL 8+, openSUSE 15+",
      autoUpdate: false,
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
      ota: "Capgo",
    } as DownloadInfo,
  },
};
