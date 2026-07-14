export type DeviceOS = 'Windows' | 'macOS' | 'Linux' | 'Android' | 'iOS' | 'Unknown';
export type DeviceArch = 'x64' | 'x86' | 'ARM64' | 'Apple Silicon' | 'Unknown';
export type DeviceType = 'Mobile' | 'Tablet' | 'Desktop';
export type LinuxDistro = 'Ubuntu' | 'Debian' | 'Fedora' | 'openSUSE' | 'RedHat' | 'Unknown';

export interface DeviceInfo {
  os: DeviceOS;
  architecture: DeviceArch;
  deviceType: DeviceType;
  touchCapable: boolean;
  browser: string;
  linuxDistro?: LinuxDistro;
}

/**
 * Get GPU Unmasked Renderer name using WebGL debug renderer info.
 * This is the only reliable way to detect Apple Silicon on client side
 * when Safari reports the processor as Intel or hides it completely.
 */
function getGPURenderer(): string {
  if (typeof window === 'undefined') return '';
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return '';
    const dbgRenderInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!dbgRenderInfo) return '';
    return gl.getParameter(dbgRenderInfo.UNMASKED_RENDERER_WEBGL) || '';
  } catch {
    return '';
  }
}

/**
 * Get the current browser name based on User-Agent.
 */
function getBrowserName(ua: string): string {
  if (/samsungbrowser/i.test(ua)) return 'Samsung Internet';
  if (/chrome|crios/i.test(ua) && !/edge|edg/i.test(ua) && !/opr|opera/i.test(ua)) return 'Chrome';
  if (/safari/i.test(ua) && !/chrome|crios/i.test(ua) && !/edge|edg/i.test(ua)) return 'Safari';
  if (/firefox|fxios/i.test(ua)) return 'Firefox';
  if (/edge|edg/i.test(ua)) return 'Edge';
  if (/opr|opera/i.test(ua)) return 'Opera';
  return 'Unknown Browser';
}

/**
 * Returns complete device detection information synchronously.
 * For asynchronous high-entropy values (like Windows ARM64 detection),
 * we also provide a fallback and trigger an async update.
 */
export function detectDevice(): DeviceInfo {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      os: 'Unknown',
      architecture: 'Unknown',
      deviceType: 'Desktop',
      touchCapable: false,
      browser: 'Unknown',
    };
  }

  const ua = navigator.userAgent || '';
  const maxTouchPoints = navigator.maxTouchPoints || 0;
  const touchCapable = maxTouchPoints > 0;
  const browser = getBrowserName(ua);

  // 1. Detect iPad and iOS devices
  // iPadOS 13+ reports userAgent as Macintosh (macOS), but has touchPoints > 1
  const isMacLike = /macintosh|mac os x/i.test(ua);
  const isIPad = /ipad/i.test(ua) || (isMacLike && maxTouchPoints > 1);
  const isIPhone = /iphone|ipod/i.test(ua);
  const isIOS = isIPhone || isIPad;

  // 2. Detect Android
  const isAndroid = /android/i.test(ua);

  // 3. Detect OS Type
  let os: DeviceOS = 'Unknown';
  if (isAndroid) os = 'Android';
  else if (isIOS) os = 'iOS';
  else if (isMacLike) os = 'macOS';
  else if (/windows/i.test(ua)) os = 'Windows';
  else if (/linux/i.test(ua)) os = 'Linux';

  // 4. Detect Device Type
  let deviceType: DeviceType = 'Desktop';
  if (isIPhone || (/android/i.test(ua) && /mobile/i.test(ua))) {
    deviceType = 'Mobile';
  } else if (isIPad || isAndroid) {
    // iPad or any Android without 'mobile' in user-agent is classified as Tablet
    deviceType = isIPad ? 'Tablet' : 'Tablet';
  }

  // 5. Detect Architecture
  let architecture: DeviceArch = 'Unknown';

  if (os === 'macOS') {
    const gpu = getGPURenderer();
    // Apple Silicon GPU names contain 'Apple' and typically 'M1', 'M2', 'M3', 'M4' or 'Apple GPU'
    if (/apple/i.test(gpu)) {
      architecture = 'Apple Silicon';
    } else {
      architecture = 'x64';
    }
  } else if (os === 'Windows') {
    // Windows fallback detection via user-agent
    if (/arm64|arm/i.test(ua)) {
      architecture = 'ARM64';
    } else if (/x64|wow64|win64/i.test(ua)) {
      architecture = 'x64';
    } else if (/x86|win32|ia32/i.test(ua)) {
      architecture = 'x86';
    } else {
      // Standard fallback for Windows is x64 (as >98% of modern Windows devices are x64)
      architecture = 'x64';
    }
  } else if (os === 'Linux') {
    if (/aarch64|arm64|arm/i.test(ua)) {
      architecture = 'ARM64';
    } else {
      architecture = 'x64';
    }
  }

  let linuxDistro: LinuxDistro | undefined = undefined;
  if (os === 'Linux') {
    if (/ubuntu/i.test(ua)) linuxDistro = 'Ubuntu';
    else if (/debian/i.test(ua)) linuxDistro = 'Debian';
    else if (/mint/i.test(ua)) linuxDistro = 'Debian'; // Linux Mint is debian-based
    else if (/pop!_os|pop_os/i.test(ua)) linuxDistro = 'Debian'; // Pop!_OS is debian-based
    else if (/kali/i.test(ua)) linuxDistro = 'Debian'; // Kali is debian-based
    else if (/fedora/i.test(ua)) linuxDistro = 'Fedora';
    else if (/rhel|red hat|centos|rocky|alma/i.test(ua)) linuxDistro = 'RedHat';
    else if (/suse/i.test(ua)) linuxDistro = 'openSUSE';
    else linuxDistro = 'Unknown';
  }

  return {
    os,
    architecture,
    deviceType,
    touchCapable,
    browser,
    linuxDistro,
  };
}

/**
 * Async helper to retrieve high-entropy architecture values for Windows (Chromium browsers)
 */
export async function getAsyncArchitecture(currentInfo: DeviceInfo): Promise<DeviceArch> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return currentInfo.architecture;

  const nav = navigator as any;
  if (nav.userAgentData && typeof nav.userAgentData.getHighEntropyValues === 'function') {
    try {
      const entropy = await nav.userAgentData.getHighEntropyValues(['architecture']);
      if (entropy.architecture === 'arm') {
        return 'ARM64';
      } else if (entropy.architecture === 'x86') {
        // Double check x86_64 vs 32-bit x86
        if (currentInfo.architecture === 'x64') {
          return 'x64';
        }
        return 'x86';
      }
    } catch {
      // Suppress and fallback
    }
  }
  return currentInfo.architecture;
}
