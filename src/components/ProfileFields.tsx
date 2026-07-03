import React from 'react';
import { CustomSelect } from './CustomSelect';
import { formatTimeToAMPM } from '@/utils/dashboardHelpers';

interface ProfileFieldsProps {
  fullName: string;
  setFullName: (val: string) => void;
  jobRole: string;
  setJobRole: (val: string) => void;
  workingHours: string;
  setWorkingHours: (val: string) => void;
  breakTime: string;
  setBreakTime: (val: string) => void;
  signInTime: string;
  setSignInTime: (val: string) => void;
  signOutTime: string;
  setSignOutTime: (val: string) => void;
  disabled?: boolean;
}

export const ProfileFields: React.FC<ProfileFieldsProps> = ({
  fullName,
  setFullName,
  jobRole,
  setJobRole,
  workingHours,
  setWorkingHours,
  breakTime,
  setBreakTime,
  signInTime,
  setSignInTime,
  signOutTime,
  setSignOutTime,
  disabled = false,
}) => {
  const workingHoursOptions = [
    ...(workingHours === '' ? [{ value: '', label: 'Select Hours' }] : []),
    { value: '7.5', label: '7 Hours 30 Mins' },
    { value: '8.0', label: '8 Hours' },
    { value: '8.5', label: '8 Hours 30 Mins' },
    { value: '9.0', label: '9 Hours' },
    { value: '9.5', label: '9 Hours 30 Mins' },
    { value: '10.0', label: '10 Hours' },
  ];

  return (
    <>
      <div>
        <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">
          Full Name
        </label>
        <input
          type="text"
          required
          placeholder="e.g., Kamrul Islam"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          disabled={disabled}
          className="mt-1 block w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">
          Job Role
        </label>
        <input
          type="text"
          required
          placeholder="e.g., IT Officer"
          value={jobRole}
          onChange={(e) => setJobRole(e.target.value)}
          disabled={disabled}
          className="mt-1 block w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">
            Working Hours
          </label>
          <CustomSelect
            value={workingHours}
            onChange={setWorkingHours}
            options={workingHoursOptions}
            disabled={disabled}
            className="w-full mt-1"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">
            Break (Minutes)
          </label>
          <input
            type="number"
            required
            min="0"
            value={breakTime}
            onChange={(e) => setBreakTime(e.target.value)}
            disabled={disabled}
            className="mt-1 block w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex justify-between items-center">
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">
              Sign-In
            </label>
            {signInTime && (
              <span className="text-[10px] font-bold text-blue-450 tracking-wider">
                {formatTimeToAMPM(signInTime)}
              </span>
            )}
          </div>
          <input
            type="time"
            required
            value={signInTime}
            onChange={(e) => setSignInTime(e.target.value)}
            disabled={disabled}
            className="mt-1 block w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
        <div>
          <div className="flex justify-between items-center">
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">
              Sign-Out
            </label>
            {signOutTime && (
              <span className="text-[10px] font-bold text-blue-450 tracking-wider">
                {formatTimeToAMPM(signOutTime)}
              </span>
            )}
          </div>
          <input
            type="time"
            required
            value={signOutTime}
            onChange={(e) => setSignOutTime(e.target.value)}
            disabled={disabled}
            className="mt-1 block w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
      </div>
    </>
  );
};
