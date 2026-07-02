'use client';

import React, { useState, useEffect } from 'react';
import { SlidersHorizontal, RefreshCw } from 'lucide-react';
import { ChutiRecord } from '@/utils/offlineSync';
import { calculateStats, GlobalSettings } from '@/utils/dashboardHelpers';

import { Modal } from '../Modal';

interface AdjustmentModalProps {
  showAdjustmentModal: boolean;
  setShowAdjustmentModal: (val: boolean) => void;
  adjustmentRecord: ChutiRecord | null;
  setAdjustmentRecord: (val: ChutiRecord | null) => void;
  adjustmentType: 'full' | 'partial';
  setAdjustmentType: (val: 'full' | 'partial') => void;
  partialAdjustmentTime: string;
  setPartialAdjustmentTime: (val: string) => void;
  setAdjustShortLeaveOption: (val: boolean) => void;
  handleSaveAdjustment: (adjustSL?: boolean, category?: string) => void;
  records: ChutiRecord[];
  holidayResponses: any[];
  globalSettings: GlobalSettings;
  submitting?: boolean;
}

export function AdjustmentModal({
  showAdjustmentModal,
  setShowAdjustmentModal,
  adjustmentRecord,
  setAdjustmentRecord,
  adjustmentType,
  setAdjustmentType,
  partialAdjustmentTime,
  setPartialAdjustmentTime,
  setAdjustShortLeaveOption,
  handleSaveAdjustment,
  records = [],
  holidayResponses = [],
  globalSettings,
  submitting = false,
}: AdjustmentModalProps) {
  const [selectedCategory, setSelectedCategory] = useState('None');

  // Reset selected category when opening the modal
  useEffect(() => {
    if (showAdjustmentModal) {
      setSelectedCategory('None');
    }
  }, [showAdjustmentModal, adjustmentRecord]);

  const selectedYear = adjustmentRecord?.date ? adjustmentRecord.date.substring(0, 4) : new Date().getFullYear().toString();
  const approvedRecords = records.filter(r => r.status === 'approved' && r.date && r.date.substring(0, 4) === selectedYear);
  const stats = calculateStats(approvedRecords);

  const reservedCount = holidayResponses.filter((r: any) => r.user_id === adjustmentRecord?.user_id && r.response === 'reserve').length;
  const govtHolidayRemaining = Math.max(0, reservedCount - (stats.govtHolidaysTaken ?? 0));

  const eidFitrTotal = globalSettings?.eid_fitr_leave ?? 0;
  const eidFitrRemaining = Math.max(0, eidFitrTotal - (stats.eidFitrTaken ?? 0));

  const eidAdhaTotal = globalSettings?.eid_adha_leave ?? 0;
  const eidAdhaRemaining = Math.max(0, eidAdhaTotal - (stats.eidAdhaTaken ?? 0));

  const hasAnyCategoryRemaining = govtHolidayRemaining > 0 || eidFitrRemaining > 0 || eidAdhaRemaining > 0;

  return (
    <Modal
      isOpen={showAdjustmentModal && adjustmentRecord !== null}
      onClose={() => {
        setShowAdjustmentModal(false);
        setAdjustmentRecord(null);
      }}
      title="Confirm Leave Adjustment"
      icon={<SlidersHorizontal className="h-5 w-5 text-orange-500" />}
      glowClass="bg-orange-900/10"
      maxWidthClass="max-w-md"
    >
      {adjustmentRecord && (
        <>
          {adjustmentRecord.leave_type === 'Short Leave' ? (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">For Short Leave, select whether you want to adjust the full duration or a partial duration:</p>
              <div className="flex gap-4">
                <label className="flex-1 flex items-center gap-2 p-3 bg-slate-955/60 border border-slate-800 rounded-lg cursor-pointer hover:border-slate-700 hover:scale-[1.01] transition-all">
                  <input
                    type="radio"
                    name="adjustmentType"
                    checked={adjustmentType === 'full'}
                    onChange={() => setAdjustmentType('full')}
                    className="text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-xs text-white font-medium">Full Duration ({adjustmentRecord.leave_hour ? adjustmentRecord.leave_hour.toString().split('.')[0].substring(0, 5) : '-'})</span>
                </label>
                <label className="flex-1 flex items-center gap-2 p-3 bg-slate-955/60 border border-slate-800 rounded-lg cursor-pointer hover:border-slate-700 hover:scale-[1.01] transition-all">
                  <input
                    type="radio"
                    name="adjustmentType"
                    checked={adjustmentType === 'partial'}
                    onChange={() => setAdjustmentType('partial')}
                    className="text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-xs text-white font-medium">Partial Duration</span>
                </label>
              </div>

              {adjustmentType === 'partial' && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Partial Adjustment Duration (HH:MM)</label>
                  <input
                    type="text"
                    placeholder="e.g., 02:00"
                    value={partialAdjustmentTime}
                    onChange={(e) => setPartialAdjustmentTime(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setShowAdjustmentModal(false);
                    setAdjustmentRecord(null);
                  }}
                  className="flex-1 flex justify-center py-2 px-4 border border-slate-800 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-355 bg-slate-955 hover:bg-slate-900 hover:scale-[1.01] active:scale-[0.99] cursor-pointer transition-all duration-200 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSaveAdjustment()}
                  className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 hover:scale-[1.01] active:scale-[0.99] cursor-pointer transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  {submitting ? 'Adjusting...' : 'Adjust Leave'}
                </button>
              </div>
            </div>
          ) : adjustmentRecord.leave_type === 'Overtime' ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-355 font-medium">For Overtime adjustment, do you want to deduct it from the Short Leave balance?</p>
              <div className="flex flex-col gap-2 pt-4">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setAdjustShortLeaveOption(true);
                    handleSaveAdjustment(true);
                  }}
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 hover:scale-[1.01] active:scale-[0.99] cursor-pointer transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  {submitting ? 'Processing...' : 'Yes, deduct from Short Leave'}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setAdjustShortLeaveOption(false);
                    handleSaveAdjustment(false);
                  }}
                  className="w-full flex justify-center py-2.5 px-4 border border-slate-800 rounded-lg text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 hover:scale-[1.01] active:scale-[0.99] cursor-pointer transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  {submitting ? 'Processing...' : 'No, just discard Overtime'}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setShowAdjustmentModal(false);
                    setAdjustmentRecord(null);
                  }}
                  className="w-full flex justify-center py-2.5 px-4 border border-slate-800 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-350 bg-slate-955 hover:bg-slate-900 hover:scale-[1.01] active:scale-[0.99] cursor-pointer transition-all duration-200 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {hasAnyCategoryRemaining ? (
                <div className="space-y-4">
                  {/* Remaining Leave Summary */}
                  <div className="bg-slate-955/60 border border-slate-850 p-3.5 rounded-xl space-y-2">
                    <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-sans">Remaining Holiday Summary ({selectedYear})</span>
                    <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-medium font-sans">
                      <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-850">
                        <span className="text-slate-500 block text-[9px] uppercase font-bold font-sans">Govt Holiday</span>
                        <span className="text-teal-400 font-bold font-mono">{govtHolidayRemaining} days</span>
                      </div>
                      <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-850">
                        <span className="text-slate-500 block text-[9px] uppercase font-bold font-sans">Eid-ul-Fitr</span>
                        <span className="text-amber-400 font-bold font-mono">{eidFitrRemaining} days</span>
                      </div>
                      <div className="bg-slate-900/50 p-2 rounded-lg border border-slate-850">
                        <span className="text-slate-500 block text-[9px] uppercase font-bold font-sans">Eid-ul-Adha</span>
                        <span className="text-amber-400 font-bold font-mono">{eidAdhaRemaining} days</span>
                      </div>
                    </div>
                  </div>

                  {/* Selection Category toggles */}
                  <div className="space-y-2.5">
                    <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-sans">Select Adjustment Category</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {/* General Option */}
                      <button
                        type="button"
                        onClick={() => setSelectedCategory('None')}
                        className={`flex items-center justify-between p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                          selectedCategory === 'None'
                            ? 'bg-orange-950/20 border-orange-500/80 shadow-[0_0_12px_rgba(249,115,22,0.15)]'
                            : 'bg-slate-955/20 border-slate-850 hover:bg-slate-850/40 hover:border-slate-800'
                        }`}
                      >
                        <span className="text-xs font-bold text-white font-sans">General Adjustment</span>
                        <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                          selectedCategory === 'None' ? 'border-orange-500' : 'border-slate-600'
                        }`}>
                          {selectedCategory === 'None' && <div className="w-2 h-2 rounded-full bg-orange-500" />}
                        </div>
                      </button>

                      {/* Govt Holiday Option */}
                      {govtHolidayRemaining > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedCategory('Govt Holiday')}
                          className={`flex items-center justify-between p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                            selectedCategory === 'Govt Holiday'
                              ? 'bg-teal-955/20 border-teal-500/80 shadow-[0_0_12px_rgba(20,184,166,0.15)]'
                              : 'bg-slate-955/20 border-slate-850 hover:bg-slate-850/40 hover:border-slate-800'
                          }`}
                        >
                          <span className="text-xs font-bold text-white font-sans">Govt Holiday</span>
                          <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                            selectedCategory === 'Govt Holiday' ? 'border-teal-500' : 'border-slate-600'
                          }`}>
                            {selectedCategory === 'Govt Holiday' && <div className="w-2 h-2 rounded-full bg-teal-500" />}
                          </div>
                        </button>
                      )}

                      {/* Eid-ul-Fitr Option */}
                      {eidFitrRemaining > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedCategory('Eid-ul-Fitr')}
                          className={`flex items-center justify-between p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                            selectedCategory === 'Eid-ul-Fitr'
                              ? 'bg-amber-955/20 border-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                              : 'bg-slate-955/20 border-slate-850 hover:bg-slate-850/40 hover:border-slate-800'
                          }`}
                        >
                          <span className="text-xs font-bold text-white font-sans">Eid-ul-Fitr</span>
                          <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                            selectedCategory === 'Eid-ul-Fitr' ? 'border-amber-500' : 'border-slate-600'
                          }`}>
                            {selectedCategory === 'Eid-ul-Fitr' && <div className="w-2 h-2 rounded-full bg-amber-500" />}
                          </div>
                        </button>
                      )}

                      {/* Eid-ul-Adha Option */}
                      {eidAdhaRemaining > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedCategory('Eid-ul-Adha')}
                          className={`flex items-center justify-between p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                            selectedCategory === 'Eid-ul-Adha'
                              ? 'bg-amber-955/20 border-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                              : 'bg-slate-955/20 border-slate-850 hover:bg-slate-850/40 hover:border-slate-800'
                          }`}
                        >
                          <span className="text-xs font-bold text-white font-sans">Eid-ul-Adha</span>
                          <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                            selectedCategory === 'Eid-ul-Adha' ? 'border-amber-500' : 'border-slate-600'
                          }`}>
                            {selectedCategory === 'Eid-ul-Adha' && <div className="w-2 h-2 rounded-full bg-amber-500" />}
                          </div>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-sm text-slate-355 font-medium font-sans">Are you sure you want to fully adjust this leave record?</p>
                  <p className="text-[10px] text-slate-500 font-sans">Note: All special holiday pools (Govt Holiday, Eids) are fully taken.</p>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-slate-800/80">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setShowAdjustmentModal(false);
                    setAdjustmentRecord(null);
                  }}
                  className="flex-1 flex justify-center py-2 px-4 border border-slate-800 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-350 bg-slate-955 hover:bg-slate-900 hover:scale-[1.01] active:scale-[0.99] cursor-pointer transition-all duration-200 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSaveAdjustment(undefined, selectedCategory)}
                  className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 hover:scale-[1.01] active:scale-[0.99] cursor-pointer transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  {submitting ? 'Adjusting...' : 'Adjust Leave'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
