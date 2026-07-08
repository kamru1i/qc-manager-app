'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Trash2, RefreshCw, Settings } from 'lucide-react';
import { GlobalSettings, formatDate } from '@/utils/dashboardHelpers';
import { DateInput } from '@/components/DateInput';
import { supabase } from '@/utils/supabase';
import { toast } from 'react-hot-toast';

interface AdminLeaveSettingsProps {
  globalSettings: GlobalSettings;
  onSaveGlobalSettings: (settings: GlobalSettings, options?: { silent?: boolean }) => Promise<boolean>;
  initialFetchDone: boolean;
}

export function AdminLeaveSettings({
  globalSettings,
  onSaveGlobalSettings,
  initialFetchDone,
}: AdminLeaveSettingsProps) {
  // 1. Office Leave Settings State
  const [officeLeaveH1, setOfficeLeaveH1] = useState(7);
  const [officeLeaveH2, setOfficeLeaveH2] = useState(7);
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
      setOfficeLeaveH1(globalSettings.office_leave_h1 ?? 7);
      setOfficeLeaveH2(globalSettings.office_leave_h2 ?? 7);

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

  // Save Office Leave settings
  const handleSaveOffice = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingOffice(true);
    const success = await onSaveGlobalSettings({
      ...globalSettings,
      office_leave_h1: Number(officeLeaveH1),
      office_leave_h2: Number(officeLeaveH2),
      office_leave_default: Number(officeLeaveH1) + Number(officeLeaveH2),
    }, { silent: true });
    setSubmittingOffice(false);
    if (success) {
      toast.success('Office allocated leave settings updated successfully!');
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

  // Add Govt Holiday to local list
  const handleAddGovtDate = () => {
    if (!newDate) return;
    const nameVal = newName.trim() || 'Govt Public Holiday';
    if (govtHolidays.some(h => h.date === newDate)) {
      toast.error('This date has already been added!');
      return;
    }
    setGovtHolidays(prev => [...prev, { date: newDate, name: nameVal }].sort((a, b) => a.date.localeCompare(b.date)));
    setNewName('');
  };

  // Remove Govt Holiday from local list
  const handleRemoveGovtDate = (dateToRemove: string, nameToRemove: string) => {
    if (confirm(`Are you sure you want to remove the government holiday "${nameToRemove}" on ${formatDate(dateToRemove)}?\nThis will clear responses from all employees for this date.`)) {
      setGovtHolidays(prev => prev.filter(h => h.date !== dateToRemove));
    }
  };

  // Save Govt Holidays settings
  const handleSaveGovt = async () => {
    setSubmittingGovt(true);
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
      {/* Title Header */}
      <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-850 p-6 rounded-2xl shadow-xl">
        <h3 className="text-md font-bold text-white flex items-center gap-2">
          <Settings className="h-4.5 w-4.5 text-blue-400" />
          Leave Settings
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Directly configure and manage the company leave policy quotas, Eid holidays, and government calendar leaves.
        </p>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Office Leave & Eid Leave forms */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          
          {/* Card 1: Office Allocated Leave Settings */}
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-850 shadow-xl rounded-2xl p-5 flex flex-col gap-4">
            <div>
              <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider">Office Allocated Leaves</h4>
              <p className="text-[10px] text-slate-500 mt-0.5">Configure allocated days for H1 and H2 periods</p>
            </div>
            
            <form onSubmit={handleSaveOffice} className="space-y-4 text-xs font-medium">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">H1 (Jan - Jun)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={officeLeaveH1}
                    onChange={(e) => setOfficeLeaveH1(Math.round(parseFloat(e.target.value) || 0))}
                    className="block w-full px-3 py-1.5 bg-slate-955 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500/50 font-mono"
                  />
                  <span className="text-[9px] text-slate-500 mt-1 block">Usually 7 Days</span>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">H2 (Jul - Dec)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={officeLeaveH2}
                    onChange={(e) => setOfficeLeaveH2(Math.round(parseFloat(e.target.value) || 0))}
                    className="block w-full px-3 py-1.5 bg-slate-955 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500/50 font-mono"
                  />
                  <span className="text-[9px] text-slate-500 mt-1 block">Usually 7 Days</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-850">
                <button
                  type="submit"
                  disabled={submittingOffice}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                >
                  {submittingOffice && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  Save Office Leaves
                </button>
              </div>
            </form>
          </div>

          {/* Card 2: Eid Leave Settings */}
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-850 shadow-xl rounded-2xl p-5 flex flex-col gap-4">
            <div>
              <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider">Eid Festival Leaves</h4>
              <p className="text-[10px] text-slate-500 mt-0.5">Configure allocated days for Eid-ul-Fitr and Eid-ul-Adha</p>
            </div>
            
            <form onSubmit={handleSaveEid} className="space-y-4 text-xs font-medium">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Eid-ul-Fitr Leave (Days)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={eidFitrLeave}
                  onChange={(e) => setEidFitrLeave(Math.round(parseFloat(e.target.value) || 0))}
                  className="block w-full px-3 py-1.5 bg-slate-955 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500/50 font-mono"
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
                  className="block w-full px-3 py-1.5 bg-slate-955 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500/50 font-mono"
                />
              </div>

              <div className="pt-2 border-t border-slate-850">
                <button
                  type="submit"
                  disabled={submittingEid}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
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
          <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-850 shadow-xl rounded-2xl p-5 flex flex-col gap-4 h-full">
            <div>
              <h4 className="text-xs font-bold text-teal-400 uppercase tracking-wider">Government Holidays Calendar</h4>
              <p className="text-[10px] text-slate-500 mt-0.5">Manage and add government holiday dates for response preferences</p>
            </div>

            {/* Add Holiday Subform */}
            <div className="flex flex-col sm:flex-row gap-3 bg-slate-955 border border-slate-850 p-3.5 rounded-xl items-end">
              <div className="flex-1 w-full">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Holiday Date</label>
                <DateInput
                  value={newDate}
                  onChange={(val) => setNewDate(val)}
                  className="bg-slate-900 border-slate-800"
                />
              </div>
              <div className="flex-1 w-full">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Holiday Name</label>
                <input
                  type="text"
                  placeholder="e.g. Shab-e-Barat, Victory Day"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-blue-500/50 h-[34px]"
                />
              </div>
              <button
                type="button"
                onClick={handleAddGovtDate}
                className="py-2 px-4 bg-teal-600 hover:bg-teal-555 text-white rounded-lg transition-all flex items-center justify-center cursor-pointer border border-teal-700 shadow-md font-bold text-xs h-[34px] w-full sm:w-auto shrink-0 gap-1"
              >
                <Plus className="h-4 w-4" /> Add Date
              </button>
            </div>

            {/* Holidays List */}
            <div className="flex-1 flex flex-col gap-2 min-h-[220px]">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Holidays List ({govtHolidays.length} {govtHolidays.length === 1 ? 'day' : 'days'})</label>
              
              {govtHolidays.length === 0 ? (
                <div className="flex-1 flex items-center justify-center py-12 text-center text-slate-500 border border-dashed border-slate-850 rounded-xl bg-slate-955/20 text-xs">
                  No government holidays have been added for the current year.
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto max-h-[300px] border border-slate-850 rounded-xl bg-slate-955/20 divide-y divide-slate-850/60 font-mono text-xs">
                  {govtHolidays.map((h) => (
                    <div key={h.date} className="flex justify-between items-center px-4 py-2.5 hover:bg-slate-900/30 transition-all">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-white font-semibold">{formatDate(h.date)}</span>
                        <span className="text-slate-400 text-[10px] font-sans">{h.name}</span>
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

            {/* Save Button for Govt Holidays */}
            <div className="pt-3 border-t border-slate-850 flex justify-end">
              <button
                type="button"
                onClick={handleSaveGovt}
                disabled={submittingGovt}
                className="w-full sm:w-auto px-6 py-2.5 border border-transparent rounded-lg shadow-md text-xs font-bold text-white bg-teal-600 hover:bg-teal-555 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {submittingGovt && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                Save Holiday Calendar
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
