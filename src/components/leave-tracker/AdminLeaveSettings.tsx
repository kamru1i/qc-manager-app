'use client';

import React, { useState, useEffect } from 'react';
import {  Plus, Trash2, RefreshCw, Settings } from 'lucide-react';
import { GlobalSettings, formatDate } from '@/utils/dashboardHelpers';
import { DateInput } from '@/components/common/DateInput';
import { toast } from 'sonner';
import { DeleteGovtHolidayModal } from '@/components/common/modals/DeleteGovtHolidayModal';

interface AdminLeaveSettingsProps {
  globalSettings: GlobalSettings;
  onSaveGlobalSettings: (settings: GlobalSettings, options?: { silent?: boolean }) => Promise<boolean>;
  initialFetchDone: boolean;
}

export function AdminLeaveSettings({
  globalSettings,
  onSaveGlobalSettings,
}: AdminLeaveSettingsProps) {
  // 1. Office Leave Settings State
  const [officeLeaveMode, setOfficeLeaveMode] = useState<'split' | 'merged'>(() => {
    return (globalSettings?.office_leave_mode === 'merged' || (globalSettings?.office_leave_h2 === 0 && globalSettings?.office_leave_mode !== 'split')) ? 'merged' : 'split';
  });
  const [officeLeaveH1, setOfficeLeaveH1] = useState<number>(() => {
    return globalSettings?.office_leave_split_h1 ?? globalSettings?.office_leave_h1 ?? 7;
  });
  const [officeLeaveH2, setOfficeLeaveH2] = useState<number>(() => {
    return globalSettings?.office_leave_split_h2 ?? globalSettings?.office_leave_h2 ?? 7;
  });
  const [officeLeaveYearly, setOfficeLeaveYearly] = useState<number>(() => {
    return globalSettings?.office_leave_default ?? ((globalSettings?.office_leave_h1 ?? 7) + (globalSettings?.office_leave_h2 ?? 7));
  });
  const [rememberedH1, setRememberedH1] = useState<number>(() => {
    return globalSettings?.office_leave_split_h1 ?? globalSettings?.office_leave_h1 ?? 7;
  });
  const [rememberedH2, setRememberedH2] = useState<number>(() => {
    return globalSettings?.office_leave_split_h2 ?? globalSettings?.office_leave_h2 ?? 7;
  });
  const [submittingOffice, setSubmittingOffice] = useState(false);

  // 2. Eid Leave Settings State
  const [eidFitrLeave, setEidFitrLeave] = useState(0);
  const [eidAdhaLeave, setEidAdhaLeave] = useState(0);
  const [submittingEid, setSubmittingEid] = useState(false);

  // 3. Govt Holiday Settings State
  const [govtHolidays, setGovtHolidays] = useState<{ date: string; name: string }[]>([]);
  const [newDate, setNewDate] = useState('');
  const [newName, setNewName] = useState('');
  const [submittingGovt, setSubmittingGovt] = useState(false);

  // Sync state with globalSettings on load/change
  useEffect(() => {
    if (globalSettings) {
      const mode = (globalSettings.office_leave_mode === 'merged' || (globalSettings.office_leave_h2 === 0 && globalSettings.office_leave_mode !== 'split')) ? 'merged' : 'split';
      setOfficeLeaveMode(mode);

      const splitH1 = globalSettings.office_leave_split_h1 ?? globalSettings.office_leave_h1 ?? 7;
      const splitH2 = globalSettings.office_leave_split_h2 ?? globalSettings.office_leave_h2 ?? 7;

      setRememberedH1(splitH1);
      setRememberedH2(splitH2);

      if (mode === 'split') {
        const h1 = globalSettings.office_leave_h1 ?? splitH1;
        const h2 = globalSettings.office_leave_h2 ?? splitH2;
        setOfficeLeaveH1(h1);
        setOfficeLeaveH2(h2);
        setOfficeLeaveYearly(h1 + h2);
      } else {
        setOfficeLeaveH1(splitH1);
        setOfficeLeaveH2(splitH2);
        setOfficeLeaveYearly(globalSettings.office_leave_default ?? (splitH1 + splitH2));
      }

      setEidFitrLeave(globalSettings.eid_fitr_leave ?? 0);
      setEidAdhaLeave(globalSettings.eid_adha_leave ?? 0);

      const raw = globalSettings.govt_holidays || [];
      const parsed = raw.map((h: any) => {
        if (h && typeof h === 'object' && h.date) {
          return { date: h.date, name: h.name || 'Govt Public Holiday' };
        }
        return { date: String(h), name: 'Govt Public Holiday' };
      });
      setGovtHolidays(parsed);

      const today = new Date();
      const localDate = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
      setNewDate(localDate);
      setNewName('');
    }
  }, [globalSettings]);

  const handleSelectSplitMode = () => {
    setOfficeLeaveMode('split');
    if (typeof window !== 'undefined') {
      try { localStorage.setItem('qc_office_leave_mode', 'split'); } catch (e) {}
    }
    const h1 = rememberedH1 ?? officeLeaveH1 ?? 7;
    const h2 = rememberedH2 ?? officeLeaveH2 ?? 7;
    setOfficeLeaveH1(h1);
    setOfficeLeaveH2(h2);
    setOfficeLeaveYearly(h1 + h2);
  };

  const handleSelectMergedMode = () => {
    setOfficeLeaveMode('merged');
    if (typeof window !== 'undefined') {
      try { localStorage.setItem('qc_office_leave_mode', 'merged'); } catch (e) {}
    }
    setRememberedH1(officeLeaveH1);
    setRememberedH2(officeLeaveH2);
    setOfficeLeaveYearly(officeLeaveH1 + officeLeaveH2);
  };

  // Save Office Leave settings
  const handleSaveOffice = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingOffice(true);

    let updatedH1 = Number(officeLeaveH1);
    let updatedH2 = Number(officeLeaveH2);
    let updatedDefault = updatedH1 + updatedH2;
    let finalSplitH1 = rememberedH1 ?? updatedH1;
    let finalSplitH2 = rememberedH2 ?? updatedH2;

    if (officeLeaveMode === 'merged') {
      updatedDefault = Number(officeLeaveYearly);
      updatedH1 = updatedDefault;
      updatedH2 = 0;
      finalSplitH1 = rememberedH1 ?? Math.floor(updatedDefault / 2);
      finalSplitH2 = rememberedH2 ?? (updatedDefault - Math.floor(updatedDefault / 2));
    } else {
      finalSplitH1 = updatedH1;
      finalSplitH2 = updatedH2;
    }

    const success = await onSaveGlobalSettings({
      ...globalSettings,
      office_leave_mode: officeLeaveMode,
      office_leave_h1: updatedH1,
      office_leave_h2: updatedH2,
      office_leave_default: updatedDefault,
      office_leave_split_h1: finalSplitH1,
      office_leave_split_h2: finalSplitH2,
    }, { silent: true });
    setSubmittingOffice(false);
    if (success) {
      toast.success(`Office allocated leave updated (${officeLeaveMode === 'merged' ? 'Merged Yearly' : 'Split H1/H2'})!`);
    }
  };

  // Save Eid Leave settings
  const handleSaveEid = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingEid(true);
    const success = await onSaveGlobalSettings({
      ...globalSettings,
      eid_fitr_leave: Number(eidFitrLeave),
      eid_adha_leave: Number(eidAdhaLeave),
    }, { silent: true });
    setSubmittingEid(false);
    if (success) {
      toast.success('Eid leave settings updated successfully!');
    }
  };

  // Add Govt Holiday and save directly
  const handleAddGovtDate = async () => {
    if (!newDate) {
      toast.error('Please select a date first!');
      return;
    }
    const nameVal = newName.trim();
    if (!nameVal) {
      toast.error('Please enter a holiday name!');
      return;
    }
    if (govtHolidays.some(h => h.date === newDate)) {
      toast.error('This date has already been added!');
      return;
    }
    const updatedHolidays = [...govtHolidays, { date: newDate, name: nameVal, created_at: new Date().toISOString() }].sort((a, b) => a.date.localeCompare(b.date));

    setSubmittingGovt(true);
    try {
      const success = await onSaveGlobalSettings({
        ...globalSettings,
        govt_holidays: updatedHolidays,
      }, { silent: true });

      if (success) {
        setGovtHolidays(updatedHolidays);
        setNewName('');
        setNewDate('');
        toast.success('Government Holiday added successfully!');
      }
    } catch (err) {
      console.error('Error adding holiday:', err);
      toast.error('Failed to add government holiday.');
    } finally {
      setSubmittingGovt(false);
    }
  };

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [holidayToDelete, setHolidayToDelete] = useState<{ date: string; name: string } | null>(null);

  // Remove Govt Holiday
  const handleRemoveGovtDate = (dateToRemove: string, nameToRemove: string) => {
    const isSaved = (globalSettings.govt_holidays || []).some((h: any) => {
      const d = (h && typeof h === 'object') ? h.date : String(h);
      return d === dateToRemove;
    });

    if (isSaved) {
      setHolidayToDelete({ date: dateToRemove, name: nameToRemove });
      setShowDeleteModal(true);
    } else {
      setGovtHolidays(prev => prev.filter(h => h.date !== dateToRemove));
      toast.success('Unsaved holiday removed from list.');
    }
  };

  const handleConfirmDeleteGovtDate = async () => {
    if (!holidayToDelete) return;
    try {
      const dateToRemove = holidayToDelete.date;
      const updatedHolidays = govtHolidays.filter(h => h.date !== dateToRemove);

      const success = await onSaveGlobalSettings({
        ...globalSettings,
        govt_holidays: updatedHolidays,
      }, { silent: true });

      if (!success) {
        throw new Error('Failed to update global settings.');
      }

      setGovtHolidays(updatedHolidays);
      toast.success('Government Holiday deleted successfully!');
      setShowDeleteModal(false);
      setHolidayToDelete(null);
    } catch (err: any) {
      console.error('Failed to delete government holiday:', err);
      toast.error(`Failed to delete holiday: ${err?.message || err}`);
      throw err;
    }
  };

  // Save Govt Holidays settings
  const handleSaveGovt = async () => {
    setSubmittingGovt(true);
    try {
      const success = await onSaveGlobalSettings({
        ...globalSettings,
        govt_holidays: govtHolidays,
      }, { silent: true });
      if (success) {
        toast.success('Govt Holidays saved successfully!');
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      toast.error('Failed to save settings!');
    } finally {
      setSubmittingGovt(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-fade-in font-sans">

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left Column: Office Leave & Eid Leave forms */}
        <div className="lg:col-span-1 flex flex-col gap-6">

          {/* Card 1: Office Allocated Leave Settings */}
          <div className="bg-theme-card-bg/40 backdrop-blur-xl border border-theme-border-muted shadow-xl rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2 flex-wrap pb-1 border-b border-theme-border-muted/60">
              <div>
                <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider">Office Allocated Leaves</h4>
                <p className="text-[10px] text-theme-text-muted mt-0.5">
                  {officeLeaveMode === 'split' ? 'Configure allocated days for H1 and H2 periods' : 'Configure allocated days for the full year'}
                </p>
              </div>
              {/* Split / Merge Pill Toggle */}
              <div className="flex bg-theme-page-bg border border-theme-border-input p-0.5 rounded-lg text-[10px] font-semibold">
                <button
                  type="button"
                  onClick={handleSelectSplitMode}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    officeLeaveMode === 'split'
                      ? 'bg-blue-600 text-white shadow-xs font-bold'
                      : 'text-theme-text-muted hover:text-theme-text-primary'
                  }`}
                >
                  Split (H1/H2)
                </button>
                <button
                  type="button"
                  onClick={handleSelectMergedMode}
                  className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                    officeLeaveMode === 'merged'
                      ? 'bg-blue-600 text-white shadow-xs font-bold'
                      : 'text-theme-text-muted hover:text-theme-text-primary'
                  }`}
                >
                  Merged (Yearly)
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveOffice} className="space-y-4 text-xs font-medium">
              {officeLeaveMode === 'split' ? (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-150">
                  <div>
                    <label className="block text-theme-text-muted font-semibold mb-1">H1 (Jan - Jun)</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={officeLeaveH1}
                      onChange={(e) => setOfficeLeaveH1(Math.round(parseFloat(e.target.value) || 0))}
                      className="block w-full px-3 py-1.5 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-xs focus:outline-none focus:border-blue-500/50 font-mono"
                    />
                    <span className="text-[9px] text-theme-text-muted mt-1 block">Usually 7 Days</span>
                  </div>
                  <div>
                    <label className="block text-theme-text-muted font-semibold mb-1">H2 (Jul - Dec)</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={officeLeaveH2}
                      onChange={(e) => setOfficeLeaveH2(Math.round(parseFloat(e.target.value) || 0))}
                      className="block w-full px-3 py-1.5 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-xs focus:outline-none focus:border-blue-500/50 font-mono"
                    />
                    <span className="text-[9px] text-theme-text-muted mt-1 block">Usually 7 Days</span>
                  </div>
                </div>
              ) : (
                <div className="animate-in fade-in duration-150">
                  <label className="block text-theme-text-muted font-semibold mb-1">Full Year Allocated Leave (Days)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={officeLeaveYearly}
                    onChange={(e) => setOfficeLeaveYearly(Math.round(parseFloat(e.target.value) || 0))}
                    className="block w-full px-3 py-1.5 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-xs focus:outline-none focus:border-blue-500/50 font-mono"
                  />
                  <span className="text-[9px] text-theme-text-muted mt-1 block">Usually 14 Days (Jan - Dec)</span>
                </div>
              )}

              <div className="pt-2 border-t border-theme-border-muted">
                <button
                  type="submit"
                  disabled={submittingOffice}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-all items-center gap-1.5 cursor-pointer shadow-md"
                >
                  {submittingOffice && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  Save Office Leaves
                </button>
              </div>
            </form>
          </div>

          {/* Card 2: Eid Leave Settings */}
          <div className="bg-theme-card-bg/40 backdrop-blur-xl border border-theme-border-muted shadow-xl rounded-2xl p-5 flex flex-col gap-4">
            <div>
              <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider">Eid Festival Leaves</h4>
              <p className="text-[10px] text-theme-text-muted mt-0.5">Configure allocated days for Eid-ul-Fitr and Eid-ul-Adha</p>
            </div>

            <form onSubmit={handleSaveEid} className="space-y-4 text-xs font-medium">
              <div>
                <label className="block text-theme-text-muted font-semibold mb-1">Eid-ul-Fitr Leave (Days)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={eidFitrLeave}
                  onChange={(e) => setEidFitrLeave(Math.round(parseFloat(e.target.value) || 0))}
                  className="block w-full px-3 py-1.5 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-xs focus:outline-none focus:border-blue-500/50 font-mono"
                />
              </div>

              <div>
                <label className="block text-theme-text-muted font-semibold mb-1">Eid-ul-Adha Leave (Days)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={eidAdhaLeave}
                  onChange={(e) => setEidAdhaLeave(Math.round(parseFloat(e.target.value) || 0))}
                  className="block w-full px-3 py-1.5 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-xs focus:outline-none focus:border-blue-500/50 font-mono"
                />
              </div>

              <div className="pt-2 border-t border-theme-border-muted">
                <button
                  type="submit"
                  disabled={submittingEid}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-all items-center gap-1.5 cursor-pointer shadow-md"
                >
                  {submittingEid && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  Save Eid Leaves
                </button>
              </div>
            </form>
          </div>

        </div>

        {/* Right Column: Government Holidays List (Takes 2 cols) */}
        <div className="lg:col-span-2">
          <div className="bg-theme-card-bg/40 backdrop-blur-xl border border-theme-border-muted shadow-xl rounded-2xl p-5 flex flex-col gap-4 h-full">
            <div>
              <h4 className="text-xs font-bold text-teal-400 uppercase tracking-wider">Government Holidays Calendar</h4>
              <p className="text-[10px] text-theme-text-muted mt-0.5">Manage and add government holiday dates for response preferences</p>
            </div>

            {/* Add Holiday Subform */}
            <div className="flex flex-col sm:flex-row gap-3 bg-theme-page-bg border border-theme-border-muted p-3.5 rounded-xl items-end">
              <div className="flex-1 w-full">
                <label className="block text-[10px] font-bold text-theme-text-muted uppercase tracking-wider mb-1">Holiday Date</label>
                <DateInput
                  value={newDate}
                  onChange={(val) => setNewDate(val)}
                  className="bg-theme-card-bg border-theme-border-input"
                />
              </div>
              <div className="flex-1 w-full">
                <label className="block text-[10px] font-bold text-theme-text-muted uppercase tracking-wider mb-1">Holiday Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Shab-e-Barat, Victory Day"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 bg-theme-card-bg border border-theme-border-input rounded-lg text-theme-text-primary text-xs focus:outline-none focus:border-blue-500/50 h-[34px]"
                />
              </div>
              <button
                type="button"
                onClick={handleAddGovtDate}
                disabled={submittingGovt}
                className="py-2 px-4 bg-teal-600 hover:bg-teal-555 text-white rounded-lg transition-all flex items-center justify-center cursor-pointer border border-teal-700 shadow-md font-bold text-xs h-[34px] w-full sm:w-auto shrink-0 gap-1 disabled:opacity-50"
              >
                {submittingGovt ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Add Date
              </button>
            </div>

            {/* Holidays List */}
            <div className="flex-1 flex flex-col gap-2 min-h-[220px]">
              <label className="block text-[10px] font-bold text-theme-text-muted uppercase tracking-wider">Holidays List ({govtHolidays.length} {govtHolidays.length === 1 ? 'day' : 'days'})</label>

              {govtHolidays.length === 0 ? (
                <div className="flex-1 flex items-center justify-center py-12 text-center text-theme-text-muted border border-dashed border-theme-border-muted rounded-xl bg-theme-page-bg/20 text-xs">
                  No government holidays have been added for the current year.
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto max-h-[300px] border border-theme-border-muted rounded-xl bg-theme-page-bg/20 divide-y divide-theme-border-muted/60 font-mono text-xs">
                  {govtHolidays.map((h) => (
                    <div key={h.date} className="flex justify-between items-center px-4 py-2.5 hover:bg-theme-card-bg/30 transition-all">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-theme-text-primary font-semibold">{formatDate(h.date)}</span>
                        <span className="text-theme-text-muted text-[10px] font-sans">{h.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveGovtDate(h.date, h.name)}
                        className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-all cursor-pointer"
                        title="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
      {holidayToDelete && (
        <DeleteGovtHolidayModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setHolidayToDelete(null);
          }}
          holidayName={holidayToDelete.name}
          holidayDate={formatDate(holidayToDelete.date)}
          onConfirm={handleConfirmDeleteGovtDate}
        />
      )}
    </div>
  );
}
