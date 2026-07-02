import { useState, useEffect } from "react";

export interface ReleaseLinks {
  windows: string;
  macSilicon: string;
  macIntel: string;
  loading: boolean;
  version: string;
}

const REPO = "kamrulislam2/qc-manager-app";
const DEFAULT_VERSION = "1.0.0";

export function useAppReleaseLinks(): ReleaseLinks {
  const [links, setLinks] = useState<ReleaseLinks>({
    windows: `https://github.com/${REPO}/releases/latest`,
    macSilicon: `https://github.com/${REPO}/releases/latest`,
    macIntel: `https://github.com/${REPO}/releases/latest`,
    loading: true,
    version: DEFAULT_VERSION,
  });

  useEffect(() => {
    let active = true;

    async function fetchRelease() {
      try {
        const response = await fetch(
          `https://api.github.com/repos/${REPO}/releases/latest`,
        );
        if (!response.ok) throw new Error("Failed to fetch release");
        const data = await response.json();

        if (!active) return;

        const assets = data.assets || [];
        const versionStr = data.tag_name
          ? data.tag_name.replace(/^v/, "")
          : DEFAULT_VERSION;

        let windowsLink = "";
        let siliconLink = "";
        let intelLink = "";

        for (const asset of assets) {
          const name = asset.name.toLowerCase();
          const url = asset.browser_download_url;

          if (name.endsWith(".exe")) {
            windowsLink = url;
          } else if (name.endsWith(".dmg")) {
            if (name.includes("aarch64") || name.includes("arm64")) {
              siliconLink = url;
            } else if (name.includes("x64") || name.includes("x86_64")) {
              intelLink = url;
            }
          }
        }

        // Fallbacks if not found in assets
        const fallbackBase = `https://github.com/${REPO}/releases/download/v${versionStr}`;

        setLinks({
          windows:
            windowsLink || `${fallbackBase}/QC-Manager-App_${versionStr}_x64-setup.exe`,
          macSilicon:
            siliconLink || `${fallbackBase}/QC-Manager-App_${versionStr}_aarch64.dmg`,
          macIntel: intelLink || `${fallbackBase}/QC-Manager-App_${versionStr}_x64.dmg`,
          loading: false,
          version: versionStr,
        });
      } catch (err: any) {
        console.warn("Using local fallback release links:", err?.message || err);
        if (active) {
          // Hardcoded fallback using default version
          const fallbackBase = `https://github.com/${REPO}/releases/download/v${DEFAULT_VERSION}`;
          setLinks({
            windows: `${fallbackBase}/QC-Manager-App_${DEFAULT_VERSION}_x64-setup.exe`,
            macSilicon: `${fallbackBase}/QC-Manager-App_${DEFAULT_VERSION}_aarch64.dmg`,
            macIntel: `${fallbackBase}/QC-Manager-App_${DEFAULT_VERSION}_x64.dmg`,
            loading: false,
            version: DEFAULT_VERSION,
          });
        }
      }
    }

    fetchRelease();
    return () => {
      active = false;
    };
  }, []);

  return links;
}
