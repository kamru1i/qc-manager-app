import React from 'react';

interface AdminViewToggleProps {
  viewMode: 'all' | 'mine';
  onChange: (mode: 'all' | 'mine') => void;
}

export const AdminViewToggle: React.FC<AdminViewToggleProps> = ({ viewMode, onChange }) => {
  return (
    <div className="flex bg-slate-955 border border-slate-800 p-0.5 rounded-lg text-xs font-semibold self-start sm:self-auto shrink-0">
      <button
        onClick={() => onChange('mine')}
        className={`px-3 py-1 rounded-md transition-all duration-200 cursor-pointer hover:scale-[1.03] active:scale-[0.97] ${
          viewMode === 'mine'
            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-950/10'
            : 'text-slate-455 hover:text-white hover:bg-slate-900/30'
        }`}
      >
        My Data
      </button>
      <button
        onClick={() => onChange('all')}
        className={`px-3 py-1 rounded-md transition-all duration-200 cursor-pointer hover:scale-[1.03] active:scale-[0.97] ${
          viewMode === 'all'
            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-950/10'
            : 'text-slate-455 hover:text-white hover:bg-slate-900/30'
        }`}
      >
        All Data
      </button>
    </div>
  );
};
