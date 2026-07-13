import React from 'react';
import { Check } from 'lucide-react';
import { FileType } from '@/types';

interface CategoryCheckboxListProps {
  allowedTypes: string[];
  onChange: (types: string[]) => void;
  label?: string;
  disabled?: boolean;
}

const ALL_FILE_TYPES: FileType[] = [
  'Quote',
  'Individual Review',
  'Requote',
  'Review',
  'Requote Van',
  'Requote Bike',
  'Van',
  'Bike',
  'Other Site',
  'Sale'
];

const getCategoryCheckboxStyle = (type: FileType, isChecked: boolean) => {
  if (!isChecked) {
    return 'border-theme-border-active bg-theme-card-bg text-transparent';
  }
  switch (type) {
    case 'Sale':
      return 'bg-emerald-600 border-emerald-500 text-white';
    case 'Quote':
      return 'bg-blue-600 border-blue-500 text-white';
    case 'Requote':
      return 'bg-purple-500 border-purple-400 text-white';
    case 'Requote Van':
      return 'bg-purple-600 border-purple-500 text-white';
    case 'Requote Bike':
      return 'bg-blue-500 border-blue-400 text-white';
    case 'Review':
      return 'bg-pink-500 border-pink-400 text-theme-text-primary';
    case 'Review Van':
      return 'bg-pink-600 border-pink-500 text-theme-text-primary';
    case 'Review Bike':
      return 'bg-rose-500 border-rose-400 text-white';
    case 'Individual Review':
      return 'bg-rose-600 border-rose-500 text-white';
    case 'Other Site':
      return 'bg-purple-600 border-purple-500 text-white';
    case 'Van':
      return 'bg-indigo-600 border-indigo-500 text-white';
    case 'Bike':
      return 'bg-teal-600 border-teal-500 text-white';
    default:
      return 'bg-blue-600 border-blue-500 text-white';
  }
};

export const CategoryCheckboxList: React.FC<CategoryCheckboxListProps> = ({
  allowedTypes,
  onChange,
  label = 'Permitted File Entry Types (Categories)',
  disabled = false
}) => {
  const isAllSelected = ALL_FILE_TYPES.every(type => allowedTypes.includes(type));

  const handleToggleCategory = (type: string) => {
    if (disabled) return;
    const nextTypes = allowedTypes.includes(type)
      ? allowedTypes.filter((t) => t !== type)
      : [...allowedTypes, type];
    onChange(nextTypes);
  };

  const handleToggleAll = () => {
    if (disabled) return;
    if (isAllSelected) {
      onChange(allowedTypes.filter(t => !ALL_FILE_TYPES.includes(t as any)));
    } else {
      const otherTypes = allowedTypes.filter(t => !ALL_FILE_TYPES.includes(t as any));
      onChange([...otherTypes, ...ALL_FILE_TYPES]);
    }
  };

  return (
    <div className="space-y-2 border-t border-theme-border-input/80 pt-3">
      <div className="flex items-center justify-between">
        <label className="block text-[11px] font-semibold text-theme-text-secondary">
          {label}
        </label>
        {!disabled && (
          <button
            type="button"
            onClick={handleToggleAll}
            className="text-[10px] text-blue-500 hover:text-blue-400 font-semibold transition-colors cursor-pointer"
          >
            {isAllSelected ? 'Unselect All' : 'Select All'}
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
        {ALL_FILE_TYPES.map((type) => {
          const isChecked = allowedTypes.includes(type);
          return (
            <label
              key={type}
              onClick={() => handleToggleCategory(type)}
              className={`flex items-center justify-between px-3 py-1.5 rounded-lg border border-theme-border-input bg-theme-page-bg/50 text-[10px] font-semibold text-theme-text-muted select-none transition-all duration-200 ${
                disabled 
                  ? 'opacity-70 pointer-events-none' 
                  : 'hover:text-theme-text-primary cursor-pointer hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              <span className="truncate mr-1">{type}</span>
              <span className={`h-4 w-4 rounded-full flex items-center justify-center border transition-all shrink-0 ${
                getCategoryCheckboxStyle(type, isChecked)
              }`}>
                {isChecked && <Check className="h-2.5 w-2.5" />}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
};
