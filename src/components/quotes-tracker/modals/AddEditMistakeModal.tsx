'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AlertCircle, AlertTriangle, RefreshCw, X, Calendar, FileText, Building2, User, FileCode, Gavel } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { DateInput } from '@/components/common/DateInput';
import { CustomSelect } from '@/components/common/CustomSelect';
import { DEFAULT_BRANCHES } from '@/utils/bulkQuoteParser';
import { Profile, QuotationMistake } from '@/types';

interface AddEditMistakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: {
    date: string;
    filename: string;
    branch: string;
    user_id: string;
    codename: string;
    mistake_details: string;
    penalty: string;
  }) => Promise<boolean>;
  editingMistake: QuotationMistake | null;
  profilesList: Profile[];
  isSubmitting: boolean;
}

export function AddEditMistakeModal({
  isOpen,
  onClose,
  onSave,
  editingMistake,
  profilesList,
  isSubmitting,
}: AddEditMistakeModalProps) {
  const [date, setDate] = useState<string>('');
  const [filename, setFilename] = useState<string>('');
  const [branch, setBranch] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [codename, setCodename] = useState<string>('');
  const [details, setDetails] = useState<string>('');
  const [penalty, setPenalty] = useState<string>('');

  // Validation Error States
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dateInputHasError, setDateInputHasError] = useState<boolean>(false);

  // User Options for Codename Dropdown (All roles with Quotes workspace enabled)
  const userOptions = useMemo(() => {
    return profilesList
      .filter((p) => p.has_quotes_access !== false)
      .map((p) => {
        const userCodename = p.codename || p.username;
        return {
          value: p.id,
          label: userCodename,
          codename: userCodename,
        };
      })
      .sort((a, b) => a.codename.localeCompare(b.codename));
  }, [profilesList]);

  // Branch Options using DEFAULT_BRANCHES
  const branchOptions = useMemo(() => {
    return DEFAULT_BRANCHES.map((b) => ({ value: b, label: b }));
  }, []);

  // Sync state when modal opens or editingMistake changes
  useEffect(() => {
    if (isOpen) {
      if (editingMistake) {
        setDate(editingMistake.date || new Date().toISOString().split('T')[0]);
        setFilename(editingMistake.filename || '');
        setBranch(editingMistake.branch || '');
        setUserId(editingMistake.user_id || '');
        setCodename(editingMistake.codename || '');
        setDetails(editingMistake.mistake_details || '');
        setPenalty(editingMistake.penalty || '');
      } else {
        const today = new Date().toISOString().split('T')[0];
        setDate(today);
        setFilename('');
        setBranch(branchOptions[0]?.value || 'ADI');
        setUserId(userOptions[0]?.value || '');
        setCodename(userOptions[0]?.codename || '');
        setDetails('');
        setPenalty('');
      }
      setErrors({});
    }
  }, [isOpen, editingMistake, branchOptions, userOptions]);

  // When selected user changes, sync codename internally
  const handleUserChange = (selectedId: string) => {
    setUserId(selectedId);
    const selectedUser = userOptions.find((u) => u.value === selectedId);
    if (selectedUser) {
      setCodename(selectedUser.codename);
    }
    if (errors.userId) {
      setErrors((prev) => ({ ...prev, userId: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!date) newErrors.date = 'Date is required.';
    if (!filename.trim()) newErrors.filename = 'Filename is required.';
    if (!branch) newErrors.branch = 'Branch is required.';
    if (!userId || !codename) newErrors.userId = 'Codename / Employee is required.';
    if (!details.trim()) newErrors.details = 'Mistake details are required.';
    if (!penalty.trim()) newErrors.penalty = 'Penalty details are required.';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0 && !dateInputHasError;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const success = await onSave({
      date,
      filename,
      branch,
      user_id: userId,
      codename,
      mistake_details: details,
      penalty,
    });

    if (success) {
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isSubmitting) onClose();
      }}
      title={editingMistake ? 'Edit Quotation Mistake' : 'Add Quotation Mistake'}
      icon={<AlertTriangle className="h-5 w-5 text-rose-500" />}
      glowClass="bg-rose-900/10"
      maxWidthClass="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {/* Row 1: Date & Branch */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-theme-text-primary mb-1 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-blue-400" />
              Date <span className="text-red-400">*</span>
            </label>
            <DateInput
              value={date}
              onChange={(val) => {
                setDate(val);
                if (errors.date) setErrors((prev) => ({ ...prev, date: '' }));
              }}
              onErrorChange={setDateInputHasError}
              disabled={isSubmitting}
              required
              className={`h-9 px-3 py-2 ${errors.date ? 'border-red-500/80' : ''}`}
            />
            {errors.date && <p className="text-[11px] text-red-400 mt-1">{errors.date}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-theme-text-primary mb-1 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-emerald-400" />
              Branch <span className="text-red-400">*</span>
            </label>
            <CustomSelect
              className="w-full"
              buttonClassName={`w-full flex items-center justify-between gap-2 bg-theme-page-bg border ${
                errors.branch ? 'border-red-500/80' : 'border-theme-border-input'
              } text-theme-text-primary rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-rose-500 cursor-pointer text-xs h-9 disabled:opacity-50 disabled:cursor-not-allowed text-left select-none`}
              value={branch}
              onChange={(val) => {
                setBranch(val);
                if (errors.branch) setErrors((prev) => ({ ...prev, branch: '' }));
              }}
              options={branchOptions}
              disabled={isSubmitting}
            />
            {errors.branch && <p className="text-[11px] text-red-400 mt-1">{errors.branch}</p>}
          </div>
        </div>

        {/* Row 2: Filename & Codename */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-theme-text-primary mb-1 flex items-center gap-1.5">
              <FileCode className="h-3.5 w-3.5 text-purple-400" />
              Filename <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. AB1234_QUOTE.pdf"
              value={filename}
              onChange={(e) => {
                setFilename(e.target.value);
                if (errors.filename) setErrors((prev) => ({ ...prev, filename: '' }));
              }}
              disabled={isSubmitting}
              className={`block w-full px-3 py-2 bg-theme-page-bg border ${
                errors.filename ? 'border-red-500/80' : 'border-theme-border-input'
              } rounded-lg text-theme-text-primary placeholder-theme-text-muted/60 focus:outline-none focus:ring-1 focus:ring-rose-500 text-xs h-9`}
            />
            {errors.filename && <p className="text-[11px] text-red-400 mt-1">{errors.filename}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-theme-text-primary mb-1 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-amber-400" />
              Codename (Employee) <span className="text-red-400">*</span>
            </label>
            <CustomSelect
              className="w-full"
              buttonClassName={`w-full flex items-center justify-between gap-2 bg-theme-page-bg border ${
                errors.userId ? 'border-red-500/80' : 'border-theme-border-input'
              } text-theme-text-primary rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-rose-500 cursor-pointer text-xs h-9 disabled:opacity-50 disabled:cursor-not-allowed text-left select-none`}
              value={userId}
              onChange={handleUserChange}
              options={userOptions}
              disabled={isSubmitting}
            />
            {errors.userId && <p className="text-[11px] text-red-400 mt-1">{errors.userId}</p>}
          </div>
        </div>

        {/* Details */}
        <div>
          <label className="block text-xs font-semibold text-theme-text-primary mb-1 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-cyan-400" />
            Mistake Details <span className="text-red-400">*</span>
          </label>
          <textarea
            rows={3}
            placeholder="Write clear mistake details..."
            value={details}
            onChange={(e) => {
              setDetails(e.target.value);
              if (errors.details) setErrors((prev) => ({ ...prev, details: '' }));
            }}
            disabled={isSubmitting}
            className={`block w-full p-2.5 bg-theme-page-bg border ${
              errors.details ? 'border-red-500/80' : 'border-theme-border-input'
            } rounded-lg text-theme-text-primary placeholder-theme-text-muted/60 focus:outline-none focus:ring-1 focus:ring-rose-500 text-xs leading-relaxed`}
          />
          {errors.details && <p className="text-[11px] text-red-400 mt-1">{errors.details}</p>}
        </div>

        {/* Penalty */}
        <div>
          <label className="block text-xs font-semibold text-theme-text-primary mb-1 flex items-center gap-1.5">
            <Gavel className="h-3.5 w-3.5 text-rose-400" />
            Penalty Details <span className="text-red-400">*</span>
          </label>
          <textarea
            rows={2}
            placeholder="Write penalty description..."
            value={penalty}
            onChange={(e) => {
              setPenalty(e.target.value);
              if (errors.penalty) setErrors((prev) => ({ ...prev, penalty: '' }));
            }}
            disabled={isSubmitting}
            className={`block w-full p-2.5 bg-theme-page-bg border ${
              errors.penalty ? 'border-red-500/80' : 'border-theme-border-input'
            } rounded-lg text-theme-text-primary placeholder-theme-text-muted/60 focus:outline-none focus:ring-1 focus:ring-rose-500 text-xs leading-relaxed`}
          />
          {errors.penalty && <p className="text-[11px] text-red-400 mt-1">{errors.penalty}</p>}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="flex-1 py-2.5 px-4 border border-theme-border-input rounded-lg text-xs font-bold text-theme-text-muted hover:text-theme-text-secondary bg-theme-page-bg hover:bg-theme-card-bg cursor-pointer transition-all duration-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 py-2.5 px-4 border border-transparent rounded-lg shadow-md text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 hover:scale-[1.01] active:scale-[0.99] cursor-pointer transition-all duration-200 flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {isSubmitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
            {isSubmitting ? 'Saving...' : editingMistake ? 'Update Mistake' : 'Save Mistake'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
