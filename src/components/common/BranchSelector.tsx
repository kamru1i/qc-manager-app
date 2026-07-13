import React from 'react';

interface BranchSelectorProps {
  value: string;
  onChange: (val: string) => void;
  required?: boolean;
  size?: 'sm' | 'md';
}

export const BranchSelector: React.FC<BranchSelectorProps> = ({
  value,
  onChange,
  required = true,
  size = 'md'
}) => {
  // The select element value is 'PRIDE' for 'PRIDE COMPARE' and 'EAZY' for 'EAZY COMPARE' to keep the option select consistent
  const selectValue = value === 'PRIDE COMPARE' ? 'PRIDE' : (value === 'EAZY COMPARE' ? 'EAZY' : value);

  const mainBranches = [
    'ADI',
    'RIDE',
    'PRIDE',
    'AQ',
    'BC',
    'GET',
    'SORT',
    'BRISTOL',
    'MK',
    'BI',
    'EAZY',
    'NOTTS',
    'SHEFFIELD',
    'NN',
    'MIDDLESURE',
    'IRESURE',
    'SWANDRIVE'
  ];

  const handleMainChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    onChange(val);
  };

  const selectClass = size === 'sm'
    ? "block w-full h-[34px] px-3 bg-theme-page-bg border border-theme-border-input rounded-lg text-theme-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
    : "block w-full h-[42px] px-3.5 bg-theme-page-bg border border-theme-border-input rounded-xl text-theme-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer";

  return (
    <div className="space-y-2">
      <select
        required={required}
        value={selectValue}
        onChange={handleMainChange}
        className={selectClass}
      >
        <option value="" className="text-theme-text-muted/60">-- Select Branch --</option>
        {mainBranches.map(b => (
          <option key={b} value={b} className="bg-theme-card-container text-theme-text-primary">
            {b}
          </option>
        ))}
      </select>

      {/* Suboptions for PRIDE */}
      {selectValue === 'PRIDE' && (
        <div className="flex gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
          <button
            type="button"
            onClick={() => onChange('PRIDE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              value === 'PRIDE'
                ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                : 'bg-theme-card-bg border-theme-border-muted text-theme-text-muted hover:text-theme-text-primary'
            }`}
          >
            Only PRIDE
          </button>
          <button
            type="button"
            onClick={() => onChange('PRIDE COMPARE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              value === 'PRIDE COMPARE'
                ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                : 'bg-theme-card-bg border-theme-border-muted text-theme-text-muted hover:text-theme-text-primary'
            }`}
          >
            + Compare
          </button>
        </div>
      )}

      {/* Suboptions for EAZY */}
      {selectValue === 'EAZY' && (
        <div className="flex gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
          <button
            type="button"
            onClick={() => onChange('EAZY')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              value === 'EAZY'
                ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                : 'bg-theme-card-bg border-theme-border-muted text-theme-text-muted hover:text-theme-text-primary'
            }`}
          >
            Only EAZY
          </button>
          <button
            type="button"
            onClick={() => onChange('EAZY COMPARE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              value === 'EAZY COMPARE'
                ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                : 'bg-theme-card-bg border-theme-border-muted text-theme-text-muted hover:text-theme-text-primary'
            }`}
          >
            + Compare
          </button>
        </div>
      )}
    </div>
  );
};
