import React, { useState, useEffect } from "react";
import { Calendar, RefreshCw } from "lucide-react";
import { GlobalSettings } from "@/utils/dashboardHelpers";
import { Modal } from "@/components/Modal";

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
  const [officeLeaveH1, setOfficeLeaveH1] = useState(7);
  const [officeLeaveH2, setOfficeLeaveH2] = useState(7);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (showModal) {
      setOfficeLeaveH1(globalSettings.office_leave_h1 ?? 7);
      setOfficeLeaveH2(globalSettings.office_leave_h2 ?? 7);
    }
  }, [showModal, globalSettings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const success = await onSave({
      ...globalSettings,
      office_leave_h1: Number(officeLeaveH1),
      office_leave_h2: Number(officeLeaveH2),
      office_leave_default: Number(officeLeaveH1) + Number(officeLeaveH2),
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
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">
              Office Leave - H1 (Days)
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
              className="mt-1 block w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              Jan - June (e.g., 7 Days)
            </span>
          </div>
          <div>
            <label className="block text-slate-400 font-semibold mb-1">
              Office Leave - H2 (Days)
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
              className="mt-1 block w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              July - Dec (e.g., 7 Days)
            </span>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setShowModal(false)}
            className="flex-1 flex justify-center py-2 px-4 border border-slate-800 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-355 bg-slate-955 hover:bg-slate-900 cursor-pointer transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-md text-xs font-semibold text-white bg-linear-to-r from-blue-600 to-purple-500 hover:from-blue-500 hover:to-purple-400 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-950 cursor-pointer disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
          >
            {submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
            Save Settings
          </button>
        </div>
      </form>
    </Modal>
  );
}
