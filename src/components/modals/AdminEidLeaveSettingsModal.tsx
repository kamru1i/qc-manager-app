import React, { useState, useEffect } from 'react';
import { Calendar, RefreshCw } from 'lucide-react';
import { GlobalSettings } from '@/utils/dashboardHelpers';
import { Modal } from '@/components/Modal';

interface AdminEidLeaveSettingsModalProps {
  showModal: boolean;
  setShowModal: (val: boolean) => void;
  globalSettings: GlobalSettings;
  onSave: (settings: GlobalSettings) => Promise<boolean>;
}

export function AdminEidLeaveSettingsModal({
  showModal,
  setShowModal,
  globalSettings,
  onSave,
}: AdminEidLeaveSettingsModalProps) {
  const [eidFitrLeave, setEidFitrLeave] = useState(0);
  const [eidAdhaLeave, setEidAdhaLeave] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (showModal) {
      setEidFitrLeave(globalSettings.eid_fitr_leave ?? 0);
      setEidAdhaLeave(globalSettings.eid_adha_leave ?? 0);
    }
  }, [showModal, globalSettings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const success = await onSave({
      ...globalSettings,
      eid_fitr_leave: Number(eidFitrLeave),
      eid_adha_leave: Number(eidAdhaLeave),
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
      title="Eid Leave Settings"
      icon={<Calendar className="h-5 w-5 text-orange-500" />}
      maxWidthClass="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs font-medium">
        <div>
          <label className="block text-slate-400 font-semibold mb-1">Eid-ul-Fitr Leave (Days)</label>
          <input
            type="number"
            min="0"
            step="1"
            required
            value={eidFitrLeave}
            onChange={(e) => setEidFitrLeave(Math.round(parseFloat(e.target.value) || 0))}
            className="mt-1 block w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono"
          />
        </div>

        <div>
          <label className="block text-slate-400 font-semibold mb-1">Eid-ul-Adha Leave (Days)</label>
          <input
            type="number"
            min="0"
            step="1"
            required
            value={eidAdhaLeave}
            onChange={(e) => setEidAdhaLeave(Math.round(parseFloat(e.target.value) || 0))}
            className="mt-1 block w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono"
          />
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
            className="flex-1 flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-md text-xs font-semibold text-white bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-slate-950 cursor-pointer disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
          >
            {submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
            Save Settings
          </button>
        </div>
      </form>
    </Modal>
  );
}
