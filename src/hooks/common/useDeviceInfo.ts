import { useState, useEffect } from 'react';
import { detectDevice, getAsyncArchitecture, DeviceInfo } from '@/utils/deviceDetection';
import { DOWNLOADS, DownloadInfo, MANIFEST_URL } from '@/config/downloads';

export interface UseDeviceInfoResult {
  deviceInfo: DeviceInfo;
  recommendation: DownloadInfo | null;
  loading: boolean;
  downloads: typeof DOWNLOADS;
}

export function useDeviceInfo(): UseDeviceInfoResult {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    os: 'Unknown',
    architecture: 'Unknown',
    deviceType: 'Desktop',
    touchCapable: false,
    browser: 'Unknown',
  });
  const [downloads, setDownloads] = useState<typeof DOWNLOADS>(DOWNLOADS);
  const [recommendation, setRecommendation] = useState<DownloadInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Detect core device properties synchronously
    const info = detectDevice();
    setDeviceInfo(info);
    
    // Resolve initial recommendation using hardcoded fallback config
    let currentDownloads = DOWNLOADS;
    setRecommendation(getRecommendation(info, currentDownloads));
    setLoading(false);

    // 2. Fetch latest release manifest asynchronously to override URLs, sizes, and hashes
    const fetchManifest = async () => {
      try {
        const res = await fetch(MANIFEST_URL, { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to fetch manifest');
        const data = await res.json();

        if (data && data.version && data.downloads) {
          // Merge remote values with local fallback descriptors
          const mergedDownloads = {
            windows: {
              x64: { ...DOWNLOADS.windows.x64, ...data.downloads.windows.x64, version: data.version, releaseDate: data.releaseDate || DOWNLOADS.windows.x64.releaseDate },
              arm64: { ...DOWNLOADS.windows.arm64, ...data.downloads.windows.arm64, version: data.version, releaseDate: data.releaseDate || DOWNLOADS.windows.arm64.releaseDate }
            },
            macos: {
              appleSilicon: { ...DOWNLOADS.macos.appleSilicon, ...data.downloads.macos.appleSilicon, version: data.version, releaseDate: data.releaseDate || DOWNLOADS.macos.appleSilicon.releaseDate },
              intel: { ...DOWNLOADS.macos.intel, ...data.downloads.macos.intel, version: data.version, releaseDate: data.releaseDate || DOWNLOADS.macos.intel.releaseDate }
            },
            linux: {
              deb: { ...DOWNLOADS.linux.deb, ...data.downloads.linux.deb, version: data.version, releaseDate: data.releaseDate || DOWNLOADS.linux.deb.releaseDate },
              appimage: { ...DOWNLOADS.linux.appimage, ...data.downloads.linux.appimage, version: data.version, releaseDate: data.releaseDate || DOWNLOADS.linux.appimage.releaseDate },
              rpm: { ...DOWNLOADS.linux.rpm, ...data.downloads.linux.rpm, version: data.version, releaseDate: data.releaseDate || DOWNLOADS.linux.rpm.releaseDate }
            },
            android: {
              apk: { ...DOWNLOADS.android.apk, ...data.downloads.android.apk, version: data.version, releaseDate: data.releaseDate || DOWNLOADS.android.apk.releaseDate }
            },
            ios: {
              internal: { ...DOWNLOADS.ios.internal, ...data.downloads.ios.internal, version: data.version, releaseDate: data.releaseDate || DOWNLOADS.ios.internal.releaseDate }
            }
          };
          setDownloads(mergedDownloads);
          currentDownloads = mergedDownloads;
          setRecommendation(getRecommendation(deviceInfo, mergedDownloads));
        }
      } catch (err) {
        console.warn('[useDeviceInfo] Failed to fetch latest.json, using local fallback downloads config:', err);
      }
    };

    fetchManifest();

    // 3. Query async high entropy values (for Windows/Chromium architecture refinements)
    getAsyncArchitecture(info).then((refinedArch) => {
      if (refinedArch !== info.architecture) {
        const refinedInfo = { ...info, architecture: refinedArch };
        setDeviceInfo(refinedInfo);
        setRecommendation(getRecommendation(refinedInfo, currentDownloads));
      }
    });
  }, []);

  return {
    deviceInfo,
    recommendation,
    loading,
    downloads,
  };
}

/**
 * Maps DeviceInfo parameters to the appropriate download payload from downloads config
 */
function getRecommendation(info: DeviceInfo, currentDownloads: typeof DOWNLOADS): DownloadInfo | null {
  switch (info.os) {
    case 'Windows':
      if (info.architecture === 'ARM64') {
        return currentDownloads.windows.arm64;
      }
      return currentDownloads.windows.x64; // Default recommended Windows build
      
    case 'macOS':
      if (info.architecture === 'Apple Silicon') {
        return currentDownloads.macos.appleSilicon;
      }
      return currentDownloads.macos.intel;
      
    case 'Linux':
      // Recommend deb for Ubuntu/Debian/Mint/Pop!_OS/Kali
      if (info.linuxDistro === 'Ubuntu' || info.linuxDistro === 'Debian') {
        return currentDownloads.linux.deb;
      }
      // Recommend rpm for Fedora/RedHat/openSUSE
      if (info.linuxDistro === 'Fedora' || info.linuxDistro === 'RedHat' || info.linuxDistro === 'openSUSE') {
        return currentDownloads.linux.rpm;
      }
      // Default to AppImage for unknown Linux
      return currentDownloads.linux.appimage;
      
    case 'Android':
      return currentDownloads.android.apk;
      
    case 'iOS':
      return currentDownloads.ios.internal;
      
    default:
      return null; // Fallback handled by parent UI
  }
}
