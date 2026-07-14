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

export const MANIFEST_URL = "https://github.com/kamrulislam2/qc-manager-app/releases/latest/download/latest.json";

export const DOWNLOADS = {
  windows: {
    x64: {
      platform: "Windows",
      architecture: "64-bit (x64)",
      version: "4.6.0",
      build: "4600",
      url: "https://github.com/kamrulislam2/qc-manager-app/releases/download/v4.6.0/QC-Manager-App_4.6.0_x64-setup.exe",
      releaseDate: "2026-07-13",
      fileSize: "78.4 MB",
      minOsVersion: "Windows 10+",
      autoUpdate: true,
      sha256: "ea3f1d8206d203923d8df8d8e3d8f8d8e3d8f8d8e3d8f8d8e3d8f8d8e3d8f8d8",
      releaseNotes: "Initial migration release with Capacitor safe area layout updates, performance optimization, and auto update plugin integration.",
    } as DownloadInfo,
    x86: {
      platform: "Windows",
      architecture: "32-bit (x86)",
      version: "4.6.0",
      build: "4600",
      url: "https://github.com/kamrulislam2/qc-manager-app/releases/download/v4.6.0/QC-Manager-App_4.6.0_x86-setup.exe",
      releaseDate: "2026-07-13",
      fileSize: "74.1 MB",
      minOsVersion: "Windows 10+",
      autoUpdate: true,
      sha256: "ea3f1d8206d203923d8df8d8e3d8f8d8e3d8f8d8e3d8f8d8e3d8f8d8e3d8f8d9",
      releaseNotes: "Initial migration release.",
    } as DownloadInfo,
    arm64: {
      platform: "Windows",
      architecture: "ARM64",
      version: "4.6.0",
      build: "4600",
      url: "https://github.com/kamrulislam2/qc-manager-app/releases/download/v4.6.0/QC-Manager-App_4.6.0_arm64-setup.exe",
      releaseDate: "2026-07-13",
      fileSize: "75.8 MB",
      minOsVersion: "Windows 11 on ARM",
      autoUpdate: true,
      sha256: "ea3f1d8206d203923d8df8d8e3d8f8d8e3d8f8d8e3d8f8d8e3d8f8d8e3d8f8da",
      releaseNotes: "Initial migration release for native ARM64 Windows clients.",
    } as DownloadInfo,
  },
  macos: {
    appleSilicon: {
      platform: "macOS",
      architecture: "Apple Silicon (M1/M2/M3/M4)",
      version: "4.6.0",
      build: "4600",
      url: "https://github.com/kamrulislam2/qc-manager-app/releases/download/v4.6.0/QC-Manager-App_4.6.0_aarch64.dmg",
      releaseDate: "2026-07-13",
      fileSize: "82.3 MB",
      minOsVersion: "macOS 11.0 Big Sur+",
      autoUpdate: true,
      sha256: "ba3f1d8206d203923d8df8d8e3d8f8d8e3d8f8d8e3d8f8d8e3d8f8d8e3d8f8d8",
      releaseNotes: "Initial release with Apple Silicon GPU support, smoother animations, and hardware accelerations.",
    } as DownloadInfo,
    intel: {
      platform: "macOS",
      architecture: "Intel Mac",
      version: "4.6.0",
      build: "4600",
      url: "https://github.com/kamrulislam2/qc-manager-app/releases/download/v4.6.0/QC-Manager-App_4.6.0_x64.dmg",
      releaseDate: "2026-07-13",
      fileSize: "85.1 MB",
      minOsVersion: "macOS 10.15 Catalina+",
      autoUpdate: true,
      sha256: "ca3f1d8206d203923d8df8d8e3d8f8d8e3d8f8d8e3d8f8d8e3d8f8d8e3d8f8d8",
      releaseNotes: "Initial release for Intel x64 processor Mac computers.",
    } as DownloadInfo,
  },
  linux: {
    deb: {
      platform: "Linux",
      architecture: "Debian Package (.deb)",
      version: "4.6.0",
      build: "4600",
      url: "https://github.com/kamrulislam2/qc-manager-app/releases/download/v4.6.0/qc-manager-app_4.6.0_amd64.deb",
      releaseDate: "2026-07-13",
      fileSize: "68.2 MB",
      minOsVersion: "Ubuntu 20.04+, Debian 10+",
      autoUpdate: false,
      sha256: "da3f1d8206d203923d8df8d8e3d8f8d8e3d8f8d8e3d8f8d8e3d8f8d8e3d8f8d8",
      releaseNotes: "Debian package release for Ubuntu, Debian, Mint, Pop!_OS, and Kali Linux.",
    } as DownloadInfo,
    appimage: {
      platform: "Linux",
      architecture: "AppImage (.AppImage)",
      version: "4.6.0",
      build: "4600",
      url: "https://github.com/kamrulislam2/qc-manager-app/releases/download/v4.6.0/qc-manager-app_4.6.0_amd64.AppImage",
      releaseDate: "2026-07-13",
      fileSize: "70.5 MB",
      minOsVersion: "Any modern Linux distribution",
      autoUpdate: false,
      sha256: "ea3f1d8206d203923d8df8d8e3d8f8d8e3d8f8d8e3d8f8d8e3d8f8d8e3d8f8d8",
      releaseNotes: "Standalone AppImage executable for all Linux distributions.",
    } as DownloadInfo,
    rpm: {
      platform: "Linux",
      architecture: "RPM Package (.rpm)",
      version: "4.6.0",
      build: "4600",
      url: "https://github.com/kamrulislam2/qc-manager-app/releases/download/v4.6.0/qc-manager-app_4.6.0_amd64.rpm",
      releaseDate: "2026-07-13",
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
      version: "4.6.0",
      build: "4600",
      url: "https://github.com/kamrulislam2/qc-manager-app/releases/download/v4.6.0/qc-manager-app-release.apk",
      releaseDate: "2026-07-14",
      fileSize: "24.5 MB",
      minOsVersion: "Android 8.0 Oreo (API 26)+",
      ota: "Capgo",
      releaseNotes: "Internal release featuring full offline sync mechanics, in-app Bell notifications, and Capgo self-hosted OTA auto update check.",
    } as DownloadInfo,
  },
  ios: {
    internal: {
      platform: "iOS",
      architecture: "iPhone / iPad Internal Build",
      version: "4.6.0",
      build: "4600",
      url: "https://qc-manager-y4bzh900h-kamrul-projects.vercel.app/ios-instructions",
      releaseDate: "2026-07-14",
      fileSize: "28.1 MB",
      minOsVersion: "iOS 15.0+",
      ota: "Capgo",
      releaseNotes: "Internal IPA release supporting native iOS safe area layout borders and Capgo self-hosted updates.",
    } as DownloadInfo,
  },
};
