import { useState, useEffect, useMemo } from 'react';
import { detectDevice, getAsyncArchitecture, DeviceInfo } from '@/utils/deviceDetection';
import { DOWNLOADS, DownloadInfo, MANIFEST_URL, REPO } from '@/config/downloads';
import { isNativeApp } from '@/utils/envHelper';

let hasLoggedFallbackWarning = false;

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
  const [loading, setLoading] = useState(true);

  // Compute recommendation dynamically from state
  const recommendation = useMemo(() => {
    return getRecommendation(deviceInfo, downloads);
  }, [deviceInfo, downloads]);

  useEffect(() => {
    // 1. Detect core device properties synchronously
    const info = detectDevice();
    setDeviceInfo(info);
    setLoading(false);

    const controller = new AbortController();
    let active = true;

    // 2. Fetch latest release manifest asynchronously to override URLs, sizes, and hashes
    const fetchManifest = async () => {
      if (isNativeApp()) {
        try {
          // Try fetching latest.json first
          const res = await fetch(MANIFEST_URL, { 
            cache: 'no-store',
            signal: controller.signal
          });
          if (res.ok) {
            const data = await res.json();
            if (active && data && data.version && data.downloads) {
              const notesText = data.notes || data.body || "";
              const dateStr = data.releaseDate || data.pub_date 
                ? new Date(data.releaseDate || data.pub_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) 
                : DOWNLOADS.windows.x64.releaseDate;

              const mergedDownloads = {
                windows: {
                  x64: { ...DOWNLOADS.windows.x64, ...data.downloads.windows?.x64, version: data.version, releaseDate: dateStr, releaseNotes: notesText },
                  arm64: { ...DOWNLOADS.windows.arm64, ...data.downloads.windows?.arm64, version: data.version, releaseDate: dateStr, releaseNotes: notesText }
                },
                macos: {
                  universal: { ...DOWNLOADS.macos.universal, ...data.downloads.macos?.universal, version: data.version, releaseDate: dateStr, releaseNotes: notesText },
                  appleSilicon: { ...DOWNLOADS.macos.appleSilicon, ...data.downloads.macos?.appleSilicon, version: data.version, releaseDate: dateStr, releaseNotes: notesText },
                  intel: { ...DOWNLOADS.macos.intel, ...data.downloads.macos?.intel, version: data.version, releaseDate: dateStr, releaseNotes: notesText }
                },
                linux: {
                  deb: { ...DOWNLOADS.linux.deb, ...data.downloads.linux?.deb, version: data.version, releaseDate: dateStr, releaseNotes: notesText },
                  appimage: { ...DOWNLOADS.linux.appimage, ...data.downloads.linux?.appimage, version: data.version, releaseDate: dateStr, releaseNotes: notesText },
                  rpm: { ...DOWNLOADS.linux.rpm, ...data.downloads.linux?.rpm, version: data.version, releaseDate: dateStr, releaseNotes: notesText }
                },
                android: {
                  apk: { ...DOWNLOADS.android.apk, ...data.downloads.android?.apk, version: data.version, releaseDate: dateStr, releaseNotes: notesText }
                }
              };
              setDownloads(mergedDownloads);
              return;
            }
          }
        } catch (err: any) {
          if (err.name === 'AbortError') return;
          console.warn('[useDeviceInfo] Failed to fetch latest.json, trying GitHub API fallback:', err);
        }
      }

      // GitHub API Fallback
      try {
        const ghUrl = `https://api.github.com/repos/${REPO}/releases/latest`;
        const ghRes = await fetch(ghUrl, { signal: controller.signal });
        if (!ghRes.ok) throw new Error(`GitHub API error! status: ${ghRes.status}`);
        const releaseData = await ghRes.json();

        if (active && releaseData && releaseData.assets) {
          const assets = releaseData.assets;
          const releaseVersion = releaseData.tag_name.replace(/^v/, '');
          const notesText = releaseData.body || "";
          const dateStr = releaseData.published_at
            ? new Date(releaseData.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
            : DOWNLOADS.windows.x64.releaseDate;

          const getAssetInfo = (checker: (name: string) => boolean) => {
            const asset = assets.find((a: any) => checker(a.name.toLowerCase()));
            if (asset) {
              return {
                fileSize: `${(asset.size / (1024 * 1024)).toFixed(1)} MB`,
                url: asset.browser_download_url
              };
            }
            return null;
          };

          const winX64Info = getAssetInfo(n => n.includes('x64-setup.exe') || n.includes('x64_setup.exe'));
          const winArmInfo = getAssetInfo(n => n.includes('arm64-setup.exe') || n.includes('arm64_setup.exe'));
          const macUnivInfo = getAssetInfo(n => n.endsWith('.dmg') && n.includes('universal'));
          const macSiliconInfo = getAssetInfo(n => n.endsWith('.dmg') && (n.includes('aarch64') || n.includes('arm64')));
          const macIntelInfo = getAssetInfo(n => n.endsWith('.dmg') && (n.includes('x64') || n.includes('x86_64')) && !n.includes('aarch64') && !n.includes('arm64') && !n.includes('universal'));
          const linuxDebInfo = getAssetInfo(n => n.endsWith('.deb'));
          const linuxAppImageInfo = getAssetInfo(n => n.endsWith('.appimage'));
          const linuxRpmInfo = getAssetInfo(n => n.endsWith('.rpm'));
          const androidApkInfo = getAssetInfo(n => n.endsWith('.apk'));

          const mergedDownloads = {
            windows: {
              x64: { ...DOWNLOADS.windows.x64, ...(winX64Info || {}), version: releaseVersion, releaseDate: dateStr, releaseNotes: notesText },
              arm64: { ...DOWNLOADS.windows.arm64, ...(winArmInfo || {}), version: releaseVersion, releaseDate: dateStr, releaseNotes: notesText }
            },
            macos: {
              universal: { ...DOWNLOADS.macos.universal, ...(macUnivInfo || {}), version: releaseVersion, releaseDate: dateStr, releaseNotes: notesText },
              appleSilicon: { ...DOWNLOADS.macos.appleSilicon, ...(macSiliconInfo || {}), version: releaseVersion, releaseDate: dateStr, releaseNotes: notesText },
              intel: { ...DOWNLOADS.macos.intel, ...(macIntelInfo || {}), version: releaseVersion, releaseDate: dateStr, releaseNotes: notesText }
            },
            linux: {
              deb: { ...DOWNLOADS.linux.deb, ...(linuxDebInfo || {}), version: releaseVersion, releaseDate: dateStr, releaseNotes: notesText },
              appimage: { ...DOWNLOADS.linux.appimage, ...(linuxAppImageInfo || {}), version: releaseVersion, releaseDate: dateStr, releaseNotes: notesText },
              rpm: { ...DOWNLOADS.linux.rpm, ...(linuxRpmInfo || {}), version: releaseVersion, releaseDate: dateStr, releaseNotes: notesText },
            },
            android: {
              apk: { ...DOWNLOADS.android.apk, ...(androidApkInfo || {}), version: releaseVersion, releaseDate: dateStr, releaseNotes: notesText }
            }
          };
          setDownloads(mergedDownloads);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        if (!hasLoggedFallbackWarning) {
          console.warn('[useDeviceInfo] Failed to fetch latest release metadata:', err.message || err);
          hasLoggedFallbackWarning = true;
        }
      }
    };

    fetchManifest();

    // 3. Query async high entropy values (for Windows/Chromium architecture refinements)
    getAsyncArchitecture(info).then((refinedArch) => {
      if (active && refinedArch !== info.architecture) {
        setDeviceInfo(prev => ({ ...prev, architecture: refinedArch }));
      }
    });

    return () => {
      active = false;
      controller.abort();
    };
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
      if (info.architecture === 'Apple Silicon' || info.architecture === 'ARM64') {
        return currentDownloads.macos.appleSilicon;
      }
      if (info.architecture === 'x64') {
        return currentDownloads.macos.intel;
      }
      return currentDownloads.macos.universal;
      
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
      
    default:
      return null; // Fallback handled by parent UI
  }
}
