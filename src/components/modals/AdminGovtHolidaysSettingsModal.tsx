'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Trash2, RefreshCw } from 'lucide-react';
import { GlobalSettings, formatDate } from '@/utils/dashboardHelpers';
import { DateInput } from '@/components/DateInput';
import { supabase } from '@/utils/supabase';
import { Modal } from '../Modal';
import { toast } from 'react-hot-toast';

interface AdminGovtHolidaysSettingsModalProps {
  showModal: boolean;
  setShowModal: (val: boolean) => void;
  globalSettings: GlobalSettings;
  onSave: (settings: GlobalSettings) => Promise<boolean>;
}

export function AdminGovtHolidaysSettingsModal({
  showModal,
  setShowModal,
  globalSettings,
  onSave,
}: AdminGovtHolidaysSettingsModalProps) {
  const [govtHolidays, setGovtHolidays] = useState<{ date: string; name: string }[]>([]);
  const [newDate, setNewDate] = useState('');
  const [newName, setNewName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmInfo, setDeleteConfirmInfo] = useState<{ date: string; name: string } | null>(null);

  useEffect(() => {
    if (showModal) {
      const raw = globalSettings.govt_holidays || [];
      const parsed = raw.map((h: any) => {
        if (h && typeof h === 'object' && h.date) {
          return { date: h.date, name: h.name || 'Govt Public Holiday' };
        }
        return { date: String(h), name: 'Govt Public Holiday' };
      });
      setGovtHolidays(parsed);
      setDeleteConfirmInfo(null);
      
      const today = new Date();
      const localDate = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
      setNewDate(localDate);
      setNewName('');
    }
  }, [showModal, globalSettings]);

  // ESC key handler for delete confirmation modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && deleteConfirmInfo) {
        setDeleteConfirmInfo(null);
      }
    };
    if (deleteConfirmInfo) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteConfirmInfo]);

  if (!showModal) return null;

  const handleAddDate = () => {
    if (!newDate) return;
    const nameVal = newName.trim() || 'Govt Public Holiday';
    if (govtHolidays.some(h => h.date === newDate)) {
      toast.error('This date is already added!');
      return;
    }
    setGovtHolidays(prev => [...prev, { date: newDate, name: nameVal }].sort((a, b) => a.date.localeCompare(b.date)));
    setNewName('');
  };

  const handleRemoveDate = (dateToRemove: string, nameToRemove: string) => {
    setDeleteConfirmInfo({ date: dateToRemove, name: nameToRemove });
  };

  const executeRemoveDate = () => {
    if (!deleteConfirmInfo) return;
    const { date: dateToRemove } = deleteConfirmInfo;
    setGovtHolidays(prev => prev.filter(h => h.date !== dateToRemove));
    setDeleteConfirmInfo(null);
  };

  const handleSave = async () => {
    setSubmitting(true);
    try {
      const activeDates = govtHolidays.map(h => h.date);
      if (activeDates.length === 0) {
        const { error: deleteError } = await supabase
          .from('govt_holiday_responses')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');
        if (deleteError) {
          console.error('Failed to delete all responses:', deleteError);
        }
      } else {
        const { error: deleteError } = await supabase
          .from('govt_holiday_responses')
          .delete()
          .not('holiday_date', 'in', `(${activeDates.join(',')})`);
        if (deleteError) {
          console.error('Failed to delete removed responses:', deleteError);
        }
      }

      const success = await onSave({
        ...globalSettings,
        govt_holidays: govtHolidays,
      });
      if (success) {
        toast.success('Govt Holidays updated successfully!');
        setShowModal(false);
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      toast.error('Failed to save settings!');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => setShowModal(false);

  return (
    <>
      <Modal
        isOpen={showModal}
        onClose={handleClose}
        title="Govt Holidays List"
        icon={<Calendar className="h-5 w-5 text-orange-500" />}
        maxWidthClass="max-w-md"
        glowClass="bg-orange-900/10"
      >

        <div className="space-y-4 text-xs font-sans">
          {/* Add Date Picker & Name Input */}
          <div className="flex flex-col gap-2 bg-slate-955/60 p-3 rounded-lg border border-slate-850">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Holiday Date</label>
                <DateInput
                  value={newDate}
                  onChange={(val) => {
                    setNewDate(val);
                  }}
                  className="bg-slate-955"
                />
              </div>
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Holiday Name</label>
                <input
                  type="text"
                  placeholder="e.g. May Day"
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                  }}
                  className="w-full px-3 py-1.5 bg-slate-955 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 h-9"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleAddDate}
              className="w-full py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition-all flex items-center justify-center cursor-pointer border border-orange-700 shadow-md h-9 text-xs font-bold gap-1"
            >
              <Plus className="h-4 w-4" /> Add to List
            </button>
          </div>

          {/* List of dates */}
          <div>
            <label className="block text-slate-400 font-semibold mb-2">Govt Holidays ({govtHolidays.length} {govtHolidays.length === 1 ? 'day' : 'days'})</label>
            
            {govtHolidays.length === 0 ? (
              <div className="py-8 text-center text-slate-500 border border-dashed border-slate-850 rounded-xl bg-slate-955/20">
                No government holidays have been added.
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto border border-slate-850 rounded-xl bg-slate-955/20 divide-y divide-slate-850/60 font-mono">
                {govtHolidays.map((h) => (
                  <div key={h.date} className="flex justify-between items-center px-4 py-2.5 hover:bg-slate-900/30 transition-all">
                    <div className="flex flex-col">
                      <span className="text-white font-semibold text-xs">{formatDate(h.date)}</span>
                      <span className="text-slate-400 text-[10px]">{h.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveDate(h.date, h.name)}
                      className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-all cursor-pointer"
                      title="Remove"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 flex justify-center py-2 px-4 border border-slate-800 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-355 bg-slate-955 hover:bg-slate-900 cursor-pointer transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={submitting}
              className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
            >
              {submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
              Save
            </button>
          </div>
        </div>
      </Modal>

      {/* Custom Confirmation Modal */}
      {deleteConfirmInfo && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-955/90 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-850 shadow-2xl rounded-2xl w-full max-w-sm p-6 relative overflow-hidden font-sans text-center border-red-500/20">
            <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-red-900/10 blur-[80px] pointer-events-none" />
            
            <div className="flex flex-col items-center gap-3 mb-4">
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full">
                <Trash2 className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-bold text-white">Delete Holiday Confirmation ⚠️</h4>
            </div>

            <p className="text-slate-300 text-xs leading-relaxed mb-6">
              Deleting this government holiday (<span className="text-red-400 font-semibold font-mono">{formatDate(deleteConfirmInfo.date)}</span> - <span className="text-white font-semibold">{deleteConfirmInfo.name}</span>) will completely remove it from all staff choices, reserve records, and response reports.
              <br /><br />
              <span className="text-amber-400 font-semibold">Are you sure you want to delete this?</span>
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmInfo(null)}
                className="flex-1 py-2 px-4 border border-slate-800 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-350 bg-slate-955 hover:bg-slate-900 cursor-pointer transition-all h-9"
              >
                No, Cancel
              </button>
              <button
                type="button"
                onClick={executeRemoveDate}
                className="flex-1 py-2 px-4 rounded-lg shadow-sm text-xs font-semibold text-white bg-red-600 hover:bg-red-500 cursor-pointer transition-all h-9"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
