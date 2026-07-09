import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import {
  X,
  Calendar,
  User,
  Plus,
  Loader2,
  FileText,
  MapPin,
} from "lucide-react";
import { FileType, Profile } from "@/types";
import { formatDate, cleanFileName } from "@/utils/quotesDashboardHelpers";
import { CategorySelector } from "@/components/quotes-tracker/CategorySelector";
import { BranchSelector } from "@/components/common/BranchSelector";

interface CustomEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  profilesList: Profile[];
  currentUserProfile: Profile | null;
  submitting: boolean;
  adminMode: boolean; // true = admin selecting any user, false = regular user adding their own data
  onSubmit: (
    fileName: string,
    branchName: string,
    fileType: FileType,
    userId: string,
    submittedAtDate: string,
  ) => Promise<boolean>;
}

export const CustomEntryModal: React.FC<CustomEntryModalProps> = ({
  isOpen,
  onClose,
  profilesList,
  currentUserProfile,
  submitting,
  adminMode,
  onSubmit,
}) => {
  const customDateRef = useRef<HTMLInputElement>(null);
  const [customUserId, setCustomUserId] = useState("");

  const handleOpenCustomDatePicker = () => {
    if (customDateRef.current) {
      try {
        customDateRef.current.showPicker();
      } catch {
        customDateRef.current.click();
      }
    }
  };
  const [customDate, setCustomDate] = useState("");
  const [modalDateInputVal, setModalDateInputVal] = useState("");

  // Sync text input with customDate
  useEffect(() => {
    if (customDate) {
      const parts = customDate.split("-");
      if (parts.length === 3) {
        setModalDateInputVal(`${parts[2]}-${parts[1]}-${parts[0]}`);
      } else {
        setModalDateInputVal(formatDate(customDate));
      }
    } else {
      setModalDateInputVal("");
    }
  }, [customDate]);

  const handleModalDateInputChange = (val: string) => {
    const clean = val.replace(/\D/g, "");
    let formatted = "";
    if (clean.length > 0) {
      formatted += clean.substring(0, 2);
    }
    if (clean.length > 2) {
      formatted += "-" + clean.substring(2, 4);
    }
    if (clean.length > 4) {
      formatted += "-" + clean.substring(4, 8);
    }

    setModalDateInputVal(formatted);

    if (formatted.length === 10) {
      const parts = formatted.split("-");
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);

      if (
        day >= 1 &&
        day <= 31 &&
        month >= 1 &&
        month <= 12 &&
        year >= 1900 &&
        year <= 2100
      ) {
        const dateObj = new Date(year, month - 1, day);
        if (
          dateObj.getFullYear() === year &&
          dateObj.getMonth() === month - 1 &&
          dateObj.getDate() === day
        ) {
          const yyyy = String(year);
          const mm = String(month).padStart(2, "0");
          const dd = String(day).padStart(2, "0");
          setCustomDate(`${yyyy}-${mm}-${dd}`);
          return;
        }
      }
    }
    setCustomDate("");
  };

  const [customFileName, setCustomFileName] = useState("");
  const [customBranchName, setCustomBranchName] = useState("");
  const [customFileType, setCustomFileType] = useState<FileType>("Quote");

  // Find the selected user's profile
  const targetUserProfile = useMemo(() => {
    if (adminMode) {
      return profilesList.find((p) => p.id === customUserId);
    } else {
      return currentUserProfile;
    }
  }, [profilesList, customUserId, currentUserProfile, adminMode]);

  // Allowed categories for target user
  const targetAllowedCategories = useMemo(() => {
    return targetUserProfile?.allowed_types || [];
  }, [targetUserProfile]);

  // Helpers to check target user permissions
  const isRequoteAllowed =
    targetAllowedCategories.includes("Requote") ||
    targetAllowedCategories.includes("Requote Van") ||
    targetAllowedCategories.includes("Requote Bike");

  const isReviewAllowed =
    targetAllowedCategories.includes("Review") ||
    targetAllowedCategories.includes("Review Van") ||
    targetAllowedCategories.includes("Review Bike");

  const prevIsOpenRef = useRef(false);

  // Reset inputs when modal opens
  useEffect(() => {
    const wasOpen = prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;

    if (isOpen && !wasOpen) {
      setCustomFileName("");
      setCustomBranchName("");
      setCustomDate("");
      setModalDateInputVal("");

      if (adminMode) {
        if (profilesList.length > 0) {
          setCustomUserId(profilesList[0].id);
        }
      } else {
        // For regular users, set their own ID
        if (currentUserProfile?.id) {
          setCustomUserId(currentUserProfile.id);
        }
      }
    }
  }, [isOpen, profilesList, currentUserProfile, adminMode]);

  // Adjust selected file type based on target user permissions
  useEffect(() => {
    if (customUserId && targetAllowedCategories.length > 0) {
      if (!targetAllowedCategories.includes(customFileType)) {
        // Fallback checks
        if (customFileType.startsWith("Requote") && isRequoteAllowed) {
          // Keep it if requote variants are allowed, let standard selection adjust
        } else if (customFileType.startsWith("Review") && isReviewAllowed) {
          // Keep review
        } else {
          setCustomFileType(targetAllowedCategories[0] as FileType);
        }
      }
    }
  }, [
    customUserId,
    targetAllowedCategories,
    customFileType,
    isRequoteAllowed,
    isReviewAllowed,
  ]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = cleanFileName(customFileName);
    setCustomFileName(cleaned);
    const success = await onSubmit(
      cleaned,
      customBranchName,
      customFileType,
      customUserId,
      customDate,
    );
    if (success) {
      onClose();
    }
  };

  // Close on Escape key press
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-3xl shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-455 hover:text-white transition-all cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-1.5">
          <Calendar className="h-5 w-5 text-blue-500" />
          Custom Date Entry
        </h3>
        <p className="text-xs text-slate-455 mb-6">
          {adminMode
            ? "Submit data for a selected user on a custom backdated or future date."
            : "Submit your data on a custom backdated or future date."}
        </p>

        <form
          onSubmit={handleFormSubmit}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {/* Left Side Inputs */}
          <div className="space-y-4">
            {/* Target User Selector - Only show for admin mode */}
            {adminMode && (
              <div>
                <label className="flex text-xs font-semibold text-slate-355 mb-1.5 items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-blue-500" /> Target User
                </label>
                <select
                  required
                  value={customUserId}
                  onChange={(e) => setCustomUserId(e.target.value)}
                  className="block w-full px-3.5 py-2.5 bg-slate-955 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="">-- Select User --</option>
                  {profilesList.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.username.toUpperCase()} ({u.full_name || "No Name"})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Display User Info for non-admin mode */}
            {!adminMode && currentUserProfile && (
              <div>
                <label className="flex text-xs font-semibold text-slate-355 mb-1.5 items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-blue-500" /> Your Codename
                </label>
                <div className="px-3.5 py-2.5 bg-slate-955 border border-slate-800 rounded-xl text-white text-xs font-semibold">
                  {currentUserProfile.username.toUpperCase()}
                </div>
              </div>
            )}

            <div>
              <label className="flex text-xs font-semibold text-slate-355 mb-1.5 items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-blue-500" /> Target Date
              </label>
              <div className="flex gap-1.5 items-center">
                <input
                  type="text"
                  required
                  placeholder="DD-MM-YYYY"
                  value={modalDateInputVal}
                  onChange={(e) => handleModalDateInputChange(e.target.value)}
                  maxLength={10}
                  className="block w-full px-3.5 py-2.5 bg-slate-955 border border-slate-800 rounded-xl text-white placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm h-10.5"
                />
                <input
                  type="date"
                  ref={customDateRef}
                  required
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="absolute w-px h-px opacity-0 pointer-events-none select-none"
                />
                <button
                  type="button"
                  onClick={handleOpenCustomDatePicker}
                  className="p-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:text-white text-slate-400 rounded-xl transition-all duration-200 flex items-center justify-center shrink-0 w-10.5 h-10.5 cursor-pointer"
                  title="Open Calendar"
                >
                  <Calendar className="h-4.5 w-4.5" />
                </button>
              </div>
            </div>

            <div>
              <label className="flex text-xs font-semibold text-slate-355 mb-1.5 items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-blue-500" /> File Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Williams James"
                value={customFileName}
                onChange={(e) => setCustomFileName(e.target.value)}
                onBlur={(e) => setCustomFileName(cleanFileName(e.target.value))}
                className="block w-full px-3.5 py-2.5 bg-slate-955 border border-slate-800 rounded-xl text-white placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
              />
            </div>

            <div>
              <label className="flex text-xs font-semibold text-slate-355 mb-1.5 items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-blue-500" /> Branch Name
              </label>
              <BranchSelector
                value={customBranchName}
                onChange={setCustomBranchName}
              />
            </div>
          </div>

          {/* Right Side Category/Type Grid */}
          <div className="space-y-4 flex flex-col justify-between">
            <div>
              <label className="block text-xs font-semibold text-slate-355 mb-2.5">
                Select File Type
              </label>

              <CategorySelector
                selectedType={customFileType}
                setSelectedType={setCustomFileType}
                allowedCategories={targetAllowedCategories}
              />
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 px-4 bg-slate-955 border border-slate-800 hover:bg-slate-800/80 text-slate-300 hover:text-white rounded-xl text-xs font-semibold cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 px-4 border border-transparent rounded-xl shadow-lg text-xs font-semibold text-white bg-linear-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:via-indigo-500 hover:to-blue-500 disabled:opacity-50 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-purple-900/20 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-950"
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin h-3.5 w-3.5 text-white" />{" "}
                    Submitting...
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" /> Submit
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
