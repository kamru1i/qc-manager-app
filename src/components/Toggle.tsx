import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (val: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label, disabled = false }) => {
  return (
    <label className={`relative inline-flex items-center select-none gap-2 ${disabled ? 'opacity-70 pointer-events-none' : ''}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none cursor-pointer ${
          checked ? 'bg-blue-600' : 'bg-slate-800'
        }`}
      >
        <span
          className={`pointer-events-none absolute top-[2px] left-[2px] inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ease-in-out ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
      {label && <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</span>}
    </label>
  );
};
