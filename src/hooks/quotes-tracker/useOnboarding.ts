'use client';

import { useState, useMemo, useCallback } from 'react';
import { Profile } from '@/types';
import { validator } from '@/utils/quotesValidator';

interface UseOnboardingOptions {
  profile: Profile | null;
  completeFirstTimeSetup: (codename: string, fullName: string, password: string) => Promise<boolean>;
  showToast: (type: 'success' | 'error', message: string) => void;
}

export function useOnboarding({
  profile,
  completeFirstTimeSetup,
  showToast,
}: UseOnboardingOptions) {
  // ── State ──────────────────────────────────────────────────────────
  const [ownFullName, setOwnFullName] = useState(
    () => profile?.full_name || "",
  );
  const [ownCodename, setOwnCodename] = useState(() => profile?.username || "");
  const [ownPassword, setOwnPassword] = useState("");
  const [ownConfirmPassword, setOwnConfirmPassword] = useState("");
  const [showOwnPass, setShowOwnPass] = useState(false);
  const [showOwnConfirmPass, setShowOwnConfirmPass] = useState(false);

  // ── Real-time password feedback (6 to 12 characters, matching check) ──
  const passwordFeedback = useMemo(() => {
    if (!ownPassword) return null;
    if (ownPassword.length < 6 || ownPassword.length > 12) {
      return {
        text: "Password must be 6 to 12 characters long",
        isError: true,
      };
    }
    if (!ownConfirmPassword) {
      return { text: "Please confirm password", isError: true };
    }
    if (ownPassword !== ownConfirmPassword) {
      return { text: "Passwords do not match", isError: true };
    }
    return { text: "Passwords match", isError: false };
  }, [ownPassword, ownConfirmPassword]);

  // ── Handler ────────────────────────────────────────────────────────
  const handleFirstTimeSetup = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!ownFullName.trim()) {
        showToast("error", "Please enter your full name.");
        return;
      }
      if (!ownCodename.trim() || ownCodename.trim().length < 3) {
        showToast("error", "Codename must be at least 3 characters long.");
        return;
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(ownCodename.trim())) {
        showToast(
          "error",
          "Codename can only contain English letters, numbers, - and _.",
        );
        return;
      }

      const validation = validator.validateOnboardingPassword(ownPassword);
      if (!validation.isValid) {
        showToast("error", validation.errors[0]);
        return;
      }
      if (ownPassword !== ownConfirmPassword) {
        showToast("error", "Password confirmation does not match.");
        return;
      }

      const success = await completeFirstTimeSetup(
        ownCodename,
        ownFullName,
        ownPassword,
      );
      if (success) {
        setOwnPassword("");
        setOwnConfirmPassword("");
      }
    },
    [ownFullName, ownCodename, ownPassword, ownConfirmPassword, showToast, completeFirstTimeSetup],
  );

  return {
    ownFullName,
    setOwnFullName,
    ownCodename,
    setOwnCodename,
    ownPassword,
    setOwnPassword,
    ownConfirmPassword,
    setOwnConfirmPassword,
    showOwnPass,
    setShowOwnPass,
    showOwnConfirmPass,
    setShowOwnConfirmPass,
    passwordFeedback,
    handleFirstTimeSetup,
  };
}
