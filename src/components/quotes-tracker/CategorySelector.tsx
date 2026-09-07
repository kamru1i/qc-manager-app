import React from 'react';
import { Check } from 'lucide-react';
import { FileType } from '@/types';

interface CategorySelectorProps {
  selectedType: FileType;
  setSelectedType: (val: FileType) => void;
  allowedCategories: string[];
}

export const CategorySelector: React.FC<CategorySelectorProps> = ({
  selectedType,
  setSelectedType,
  allowedCategories
}) => {
  const isRequoteActive = selectedType === 'Requote';
  const isReviewActive = selectedType === 'Review';

  const isRequoteAllowed =
    allowedCategories.includes('Requote') ||
    allowedCategories.includes('Requote Van') ||
    allowedCategories.includes('Requote Bike');

  const isReviewAllowed = allowedCategories.includes('Review');

  const handleRequoteClick = () => {
    setSelectedType('Requote');
  };

  const handleReviewClick = () => {
    setSelectedType('Review');
  };

  const mainCategories = [
    { id: 'Quote', label: 'Quote', allowed: allowedCategories.includes('Quote'), active: selectedType === 'Quote', onClick: () => setSelectedType('Quote') },
    { id: 'Individual Review', label: 'Individual Review', allowed: allowedCategories.includes('Individual Review'), active: selectedType === 'Individual Review', onClick: () => setSelectedType('Individual Review') },
    { id: 'Requote', label: 'Requote', allowed: isRequoteAllowed, active: isRequoteActive, onClick: handleRequoteClick },
    { id: 'Review', label: 'Review', allowed: isReviewAllowed, active: isReviewActive, onClick: handleReviewClick },
    { id: 'Van', label: 'Van', allowed: allowedCategories.includes('Van'), active: selectedType === 'Van', onClick: () => setSelectedType('Van') },
    { id: 'Bike', label: 'Bike', allowed: allowedCategories.includes('Bike'), active: selectedType === 'Bike', onClick: () => setSelectedType('Bike') },
    { id: 'Other Site', label: 'Other Site', allowed: allowedCategories.includes('Other Site'), active: selectedType === 'Other Site', onClick: () => setSelectedType('Other Site') },
    { id: 'Sale', label: 'Sale', allowed: allowedCategories.includes('Sale'), active: selectedType === 'Sale', onClick: () => setSelectedType('Sale') },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {mainCategories
        .filter((cat) => cat.allowed)
        .map((cat) => (
          <div
            key={cat.id}
            onClick={cat.onClick}
            className={`flex flex-col justify-center px-2 py-2 rounded-xl border text-[11px] sm:text-xs font-semibold transition-all duration-200 cursor-pointer hover:scale-[1.03] active:scale-[0.97] select-none ${
              cat.active
                ? 'bg-blue-600/15 border-blue-500 text-blue-400 shadow-lg shadow-blue-900/10'
                : 'bg-theme-page-bg/30 border-theme-border-input hover:border-theme-border-active text-theme-text-muted hover:text-theme-text-primary'
            }`}
          >
            <div className="flex items-center justify-between w-full gap-1">
              <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                {cat.label}
              </span>
              <span className={`h-4.5 w-4.5 rounded-full flex items-center justify-center border transition-all shrink-0 ${
                cat.active
                  ? 'bg-blue-500 border-blue-500 text-white'
                  : 'border-theme-border-active bg-theme-card-bg'
              }`}>
                {cat.active && <Check className="h-3 w-3" />}
              </span>
            </div>
          </div>
        ))
      }
    </div>
  );
};
