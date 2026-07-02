import React from 'react';
import { DateInput } from '@/components/DateInput';
import { CustomSelect } from './CustomSelect';
import { formatTimeToAMPM } from '@/utils/dashboardHelpers';

interface ChutiFormFieldsProps {
  date: string;
  setDate: (val: string) => void;
  leaveType: string;
  setLeaveType: (val: string) => void;
  signInTime: string;
  setSignInTime: (val: string) => void;
  signOutTime: string;
  setSignOutTime: (val: string) => void;
  leaveHour: string;
  setLeaveHour: (val: string) => void;
  adjustment: boolean;
  setAdjustment: (val: boolean) => void;
  adjustShortLeave: boolean;
  setAdjustShortLeave: (val: boolean) => void;
  comment: string;
  setComment: (val: string) => void;
  allowOvertime: boolean;
}

export const ChutiFormFields: React.FC<ChutiFormFieldsProps> = ({
  date,
  setDate,
  leaveType,
  setLeaveType,
  signInTime,
  setSignInTime,
  signOutTime,
  setSignOutTime,
  leaveHour,
  setLeaveHour,
  adjustment,
  setAdjustment,
  adjustShortLeave,
  setAdjustShortLeave,
  comment,
  setComment,
  allowOvertime,
}) => {
  const isShortOrOvertime = leaveType !== 'Full Leave';
  const showAdjustmentSection = leaveType !== 'Full Leave';

  const leaveTypeOptions = [
    { value: 'Short Leave', label: 'Short Leave' },
    { value: 'Full Leave', label: 'Full Leave' },
    ...((allowOvertime || leaveType === 'Overtime') ? [{ value: 'Overtime', label: 'Overtime' }] : []),
  ];

  return (
    <>
      <div>
        <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">
          Date
        </label>
        <div className="mt-1">
          <DateInput
            required
            value={date}
            onChange={setDate}
            className="bg-slate-955 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">
          Leave Type
        </label>
        <CustomSelect
          value={leaveType}
          onChange={setLeaveType}
          options={leaveTypeOptions}
          className="w-full mt-1"
        />
      </div>

      {isShortOrOvertime && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between items-center">
                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Start Time
                </label>
                {signInTime && (
                  <span className="text-[10px] font-bold text-orange-450 tracking-wider">
                    {formatTimeToAMPM(signInTime)}
                  </span>
                )}
              </div>
              <input
                type="time"
                required
                value={signInTime}
                onChange={(e) => setSignInTime(e.target.value)}
                className="mt-1 block w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <div className="flex justify-between items-center">
                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">
                  End Time
                </label>
                {signOutTime && (
                  <span className="text-[10px] font-bold text-orange-450 tracking-wider">
                    {formatTimeToAMPM(signOutTime)}
                  </span>
                )}
              </div>
              <input
                type="time"
                required
                value={signOutTime}
                onChange={(e) => setSignOutTime(e.target.value)}
                className="mt-1 block w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">
              {leaveType === 'Overtime' ? 'Total Overtime Duration' : 'Total Leave Duration'}
            </label>
            <input
              type="text"
              required
              placeholder="e.g., 02:30"
              value={leaveHour}
              onChange={(e) => setLeaveHour(e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-slate-955 border border-slate-850 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono"
            />
          </div>
        </>
      )}

      {showAdjustmentSection && (
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-slate-955/60 rounded-lg border border-slate-800/80">
            <div>
              <span className="block text-xs font-medium text-white font-semibold">
                Adjustment
              </span>
              <span className="block text-[10px] text-slate-400">
                If checked, this will not add to total leaves
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                const newAdj = !adjustment;
                setAdjustment(newAdj);
                if (!newAdj) {
                  setAdjustShortLeave(false);
                }
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                adjustment ? 'bg-orange-600' : 'bg-slate-800'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  adjustment ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {leaveType === 'Overtime' && adjustment && (
            <div className="flex items-center justify-between p-3 bg-slate-955/60 rounded-lg border border-slate-800/80 font-sans">
              <div>
                <span className="block text-xs font-medium text-white font-semibold">
                  Adjust with Short Leave?
                </span>
                <span className="block text-[10px] text-slate-400">
                  If checked, this will deduct from short leave balance
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAdjustShortLeave(!adjustShortLeave)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  adjustShortLeave ? 'bg-emerald-600' : 'bg-slate-800'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    adjustShortLeave ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          )}
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">
          Remarks / Reason
        </label>
        <textarea
          placeholder="Write a brief description of the leave..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="mt-1 block w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 h-20 resize-none"
        />
      </div>
    </>
  );
};
