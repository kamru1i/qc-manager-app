import React from 'react';

interface BranchSelectorProps {
  value: string;
  onChange: (val: string) => void;
  required?: boolean;
}

export const BranchSelector: React.FC<BranchSelectorProps> = ({
  value,
  onChange,
  required = true
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

  return (
    <div className="space-y-2">
      <select
        required={required}
        value={selectValue}
        onChange={handleMainChange}
        className="block w-full px-3.5 py-2.5 bg-slate-955 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all cursor-pointer"
      >
        <option value="" className="text-slate-500">-- Select Branch --</option>
        {mainBranches.map(b => (
          <option key={b} value={b} className="bg-slate-950 text-white">
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
                : 'bg-slate-900 border-slate-850 text-slate-400 hover:text-white'
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
                : 'bg-slate-900 border-slate-855 text-slate-400 hover:text-white'
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
                : 'bg-slate-900 border-slate-850 text-slate-400 hover:text-white'
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
                : 'bg-slate-900 border-slate-855 text-slate-400 hover:text-white'
            }`}
          >
            + Compare
          </button>
        </div>
      )}
    </div>
  );
};
