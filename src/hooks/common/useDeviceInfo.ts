import { useState, useEffect } from 'react';
import { detectDevice, getAsyncArchitecture, DeviceInfo } from '@/utils/deviceDetection';
import { DOWNLOADS, DownloadInfo } from '@/config/downloads';

export interface UseDeviceInfoResult {
  deviceInfo: DeviceInfo;
  recommendation: DownloadInfo | null;
  loading: boolean;
}

export function useDeviceInfo(): UseDeviceInfoResult {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    os: 'Unknown',
    architecture: 'Unknown',
    deviceType: 'Desktop',
    touchCapable: false,
    browser: 'Unknown',
  });
  const [recommendation, setRecommendation] = useState<DownloadInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Synchronously detect core device parameters
    const info = detectDevice();
    setDeviceInfo(info);
    
    // 2. Resolve download recommendation based on sync values
    let initialRec = getRecommendation(info);
    setRecommendation(initialRec);
    setLoading(false);

    // 3. Query async high entropy values (for Windows/Chromium architecture refinements)
    getAsyncArchitecture(info).then((refinedArch) => {
      if (refinedArch !== info.architecture) {
        const refinedInfo = { ...info, architecture: refinedArch };
        setDeviceInfo(refinedInfo);
        setRecommendation(getRecommendation(refinedInfo));
      }
    });
  }, []);

  return {
    deviceInfo,
    recommendation,
    loading,
  };
}

/**
 * Maps DeviceInfo parameters to the appropriate download payload from downloads.ts
 */
function getRecommendation(info: DeviceInfo): DownloadInfo | null {
  switch (info.os) {
    case 'Windows':
      if (info.architecture === 'ARM64') {
        return DOWNLOADS.windows.arm64;
      } else if (info.architecture === 'x86') {
        return DOWNLOADS.windows.x86;
      }
      return DOWNLOADS.windows.x64; // Default recommended Windows build
      
    case 'macOS':
      if (info.architecture === 'Apple Silicon') {
        return DOWNLOADS.macos.appleSilicon;
      }
      return DOWNLOADS.macos.intel;
      
    case 'Linux':
      return DOWNLOADS.linux.x64;
      
    case 'Android':
      return DOWNLOADS.android.apk;
      
    case 'iOS':
      return DOWNLOADS.ios.internal;
      
    default:
      return null; // Fallback handled by the parent UI
  }
}
