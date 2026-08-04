import { TimeInput } from '@/components/common/TimeInput';
import { CustomSelect } from '@/components/common/CustomSelect';
import { formatTimeToAMPM } from '@/utils/dashboardHelpers';
import { WORKING_HOURS_OPTIONS } from '@/utils/workingHours';

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
    ...WORKING_HOURS_OPTIONS,
  ];

  return (
    <>
      <div>
        <label className="block text-xs font-medium text-theme-text-muted uppercase tracking-wider">
          Full Name
        </label>
        <input
          type="text"
          required
          placeholder="e.g., Kamrul Islam"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          disabled={disabled}
          className="mt-1 block w-full px-3 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-theme-text-muted uppercase tracking-wider">
          Job Role
        </label>
        <input
          type="text"
          required
          placeholder="e.g., IT Officer"
          value={jobRole}
          onChange={(e) => setJobRole(e.target.value)}
          disabled={disabled}
          className="mt-1 block w-full px-3 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-theme-text-muted uppercase tracking-wider">
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
          <label className="block text-xs font-medium text-theme-text-muted uppercase tracking-wider">
            Break (Minutes)
          </label>
          <input
            type="number"
            required
            min="0"
            value={breakTime}
            onChange={(e) => setBreakTime(e.target.value)}
            disabled={disabled}
            className="mt-1 block w-full px-3 py-2 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <TimeInput
          label="Sign-In"
          required
          disabled={disabled}
          value={signInTime}
          onChange={setSignInTime}
        />
        <TimeInput
          label="Sign-Out"
          required
          disabled={disabled}
          value={signOutTime}
          onChange={setSignOutTime}
        />
      </div>
    </>
  );
};
