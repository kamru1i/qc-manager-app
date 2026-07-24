import React, { useState, useEffect } from "react";
import { Calendar, RefreshCw } from "lucide-react";
import { GlobalSettings } from "@/utils/dashboardHelpers";
import { Modal } from "@/components/common/Modal";

interface AdminOfficeLeaveSettingsModalProps {
  showModal: boolean;
  setShowModal: (val: boolean) => void;
  globalSettings: GlobalSettings;
  onSave: (settings: GlobalSettings) => Promise<boolean>;
}

export function AdminOfficeLeaveSettingsModal({
  showModal,
  setShowModal,
  globalSettings,
  onSave,
}: AdminOfficeLeaveSettingsModalProps) {
  const [officeLeaveMode, setOfficeLeaveMode] = useState<'split' | 'merged'>('split');
  const [officeLeaveH1, setOfficeLeaveH1] = useState(7);
  const [officeLeaveH2, setOfficeLeaveH2] = useState(7);
  const [officeLeaveYearly, setOfficeLeaveYearly] = useState(14);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (showModal) {
      const mode = globalSettings.office_leave_mode === 'merged' ? 'merged' : 'split';
      setOfficeLeaveMode(mode);
      const h1 = globalSettings.office_leave_h1 ?? 7;
      const h2 = globalSettings.office_leave_h2 ?? 7;
      setOfficeLeaveH1(h1);
      setOfficeLeaveH2(h2);
      setOfficeLeaveYearly(mode === 'merged' ? (globalSettings.office_leave_default ?? (h1 + h2)) : (h1 + h2));
    }
  }, [showModal, globalSettings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    let updatedH1 = Number(officeLeaveH1);
    let updatedH2 = Number(officeLeaveH2);
    let updatedDefault = updatedH1 + updatedH2;

    if (officeLeaveMode === 'merged') {
      updatedDefault = Number(officeLeaveYearly);
      updatedH1 = updatedDefault;
      updatedH2 = 0;
    }

    const success = await onSave({
      ...globalSettings,
      office_leave_mode: officeLeaveMode,
      office_leave_h1: updatedH1,
      office_leave_h2: updatedH2,
      office_leave_default: updatedDefault,
    });
    setSubmitting(false);
    if (success) {
      setShowModal(false);
    }
  };

  return (
    <Modal
      isOpen={showModal}
      onClose={() => setShowModal(false)}
      title="Office Allocated Leave Settings"
      icon={<Calendar className="h-5 w-5 text-blue-500" />}
      maxWidthClass="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs font-medium">
        {/* Split / Merge Toggle */}
        <div className="flex items-center justify-between gap-2 p-2 bg-theme-page-bg border border-theme-border-input rounded-xl">
          <span className="text-xs font-semibold text-theme-text-secondary">Allocation Setup:</span>
          <div className="flex bg-theme-card-bg border border-theme-border-muted p-0.5 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => setOfficeLeaveMode('split')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                officeLeaveMode === 'split'
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'text-theme-text-muted hover:text-theme-text-primary'
              }`}
            >
              Split (H1/H2)
            </button>
            <button
              type="button"
              onClick={() => setOfficeLeaveMode('merged')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                officeLeaveMode === 'merged'
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'text-theme-text-muted hover:text-theme-text-primary'
              }`}
            >
              Merged (Yearly)
            </button>
          </div>
        </div>

        {officeLeaveMode === 'split' ? (
          <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-150">
            <div>
              <label className="block text-theme-text-muted font-semibold mb-1">
                H1 (Jan - Jun) Days
              </label>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={officeLeaveH1}
                onChange={(e) =>
                  setOfficeLeaveH1(Math.round(parseFloat(e.target.value) || 0))
                }
                className="mt-1 block w-full px-3 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <span className="text-[10px] text-theme-text-muted mt-1 block">
                Usually 7 Days
              </span>
            </div>
            <div>
              <label className="block text-theme-text-muted font-semibold mb-1">
                H2 (Jul - Dec) Days
              </label>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={officeLeaveH2}
                onChange={(e) =>
                  setOfficeLeaveH2(Math.round(parseFloat(e.target.value) || 0))
                }
                className="mt-1 block w-full px-3 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <span className="text-[10px] text-theme-text-muted mt-1 block">
                Usually 7 Days
              </span>
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in duration-150">
            <label className="block text-theme-text-muted font-semibold mb-1">
              Full Year Allocated Leave (Days)
            </label>
            <input
              type="number"
              min="0"
              step="1"
              required
              value={officeLeaveYearly}
              onChange={(e) =>
                setOfficeLeaveYearly(Math.round(parseFloat(e.target.value) || 0))
              }
              className="mt-1 block w-full px-3 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
            <span className="text-[10px] text-theme-text-muted mt-1 block">
              Usually 14 Days (Jan - Dec)
            </span>
          </div>
        )}

        <div className="flex gap-3 pt-4 border-t border-theme-border-input">
          <button
            type="button"
            onClick={() => setShowModal(false)}
            className="flex-1 flex justify-center py-2 px-4 border border-theme-border-input rounded-lg text-xs font-semibold text-theme-text-muted hover:text-theme-text-secondary bg-theme-page-bg hover:bg-theme-card-bg cursor-pointer transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-md text-xs font-semibold text-white bg-linear-to-r from-blue-600 to-purple-500 hover:from-blue-500 hover:to-purple-400 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-theme-card-container cursor-pointer disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
          >
            {submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
            Save Settings
          </button>
        </div>
      </form>
    </Modal>
  );
}
