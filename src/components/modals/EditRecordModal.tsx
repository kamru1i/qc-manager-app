import React, { useEffect, useCallback } from 'react';
import { X, Loader2 } from 'lucide-react';
import { FileType } from '@/types';
import { BranchSelector } from '../BranchSelector';

interface EditRecordModalProps {
  editFileName: string;
  setEditFileName: (val: string) => void;
  editBranchName: string;
  setEditBranchName: (val: string) => void;
  editCodename: string;
  setEditCodename: (val: string) => void;
  editFileType: FileType;
  setEditFileType: (val: FileType) => void;
  canEditSubmittedAt: boolean;
  editSubmittedDate: string;
  setEditSubmittedDate: (val: string) => void;
  editSubmittedTime: string;
  setEditSubmittedTime: (val: string) => void;
  allowedCategories: string[];
  onClose: () => void;
  onSave: () => void;
  editSaleStatus?: 'SOLD' | 'UNSOLD';
  setEditSaleStatus?: (val: 'SOLD' | 'UNSOLD') => void;
  submitting?: boolean;
}

export const EditRecordModal: React.FC<EditRecordModalProps> = ({
  editFileName,
  setEditFileName,
  editBranchName,
  setEditBranchName,
  editCodename,
  setEditCodename,
  editFileType,
  setEditFileType,
  canEditSubmittedAt,
  editSubmittedDate,
  setEditSubmittedDate,
  editSubmittedTime,
  setEditSubmittedTime,
  allowedCategories,
  onClose,
  onSave,
  editSaleStatus,
  setEditSaleStatus,
  submitting = false
}) => {
  // Close on Escape key press
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && !submitting) onClose();
  }, [onClose, submitting]);

  useEffect(() => {
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [handleEscape]);

  const handleDateChange = (value: string) => {
    const clean = value.replace(/\D/g, "").slice(0, 8);
    let formatted = clean.slice(0, 2);

    if (clean.length > 2) {
      formatted += `-${clean.slice(2, 4)}`;
    }

    if (clean.length > 4) {
      formatted += `-${clean.slice(4, 8)}`;
    }

    setEditSubmittedDate(formatted);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-md shadow-2xl relative">
        <button
          onClick={onClose}
          disabled={submitting}
          className="absolute right-4 top-4 text-slate-450 hover:text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <X className="h-5 w-5" />
        </button>

        <h3 className="text-lg font-bold text-white mb-1">Edit Entry</h3>
        <p className="text-xs text-slate-450 mb-5">Modify the details of the selected file below.</p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-350 mb-1">File Name</label>
            <input
              type="text"
              disabled={submitting}
              value={editFileName}
              onChange={(e) => setEditFileName(e.target.value)}
              className="block w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-355 mb-1">Branch Name</label>
            <BranchSelector
              value={editBranchName}
              onChange={setEditBranchName}
              required={true}
              size="sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-355 mb-1">Codename</label>
            <input
              type="text"
              disabled={submitting}
              value={editCodename}
              onChange={(e) => setEditCodename(e.target.value.toUpperCase())}
              className="block w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-355 mb-1.5">File Category</label>
            <select
              value={editFileType}
              disabled={submitting}
              onChange={(e) => setEditFileType(e.target.value as FileType)}
              className="block w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer disabled:opacity-50"
            >
              {allowedCategories.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {editFileType === 'Sale' && editSaleStatus && setEditSaleStatus && (
            <div>
              <label className="block text-xs font-semibold text-slate-355 mb-1.5">Sale Status</label>
              <select
                value={editSaleStatus}
                disabled={submitting}
                onChange={(e) => setEditSaleStatus(e.target.value as 'SOLD' | 'UNSOLD')}
                className="block w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer disabled:opacity-50"
              >
                <option value="SOLD">Sold</option>
                <option value="UNSOLD">Unsold</option>
              </select>
            </div>
          )}

          {canEditSubmittedAt && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-355 mb-1">Submitted Date</label>
                <input
                  type="text"
                  inputMode="numeric"
                  disabled={submitting}
                  maxLength={10}
                  placeholder="DD-MM-YYYY"
                  value={editSubmittedDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="block w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white text-xs placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-355 mb-1">Submitted Time</label>
                <input
                  type="text"
                  disabled={submitting}
                  maxLength={8}
                  placeholder="09:21 PM"
                  value={editSubmittedTime}
                  onChange={(e) => setEditSubmittedTime(e.target.value.toUpperCase())}
                  className="block w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white text-xs placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-3">
            <button
              onClick={onClose}
              disabled={submitting}
              className="flex-1 py-2 bg-slate-955 border border-slate-800 hover:bg-slate-800/80 text-slate-300 hover:text-white rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={submitting}
              className="flex-1 py-2 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-blue-950/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
