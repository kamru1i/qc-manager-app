'use client';

import { useState, useMemo, useCallback } from 'react';
import { RecordItem, Profile } from '@/types';

interface UseCopyHelperOptions {
  showToast: (type: 'success' | 'error', text: string) => void;
  todayUserRecords: RecordItem[];
  profile: Profile | null;
  codenameInput: string;
}

export const useCopyHelper = ({ showToast, todayUserRecords, profile, codenameInput }: UseCopyHelperOptions) => {
  // ── State ──────────────────────────────────────────────────────────
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
  
  const setCopied = useCallback((key: string) => {
    setCopiedStates(prev => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setCopiedStates(prev => ({ ...prev, [key]: false }));
    }, 1500);
  }, []);

  const [spokeTo, setSpokeTo] = useState("Online");
  const [soldDate, setSoldDate] = useState(() => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  });
  const [pcUsed, setPcUsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("quotes_sales_pc_used") || "IT-001";
    }
    return "IT-001";
  });
  const [reportNotes, setReportNotes] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("quotes_sales_report_notes");
      return saved || "Direct line, Toyota, Swiftcover, Moja, Marshmellow\n1st Central (After sale – number, pass, email)";
    }
    return "Direct line, Toyota, Swiftcover, Moja, Marshmellow\n1st Central (After sale – number, pass, email)";
  });

  // ── Computed Values ────────────────────────────────────────────────
  const todayUserSales = useMemo(() => {
    return todayUserRecords.filter((r) => r.file_type === "Sale");
  }, [todayUserRecords]);

  const totalAttempt = todayUserSales.length;

  const soldCount = useMemo(() => {
    return todayUserSales.filter((r) => r.file_name.endsWith(" [SOLD]")).length;
  }, [todayUserSales]);

  const unsoldCount = useMemo(() => {
    return todayUserSales.filter((r) => r.file_name.endsWith(" [UNSOLD]")).length;
  }, [todayUserSales]);

  const allSales = useMemo(() => {
    return todayUserRecords.length > 0 && todayUserRecords.every((r) => r.file_type === "Sale");
  }, [todayUserRecords]);

  const hasSubmissions = todayUserRecords.length > 0;

  // ── Persistence Handlers ───────────────────────────────────────────
  const handleNotesChange = useCallback((val: string) => {
    setReportNotes(val);
    localStorage.setItem("quotes_sales_report_notes", val);
  }, []);

  const handlePcUsedChange = useCallback((val: string) => {
    setPcUsed(val);
    localStorage.setItem("quotes_sales_pc_used", val);
  }, []);

  // ── Copy Functions ─────────────────────────────────────────────────
  const copyBox1 = useCallback(async () => {
    const plainText = `Helped By: ${codenameInput || profile?.username || ""}\nSpoke to: ${spokeTo}\nSold Date: ${soldDate}\nPC Used: ${pcUsed}`;
    const htmlText = `<b>Helped By:</b> ${codenameInput || profile?.username || ""}<br><b>Spoke to:</b> ${spokeTo}<br><b>Sold Date:</b> ${soldDate}<br><b>PC Used:</b> ${pcUsed}`;

    try {
      if (navigator.clipboard && window.ClipboardItem) {
        const blobHtml = new Blob([htmlText], { type: "text/html" });
        const blobText = new Blob([plainText], { type: "text/plain" });
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": blobHtml,
            "text/plain": blobText,
          })
        ]);
        setCopied("box1");
      } else {
        await navigator.clipboard.writeText(plainText);
        setCopied("box1");
      }
    } catch (err) {
      console.error("Failed to copy rich text:", err);
      try {
        await navigator.clipboard.writeText(plainText);
        setCopied("box1");
      } catch {
        showToast("error", "Failed to copy details.");
      }
    }
  }, [codenameInput, profile?.username, spokeTo, soldDate, pcUsed, setCopied, showToast]);

  const copyBox2 = useCallback(async () => {
    const text = `*Sales Report | Date: ${soldDate}*\n*Total Attempt:* ${totalAttempt} Sale\n*Sold:* ${soldCount} Sale\n*Unsold:* ${unsoldCount} Sale`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied("box2");
    } catch {
      showToast("error", "Failed to copy.");
    }
  }, [soldDate, totalAttempt, soldCount, unsoldCount, setCopied, showToast]);

  const copyBox4 = useCallback(async () => {
    const title = allSales && hasSubmissions
      ? `*Sales Report | Date: ${soldDate}*`
      : `*Files Report | Date: ${soldDate}*`;

    const subtitle = allSales && hasSubmissions
      ? `*Total Sale:* ${todayUserRecords.length} Sale`
      : `*Total Files:* ${todayUserRecords.length} File`;

    const separator = `-----------------------`;

    const lines = todayUserRecords.map(r => {
      const cleanName = r.file_name.replace(/ \[(SOLD|UNSOLD)\]$/, '');
      return `${cleanName} ${r.branch_name} ${r.file_type}`;
    });

    const text = `${title}\n${subtitle}\n${separator}\n${lines.join('\n')}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied("box4");
    } catch {
      showToast("error", "Failed to copy.");
    }
  }, [allSales, hasSubmissions, soldDate, todayUserRecords, setCopied, showToast]);

  const copyText1 = useCallback(async () => {
    try {
      await navigator.clipboard.writeText("Online selling process done & updated.");
      setCopied("text1");
    } catch {
      showToast("error", "Failed to copy.");
    }
  }, [setCopied, showToast]);

  const copyText2 = useCallback(async () => {
    try {
      await navigator.clipboard.writeText("Saved & Updated.");
      setCopied("text2");
    } catch {
      showToast("error", "Failed to copy.");
    }
  }, [setCopied, showToast]);

  const copyNotes = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(reportNotes);
      setCopied("notes");
    } catch {
      showToast("error", "Failed to copy.");
    }
  }, [reportNotes, setCopied, showToast]);

  return {
    // State
    spokeTo,
    setSpokeTo,
    soldDate,
    setSoldDate,
    pcUsed,
    reportNotes,
    copiedStates,
    // Computed
    totalAttempt,
    soldCount,
    unsoldCount,
    allSales,
    hasSubmissions,
    // Handlers
    handlePcUsedChange,
    handleNotesChange,
    // Copy Functions
    copyBox1,
    copyBox2,
    copyBox4,
    copyText1,
    copyText2,
    copyNotes,
  };
};
