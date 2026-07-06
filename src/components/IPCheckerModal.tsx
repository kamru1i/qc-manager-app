"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Search,
  Globe,
  AlertTriangle,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { IPCheckerSkeleton } from "./skeleton/IPCheckerSkeleton";

interface WindowWithTauri extends Window {
  __TAURI__?: {
    core: {
      invoke: (cmd: string, args?: Record<string, unknown>) => Promise<string>;
    };
  };
}

interface IPCheckerModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast: (type: "success" | "error", text: string) => void;
}

interface SourceResult {
  success: boolean;
  countryCode?: string;
  countryName?: string;
  isp?: string;
  isProxyOrVpn?: boolean;
  riskDetails?: string[];
  error?: string;
  rawData?: unknown;
}

interface IPNetResponse {
  error?: string;
  response_code?: string;
  response_message?: string;
  country_code2?: string;
  country_name?: string;
  isp?: string;
}

interface IPWhoIsResponse {
  success?: boolean;
  message?: string;
  country_code?: string;
  city?: string;
  region?: string;
  country?: string;
  connection?: { isp?: string };
  security?: { vpn?: boolean; proxy?: boolean; tor?: boolean };
}

interface IPApiResponse {
  status?: string;
  message?: string;
  country?: string;
  countryCode?: string;
  region?: string;
  regionName?: string;
  city?: string;
  isp?: string;
  org?: string;
  proxy?: boolean;
  hosting?: boolean;
}

interface IP2LocationResponse {
  error?: { error_message?: string };
  country_code?: string;
  country_name?: string;
  city_name?: string;
  region_name?: string;
  as?: string;
  is_proxy?: boolean;
}

interface CriminalIPResponse {
  error?: string;
  country_code?: string;
  country?: string;
  region?: string;
  city?: string;
  isp?: string;
  org_name?: string;
  score?: { inbound?: number; outbound?: number };
}

interface IPInfoResponse {
  error?: { message?: string };
  country?: string;
  city?: string;
  region?: string;
  org?: string;
  privacy?: {
    vpn?: boolean;
    proxy?: boolean;
    tor?: boolean;
    hosting?: boolean;
  };
}

export const IPCheckerModal: React.FC<IPCheckerModalProps> = ({
  isOpen,
  onClose,
  showToast,
}) => {
  const [ipInput, setIpInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [detectingIP, setDetectingIP] = useState(false);
  const [checkRan, setCheckRan] = useState(false);
  const [results, setResults] = useState<Record<string, SourceResult>>({});

  const detectMyIP = async () => {
    setDetectingIP(true);
    const delayPromise = new Promise((resolve) => setTimeout(resolve, 450));
    try {
      const isTauri =
        typeof window !== "undefined" &&
        (window as unknown as WindowWithTauri).__TAURI__ !== undefined;
      let ipDetected = "";

      if (isTauri) {
        try {
          const { invoke } = (window as unknown as WindowWithTauri).__TAURI__!
            .core;
          const resJsonStr = await invoke("detect_my_ip");
          const data = JSON.parse(resJsonStr);
          if (data && data.ip) {
            ipDetected = data.ip;
          }
        } catch (err) {
          console.warn(
            "Tauri native IP detection failed, falling back to browser:",
            err,
          );
        }
      }

      if (!ipDetected) {
        const res = await fetch("https://api.ipify.org?format=json");
        const data = await res.json();
        if (data && data.ip) {
          ipDetected = data.ip;
        }
      }

      await delayPromise;
      if (ipDetected) {
        setIpInput(ipDetected);
      }
    } catch (err) {
      console.warn("Failed to auto-detect IP:", err);
    } finally {
      setDetectingIP(false);
    }
  };

  // Detect user's own IP on mount
  useEffect(() => {
    if (isOpen) {
      detectMyIP();
    }
  }, [isOpen]);

  const secureFetch = async (
    url: string,
    headers?: Record<string, string>,
  ): Promise<Record<string, unknown>> => {
    const isTauri =
      typeof window !== "undefined" &&
      (window as unknown as WindowWithTauri).__TAURI__ !== undefined;

    if (isTauri) {
      try {
        const { invoke } = (window as unknown as WindowWithTauri).__TAURI__!
          .core;
        const resJsonStr = await invoke("fetch_ip_data", { url, headers });
        return JSON.parse(resJsonStr) as Record<string, unknown>;
      } catch (err: unknown) {
        console.warn(
          "Tauri native fetch failed, falling back to browser proxy:",
          err,
        );
      }
    }

    // If running in local browser development (localhost)
    const isLocalhost =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1");

    if (isLocalhost) {
      let localUrl = url;
      if (url.includes("api.ip2location.io")) {
        localUrl = url.replace(
          "https://api.ip2location.io",
          "/api-proxy/ip2location",
        );
      } else if (url.includes("api.criminalip.io")) {
        localUrl = url.replace(
          "https://api.criminalip.io",
          "/api-proxy/criminalip",
        );
      }

      try {
        const res = await fetch(localUrl, { headers });
        if (res.ok) return await res.json();
      } catch (err) {
        console.warn(
          "Local Next.js proxy failed, falling back to public proxies:",
          err,
        );
      }
    }

    // Web browser fallback logic for CORS-restricted endpoints
    const needsProxy =
      url.includes("ip2location.io") ||
      url.includes("criminalip.io") ||
      url.startsWith("http:");

    if (needsProxy) {
      // Try corsproxy.io (supports headers)
      try {
        const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(url)}`;
        const res = await fetch(proxyUrl, { headers });
        if (res.ok) {
          return await res.json();
        }
      } catch (err) {
        console.warn("corsproxy.io failed, trying allorigins:", err);
      }

      // Try allorigins JSON proxy wrapper as backup
      try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const res = await fetch(proxyUrl);
        if (res.ok) {
          const json = await res.json();
          if (json.contents) {
            return JSON.parse(json.contents);
          }
        }
      } catch (err) {
        console.warn("allorigins proxy failed:", err);
      }
    }

    // Direct fetch fallback
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return res.json();
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    // Simple validation
    const ip = ipInput.trim();
    if (!ip) {
      showToast("error", "Please enter a valid IP address.");
      return;
    }

    setLoading(true);
    setCheckRan(true);
    setResults({});

    const getVal = (val: string | undefined, fallback: string) => {
      if (!val || val === "undefined" || val === "null" || val.trim() === "") {
        return fallback;
      }
      return val;
    };

    const keys = {
      ip2location: getVal(
        process.env.NEXT_PUBLIC_IP2LOCATION_KEY,
        "1E4F8D829EB655156668EFD8905579A6",
      ),
      criminalip: getVal(
        process.env.NEXT_PUBLIC_CRIMINALIP_KEY,
        "xXpD3Dop7ZadNywdkiRYDm1IOhuONgFV1m1QMIm7RhUJ638i50sjUJ858Kxi",
      ),
      ipinfo: getVal(process.env.NEXT_PUBLIC_IPINFO_TOKEN, "292d4695dfb892"),
    };

    // ─── QUERY SOURCE 1: IPLOCATION.NET ───
    const fetchIPLocationNet = async (): Promise<SourceResult> => {
      try {
        const data = (await secureFetch(
          `https://api.iplocation.net/?ip=${ip}`,
        )) as unknown as IPNetResponse;
        if (data.response_code !== "200")
          throw new Error(data.response_message || "Fetch failed");

        return {
          success: true,
          countryCode: data.country_code2,
          countryName: data.country_name,
          isp: data.isp,
          isProxyOrVpn: false,
          rawData: data,
        };
      } catch (err: unknown) {
        return {
          success: false,
          error: (err as Error).message || "Request failed",
        };
      }
    };

    // ─── QUERY SOURCE 2: IPWHO.IS ───
    const fetchIPWhoIs = async (): Promise<SourceResult> => {
      try {
        const data = (await secureFetch(
          `https://ipwho.is/${ip}`,
        )) as unknown as IPWhoIsResponse;
        if (!data.success) throw new Error(data.message || "Lookup failed");

        const risks: string[] = [];
        const isVpn = data.security?.vpn === true;
        const isProxy = data.security?.proxy === true;
        const isTor = data.security?.tor === true;
        if (isVpn) risks.push("VPN");
        if (isProxy) risks.push("Proxy");
        if (isTor) risks.push("Tor exit node");

        return {
          success: true,
          countryCode: data.country_code,
          countryName: `${data.city ? data.city + ", " : ""}${data.region ? data.region + ", " : ""}${data.country || ""}`,
          isp: data.connection?.isp,
          isProxyOrVpn: isVpn || isProxy || isTor,
          riskDetails: risks,
          rawData: data,
        };
      } catch (err: unknown) {
        return {
          success: false,
          error: (err as Error).message || "Request failed",
        };
      }
    };

    // ─── QUERY SOURCE 3: IP-API.COM ───
    const fetchIPApi = async (): Promise<SourceResult> => {
      try {
        const data = (await secureFetch(
          `http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,isp,org,as,proxy,hosting,query`,
        )) as unknown as IPApiResponse;
        if (data.status !== "success")
          throw new Error(data.message || "Lookup failed");

        const risks: string[] = [];
        if (data.proxy) risks.push("Proxy/VPN");
        if (data.hosting) risks.push("Hosting/Data Center");

        return {
          success: true,
          countryCode: data.countryCode,
          countryName: `${data.city ? data.city + ", " : ""}${data.regionName ? data.regionName + ", " : ""}${data.country || ""}`,
          isp: data.isp || data.org,
          isProxyOrVpn: data.proxy === true || data.hosting === true,
          riskDetails: risks,
          rawData: data,
        };
      } catch (err: unknown) {
        return {
          success: false,
          error: (err as Error).message || "Request failed",
        };
      }
    };

    // ─── QUERY SOURCE 4: IP2LOCATION.IO ───
    const fetchIP2LocationIo = async (): Promise<SourceResult> => {
      try {
        const data = (await secureFetch(
          `https://api.ip2location.io/?key=${keys.ip2location}&ip=${ip}`,
        )) as unknown as IP2LocationResponse;
        if (data.error)
          throw new Error(data.error.error_message || "Lookup failed");

        const risks: string[] = [];
        const isProxy = data.is_proxy === true;
        if (isProxy) risks.push("Proxy/VPN/Tor");

        return {
          success: true,
          countryCode: data.country_code,
          countryName: `${data.city_name ? data.city_name + ", " : ""}${data.region_name ? data.region_name + ", " : ""}${data.country_name || ""}`,
          isp: data.as,
          isProxyOrVpn: isProxy,
          riskDetails: risks,
          rawData: data,
        };
      } catch (err: unknown) {
        return {
          success: false,
          error: (err as Error).message || "Request failed",
        };
      }
    };

    // ─── QUERY SOURCE 5: CRIMINALIP.IO ───
    const fetchCriminalIP = async (): Promise<SourceResult> => {
      try {
        const data = (await secureFetch(
          `https://api.criminalip.io/v1/ip/summary?ip=${ip}`,
          {
            "x-api-key": keys.criminalip,
          },
        )) as unknown as CriminalIPResponse;

        const risks: string[] = [];
        const scoreIn = data.score?.inbound || 1;

        if (scoreIn > 3) risks.push("High Risk Level");

        return {
          success: true,
          countryCode: data.country_code,
          countryName: `${data.city ? data.city + ", " : ""}${data.region ? data.region + ", " : ""}${data.country || ""}`,
          isp: data.isp,
          isProxyOrVpn: scoreIn > 3,
          riskDetails: risks,
          rawData: data,
        };
      } catch (err: unknown) {
        return {
          success: false,
          error: (err as Error).message || "Request failed",
        };
      }
    };

    // ─── QUERY SOURCE 6: IPINFO.IO ───
    const fetchIPInfoIo = async (): Promise<SourceResult> => {
      try {
        const data = (await secureFetch(
          `https://ipinfo.io/${ip}/json?token=${keys.ipinfo}`,
        )) as unknown as IPInfoResponse;

        const risks: string[] = [];
        const isVpn = data.privacy?.vpn === true;
        const isProxy = data.privacy?.proxy === true;
        const isTor = data.privacy?.tor === true;
        const isHosting = data.privacy?.hosting === true;

        if (isVpn) risks.push("VPN");
        if (isProxy) risks.push("Proxy");
        if (isTor) risks.push("Tor Exit");
        if (isHosting) risks.push("Hosting/Data Center");

        return {
          success: true,
          countryCode: data.country,
          countryName: `${data.city ? data.city + ", " : ""}${data.region ? data.region + ", " : ""}${data.country || ""}`,
          isp: data.org,
          isProxyOrVpn: isVpn || isProxy || isTor || isHosting,
          riskDetails: risks,
          rawData: data,
        };
      } catch (err: unknown) {
        return {
          success: false,
          error: (err as Error).message || "Request failed",
        };
      }
    };

    // ─── TAURI DESKTOP: TRUE PARALLEL NATIVE BATCH FETCH ───
    const isTauri =
      typeof window !== "undefined" &&
      (window as unknown as WindowWithTauri).__TAURI__ !== undefined;

    if (isTauri) {
      try {
        const { invoke } = (window as unknown as WindowWithTauri).__TAURI__!
          .core;

        const batchRequests = [
          { url: `https://api.iplocation.net/?ip=${ip}`, headers: null },
          { url: `https://ipwho.is/${ip}`, headers: null },
          {
            url: `http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,isp,org,as,proxy,hosting,query`,
            headers: null,
          },
          {
            url: `https://api.ip2location.io/?key=${keys.ip2location}&ip=${ip}`,
            headers: null,
          },
          {
            url: `https://api.criminalip.io/v1/ip/summary?ip=${ip}`,
            headers: { "x-api-key": keys.criminalip },
          },
          {
            url: `https://ipinfo.io/${ip}/json?token=${keys.ipinfo}`,
            headers: null,
          },
        ];

        const delayPromise = new Promise((resolve) => setTimeout(resolve, 550));
        const [rawResults] = await Promise.all([
          invoke("fetch_ip_batch", {
            requests: batchRequests,
          }) as unknown as Promise<string[]>,
          delayPromise,
        ]);

        // Parse each result using inline parsers
        const parsers: Array<{
          name: string;
          parse: (data: Record<string, unknown>) => SourceResult;
        }> = [
          {
            name: "IPLocation.net",
            parse: (data) => {
              const d = data as unknown as IPNetResponse;
              if (d.error || d.response_code !== "200")
                return {
                  success: false,
                  error: d.error || d.response_message || "Fetch failed",
                };
              return {
                success: true,
                countryCode: d.country_code2,
                countryName: d.country_name,
                isp: d.isp,
                isProxyOrVpn: false,
                rawData: d,
              };
            },
          },
          {
            name: "IPWho.is",
            parse: (data) => {
              const d = data as unknown as IPWhoIsResponse;
              if (d.message || !d.success)
                return { success: false, error: d.message || "Lookup failed" };
              const risks: string[] = [];
              if (d.security?.vpn) risks.push("VPN");
              if (d.security?.proxy) risks.push("Proxy");
              if (d.security?.tor) risks.push("Tor exit node");
              return {
                success: true,
                countryCode: d.country_code,
                countryName: `${d.city ? d.city + ", " : ""}${d.region ? d.region + ", " : ""}${d.country || ""}`,
                isp: d.connection?.isp,
                isProxyOrVpn: risks.length > 0,
                riskDetails: risks,
                rawData: d,
              };
            },
          },
          {
            name: "IP-API.com",
            parse: (data) => {
              const d = data as unknown as IPApiResponse;
              if (d.status !== "success")
                return { success: false, error: d.message || "Lookup failed" };
              const risks: string[] = [];
              if (d.proxy) risks.push("Proxy/VPN");
              if (d.hosting) risks.push("Hosting/Data Center");
              return {
                success: true,
                countryCode: d.countryCode,
                countryName: `${d.city ? d.city + ", " : ""}${d.regionName ? d.regionName + ", " : ""}${d.country || ""}`,
                isp: d.isp || d.org,
                isProxyOrVpn: d.proxy === true || d.hosting === true,
                riskDetails: risks,
                rawData: d,
              };
            },
          },
          {
            name: "IP2Location.io",
            parse: (data) => {
              const d = data as unknown as IP2LocationResponse;
              if (d.error)
                return { success: false, error: d.error.error_message };
              const risks: string[] = [];
              if (d.is_proxy) risks.push("Proxy/VPN/Tor");
              return {
                success: true,
                countryCode: d.country_code,
                countryName: `${d.city_name ? d.city_name + ", " : ""}${d.region_name ? d.region_name + ", " : ""}${d.country_name || ""}`,
                isp: d.as,
                isProxyOrVpn: d.is_proxy === true,
                riskDetails: risks,
                rawData: d,
              };
            },
          },
          {
            name: "CriminalIP.io",
            parse: (data) => {
              const d = data as unknown as CriminalIPResponse;
              if (d.error) return { success: false, error: d.error };
              const risks: string[] = [];
              const scoreIn = d.score?.inbound || 1;
              const scoreOut = d.score?.outbound || 1;
              if (scoreIn > 3 || scoreOut > 3) risks.push("High Risk Level");
              return {
                success: true,
                countryCode: d.country_code,
                countryName: `${d.city ? d.city + ", " : ""}${d.region ? d.region + ", " : ""}${d.country || ""}`,
                isp: d.isp || d.org_name,
                isProxyOrVpn: scoreIn > 3,
                riskDetails: risks,
                rawData: d,
              };
            },
          },
          {
            name: "IPInfo.io",
            parse: (data) => {
              const d = data as unknown as IPInfoResponse & {
                error?: { title?: string };
              };
              if (d.error)
                return {
                  success: false,
                  error: typeof d.error === "object" ? d.error.title : d.error,
                };
              const risks: string[] = [];
              if (d.privacy?.vpn) risks.push("VPN");
              if (d.privacy?.proxy) risks.push("Proxy");
              if (d.privacy?.tor) risks.push("Tor Exit");
              if (d.privacy?.hosting) risks.push("Hosting/Data Center");
              return {
                success: true,
                countryCode: d.country,
                countryName: `${d.city ? d.city + ", " : ""}${d.region ? d.region + ", " : ""}${d.country || ""}`,
                isp: d.org,
                isProxyOrVpn: !!(
                  d.privacy?.vpn ||
                  d.privacy?.proxy ||
                  d.privacy?.tor ||
                  d.privacy?.hosting
                ),
                riskDetails: risks,
                rawData: d,
              };
            },
          },
        ];

        const parsed: Record<string, SourceResult> = {};
        rawResults.forEach((raw, i) => {
          try {
            const data = JSON.parse(raw);
            parsed[parsers[i].name] =
              parsed[parsers[i].name] || parsers[i].parse(data);
          } catch {
            parsed[parsers[i].name] = {
              success: false,
              error: "Failed to parse response",
            };
          }
        });

        setResults(parsed);
        setLoading(false);
      } catch (err: unknown) {
        console.warn("Tauri batch fetch failed:", err);
        const errorMsg =
          (err as Error).message ||
          (typeof err === "object" && err !== null
            ? JSON.stringify(err)
            : String(err));
        const parsed: Record<string, SourceResult> = {};
        const sourceNames = [
          "IPLocation.net",
          "IPWho.is",
          "IP-API.com",
          "IP2Location.io",
          "CriminalIP.io",
          "IPInfo.io",
        ];
        sourceNames.forEach((name) => {
          parsed[name] = { success: false, error: `Tauri error: ${errorMsg}` };
        });
        setResults(parsed);
        setLoading(false);
        return;
      }
    }

    // ─── BROWSER FALLBACK: Promise.all with secureFetch ───
    const delayPromise = new Promise((resolve) => setTimeout(resolve, 550));
    const [fetchedResults] = await Promise.all([
      Promise.all([
        fetchIPLocationNet(),
        fetchIPWhoIs(),
        fetchIPApi(),
        fetchIP2LocationIo(),
        fetchCriminalIP(),
        fetchIPInfoIo(),
      ]),
      delayPromise,
    ]);

    const [iploc, whois, ipapi, ip2loc, criminal, ipinfo] = fetchedResults;

    setResults({
      "IPLocation.net": iploc,
      "IPWho.is": whois,
      "IP-API.com": ipapi,
      "IP2Location.io": ip2loc,
      "CriminalIP.io": criminal,
      "IPInfo.io": ipinfo,
    });

    setLoading(false);
  };

  const handleClose = () => {
    setIpInput("");
    setCheckRan(false);
    setResults({});
    onClose();
  };

  // Compute final safety validation
  const totalSources = Object.keys(results).length;
  const successfulSources = Object.values(results).filter((r) => r.success);
  const countryMismatches = successfulSources.filter(
    (r) =>
      r.countryCode &&
      r.countryCode.toUpperCase() !== "GB" &&
      r.countryCode.toUpperCase() !== "UK",
  );
  const detectedProxies = successfulSources.filter((r) => r.isProxyOrVpn);

  const isGeoSafe =
    successfulSources.length > 0 && countryMismatches.length === 0;
  const isSecuritySafe = detectedProxies.length === 0;
  const isAllSafe = isGeoSafe && isSecuritySafe;

  const calculateSafetyScore = () => {
    if (successfulSources.length === 0) return 0;

    let totalScore = 0;
    successfulSources.forEach((src) => {
      let srcScore = 0;

      // 1. Location check (50% weight)
      const isUK =
        src.countryCode?.toUpperCase() === "GB" ||
        src.countryCode?.toUpperCase() === "UK";
      if (isUK) {
        srcScore += 50;
      }

      // 2. Security check (50% weight)
      if (!src.isProxyOrVpn) {
        srcScore += 50;
      }

      totalScore += srcScore;
    });

    return Math.round(totalScore / successfulSources.length);
  };

  const safetyScore = calculateSafetyScore();
  const riskScore = 100 - safetyScore;

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-100 flex items-center justify-center px-4 py-8 overflow-y-auto animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-4xl shadow-2xl relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-800 shrink-0">
          <h3 className="text-md font-bold text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-500" />
            IP Address Safety Directory
          </h3>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-slate-400 hover:text-white hover:bg-slate-800 p-1.5 rounded-lg transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto py-5 space-y-6 pr-1 custom-scrollbar">
          {/* Search System */}
          <div className="flex justify-center w-full pb-2">
            <form
              onSubmit={handleSearch}
              className="flex gap-2 w-full max-w-md"
            >
              <div className="relative flex-1">
                {detectingIP ? (
                  <Loader2 className="absolute left-3 top-2.5 h-4 w-4 text-blue-500 animate-spin" />
                ) : (
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                )}
                <input
                  type="text"
                  required
                  disabled={loading || detectingIP}
                  placeholder={
                    detectingIP
                      ? "Detecting current IP..."
                      : "e.g. 45.125.223.33"
                  }
                  value={ipInput}
                  onChange={(e) => setIpInput(e.target.value)}
                  className="w-full pl-9 pr-20 py-2 bg-slate-955/80 border border-slate-800 rounded-xl text-white placeholder-slate-650 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={detectMyIP}
                  disabled={loading || detectingIP}
                  className="absolute right-1.5 top-1.5 px-2 py-0.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white text-[10px] font-semibold rounded-md transition-all cursor-pointer hover:bg-slate-800 flex items-center justify-center min-w-[48px] disabled:opacity-50"
                >
                  {detectingIP ? (
                    <Loader2 className="w-3 h-3 animate-spin text-slate-500" />
                  ) : (
                    "My IP"
                  )}
                </button>
              </div>
              <button
                type="submit"
                disabled={loading || detectingIP}
                className="px-5 py-2 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-md shadow-blue-500/10 hover:shadow-blue-500/20"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Checking
                  </>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5" />
                    Check IP
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Validation Header Summary */}
          {checkRan && !loading && (
            <div
              className={`p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                isAllSafe
                  ? "bg-emerald-950/20 border-emerald-500/20 text-emerald-350"
                  : "bg-rose-950/20 border-rose-500/20 text-rose-350"
              }`}
            >
              <div className="flex items-start gap-3">
                {isAllSafe ? (
                  <CheckCircle className="w-10 h-10 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-10 h-10 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className="font-bold text-base text-white flex flex-wrap items-center gap-2">
                    {isAllSafe
                      ? "Safe to Use (Permission Allowed)"
                      : "Unsafe / Location Mismatch (Access Denied)"}
                    <span
                      className={`px-2 py-0.5 text-xs font-bold rounded-md border uppercase tracking-wider ${
                        safetyScore >= 80
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                          : safetyScore >= 50
                            ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                            : "bg-rose-500/20 text-rose-300 border-rose-500/30"
                      }`}
                    >
                      {safetyScore}% Safe / {riskScore}% Risk
                    </span>
                  </h4>
                  <p className="text-xs mt-1 text-slate-400 leading-relaxed">
                    Tested across {successfulSources.length}/{totalSources}{" "}
                    active databases.
                    {isAllSafe
                      ? " All sources verified the IP location as UK and detected no active proxy, VPN, or hosting servers."
                      : " Failed validation. Please check country mismatches or active VPN/Proxy flags below."}
                  </p>
                </div>
              </div>

              {/* Badging */}
              <div className="shrink-0 flex gap-2">
                <span
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border uppercase tracking-wider ${
                    isGeoSafe
                      ? "bg-emerald-600/10 text-emerald-400 border-emerald-500/20"
                      : "bg-rose-600/10 text-rose-400 border-rose-500/20"
                  }`}
                >
                  Location: {isGeoSafe ? "UK Verified" : "Non-UK / Mixed"}
                </span>
                <span
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border uppercase tracking-wider ${
                    isSecuritySafe
                      ? "bg-emerald-600/10 text-emerald-400 border-emerald-500/20"
                      : "bg-rose-600/10 text-rose-400 border-rose-500/20"
                  }`}
                >
                  Security:{" "}
                  {isSecuritySafe ? "No Proxy/VPN" : "Proxy/VPN Flagged"}
                </span>
              </div>
            </div>
          )}

          {/* Skeleton Loader during search checks or initial detection */}
          {(loading || detectingIP) && <IPCheckerSkeleton />}

          {/* Sources Detailed Grid */}
          {checkRan && !loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(results).map(([sourceName, result]) => {
                const isUK =
                  result.success &&
                  (result.countryCode?.toUpperCase() === "GB" ||
                    result.countryCode?.toUpperCase() === "UK");
                return (
                  <div
                    key={sourceName}
                    className={`p-4 rounded-xl border bg-slate-950/20 flex flex-col justify-between ${
                      !result.success
                        ? "border-slate-800 opacity-60"
                        : isUK && !result.isProxyOrVpn
                          ? "border-emerald-500/15 hover:border-emerald-500/30"
                          : "border-rose-500/15 hover:border-rose-500/30"
                    } transition-all duration-200`}
                  >
                    <div>
                      {/* Source Title & Header Status */}
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-bold text-slate-200 text-xs">
                          {sourceName}
                        </span>
                        {result.success ? (
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${
                              isUK && !result.isProxyOrVpn
                                ? "bg-emerald-600/10 text-emerald-400 border-emerald-500/20"
                                : "bg-rose-600/10 text-rose-400 border-rose-500/20"
                            }`}
                          >
                            {isUK ? "UK" : result.countryCode || "Non-UK"}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-slate-800 bg-slate-900 text-slate-500">
                            Offline
                          </span>
                        )}
                      </div>

                      {/* Main Details */}
                      {result.success ? (
                        <div className="space-y-1.5 text-xs text-slate-400">
                          <p className="flex justify-between">
                            <span>Location:</span>
                            <strong className="text-slate-300 font-semibold">
                              {result.countryName || "Unknown"}
                            </strong>
                          </p>
                          <p className="flex justify-between gap-4">
                            <span>ISP/AS:</span>
                            <strong
                              className="text-slate-300 font-semibold text-right truncate max-w-[200px]"
                              title={result.isp}
                            >
                              {result.isp || "N/A"}
                            </strong>
                          </p>

                          {/* Proxy / VPN flag info */}
                          {result.isProxyOrVpn !== undefined && (
                            <p className="flex justify-between">
                              <span>Connection:</span>
                              <strong
                                className={
                                  result.isProxyOrVpn
                                    ? "text-rose-400 font-semibold"
                                    : "text-emerald-400 font-semibold"
                                }
                              >
                                {result.isProxyOrVpn
                                  ? "Proxy/VPN Flagged"
                                  : "Residential/Standard"}
                              </strong>
                            </p>
                          )}

                          {/* Criminal IP risk percentage */}
                          {sourceName === "CriminalIP.io" &&
                            (result.rawData as CriminalIPResponse)?.score && (
                              <p className="flex justify-between border-t border-slate-900/50 pt-1.5 mt-1.5">
                                <span>API Risk Rating:</span>
                                <strong
                                  className={
                                    ((result.rawData as CriminalIPResponse)
                                      .score?.inbound ?? 0) > 2
                                      ? "text-rose-400 font-bold"
                                      : "text-emerald-400 font-semibold"
                                  }
                                >
                                  {((result.rawData as CriminalIPResponse).score
                                    ?.inbound ?? 0) * 20}
                                  % Risk (
                                  {(result.rawData as CriminalIPResponse).score
                                    ?.inbound ?? 0}
                                  /5)
                                </strong>
                              </p>
                            )}
                        </div>
                      ) : (
                        <div className="mt-2 p-2 bg-rose-950/20 border border-rose-900/30 rounded-lg text-[10px] text-rose-400 font-medium">
                          Error: {result.error || "Request failed"}
                        </div>
                      )}
                    </div>

                    {/* Risk alerts in body */}
                    {result.success &&
                      result.riskDetails &&
                      result.riskDetails.length > 0 && (
                        <div className="mt-3 p-2 bg-rose-950/20 border border-rose-900/20 rounded-lg flex items-start gap-1.5 text-[10px] text-rose-400">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <div>
                            <strong>Risk Flagged:</strong>{" "}
                            {result.riskDetails.join(", ")}
                          </div>
                        </div>
                      )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Initial State / Waiting */}
          {!checkRan && !loading && !detectingIP && (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3 bg-slate-950/15 border border-slate-850 rounded-2xl">
              <Globe className="w-12 h-12 text-slate-600 animate-pulse" />
              <div>
                <p className="text-slate-300 font-bold text-sm">
                  Awaiting IP Input
                </p>
                <p className="text-xs text-slate-550 max-w-sm mt-1 leading-relaxed">
                  Enter an IP address above or click "My IP" to query all 6
                  diagnostic security databases.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 text-right shrink-0">
          <button
            onClick={handleClose}
            disabled={loading}
            className="py-2 px-5 bg-slate-955 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold cursor-pointer transition-all disabled:opacity-50"
          >
            Close
          </button>
        </div>

        <style
          dangerouslySetInnerHTML={{
            __html: `
          .custom-scrollbar::-webkit-scrollbar {
            width: 5px;
            height: 5px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: transparent;
            border-radius: 9999px;
            transition: background 0.2s ease;
          }
          .custom-scrollbar:hover::-webkit-scrollbar-thumb {
            background: rgba(148, 163, 184, 0.2);
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: rgba(148, 163, 184, 0.35);
          }
        `,
          }}
        />
      </div>
    </div>,
    document.body,
  );
};
