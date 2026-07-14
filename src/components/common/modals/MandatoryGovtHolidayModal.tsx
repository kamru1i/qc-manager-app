import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, RefreshCw } from 'lucide-react';
import { formatDate } from '@/utils/dashboardHelpers';

interface MandatoryGovtHolidayModalProps {
  isOpen: boolean;
  holiday: { date: string; name: string };
  onSaveHolidayResponse: (holidayDate: string, holidayName: string, response: 'paid' | 'reserve') => Promise<boolean>;
}

export const MandatoryGovtHolidayModal: React.FC<MandatoryGovtHolidayModalProps> = ({
  isOpen,
  holiday,
  onSaveHolidayResponse,
}) => {
  const [submitting, setSubmitting] = useState<'paid' | 'reserve' | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!isOpen || !mounted) return null;

  const handleChoice = async (choice: 'paid' | 'reserve') => {
    if (submitting !== null) return;
    setSubmitting(choice);
    try {
      await onSaveHolidayResponse(holiday.date, holiday.name, choice);
    } catch (err) {
      console.error('Failed to submit holiday preference:', err);
    } finally {
      setSubmitting(null);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-theme-page-bg/85 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-theme-card-bg border border-theme-border-input shadow-2xl rounded-2xl w-full max-w-md p-6 relative font-sans my-8 transform scale-100 opacity-100 translate-y-0 transition-all duration-200">
        
        {/* Glow effect */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-purple-900/10 blur-[80px]" />
        </div>

        {/* Header */}
        <div className="relative z-10 flex items-center gap-3 border-b border-theme-border-input/80 pb-3 mb-5">
          <div className="p-2 bg-purple-650/10 border border-purple-555/20 text-purple-400 rounded-xl shrink-0">
            <Calendar className="h-5 w-5 text-purple-500" />
          </div>
          <div className="text-left">
            <h3 className="text-sm sm:text-base font-bold text-theme-text-primary">
              Government Holiday Decision Required
            </h3>
            <p className="text-[9px] text-purple-400 font-semibold uppercase tracking-wider mt-0.5">
              Action Required
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="relative z-10 space-y-4">
          <div className="p-4 bg-theme-page-bg/60 border border-theme-border-muted rounded-xl text-center">
            <h4 className="text-sm font-bold text-theme-text-primary">
              {holiday.name}
            </h4>
            <p className="text-xs text-theme-text-muted mt-1.5 font-sans font-semibold">
              Date: {formatDate(holiday.date)}
            </p>
          </div>

          <p className="text-xs text-theme-text-secondary leading-relaxed text-left">
            An admin has added a new government holiday. Since you have <strong>Government Holiday Reserve</strong> enabled, please choose whether you want to receive payment for this day or reserve it for future leave:
          </p>

          <div className="flex gap-3 pt-3 border-t border-theme-border-muted">
            <button
              type="button"
              disabled={submitting !== null}
              onClick={() => handleChoice('paid')}
              className="flex-1 flex justify-center items-center gap-1.5 py-2.5 px-4 border border-emerald-700 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-555 active:scale-95 transition-all cursor-pointer disabled:opacity-50 h-10 shadow-sm"
            >
              {submitting === 'paid' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : 'Get Paid'}
            </button>
            <button
              type="button"
              disabled={submitting !== null}
              onClick={() => handleChoice('reserve')}
              className="flex-1 flex justify-center items-center gap-1.5 py-2.5 px-4 border border-teal-700 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-555 active:scale-95 transition-all cursor-pointer disabled:opacity-50 h-10 shadow-sm"
            >
              {submitting === 'reserve' ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : 'Reserve'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
