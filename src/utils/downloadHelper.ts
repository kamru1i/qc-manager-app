/**
 * Shared utility for downloading the latest desktop app installer from GitHub Releases.
 * Used in both Navbar.tsx and login/page.tsx to eliminate code duplication.
 */

const GITHUB_RELEASES_URL = "https://api.github.com/repos/kamrulislam2/quotes-and-sales-tracker/releases/latest";
const GITHUB_RELEASES_FALLBACK = "https://github.com/kamrulislam2/quotes-and-sales-tracker/releases/latest";

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}

export type DownloadPlatform = 'windows' | 'macos-silicon' | 'macos-intel';

export const downloadLatestRelease = async (platform: DownloadPlatform): Promise<void> => {
  try {
    const res = await fetch(GITHUB_RELEASES_URL);
    if (!res.ok) throw new Error("Failed to fetch release");
    const release = await res.json();

    const assets: ReleaseAsset[] = release.assets || [];
    let downloadUrl = "";

    if (platform === 'windows') {
      const exeAsset = assets.find((asset) => asset.name.endsWith('.exe'));
      if (exeAsset) downloadUrl = exeAsset.browser_download_url;
    } else if (platform === 'macos-silicon') {
      const siliconAsset = assets.find((asset) =>
        asset.name.endsWith('.dmg') && (asset.name.includes('aarch64') || asset.name.includes('arm64'))
      );
      if (siliconAsset) downloadUrl = siliconAsset.browser_download_url;
    } else if (platform === 'macos-intel') {
      const intelAsset = assets.find((asset) =>
        asset.name.endsWith('.dmg') && (asset.name.includes('x64') || asset.name.includes('x86_64'))
      );
      if (intelAsset) downloadUrl = intelAsset.browser_download_url;
    }

    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
    } else {
      window.open(GITHUB_RELEASES_FALLBACK, '_blank');
    }
  } catch (err) {
    console.error("Failed to fetch latest download link:", err);
    window.open(GITHUB_RELEASES_FALLBACK, '_blank');
  }
};
