import React, { useEffect } from 'react';
import { XCircle, CheckCircle } from 'lucide-react';

interface SaleStatusModalProps {
  isOpen: boolean;
  fileName: string;
  onConfirm: (status: 'SOLD' | 'UNSOLD') => void;
  onClose: () => void;
}

export const SaleStatusModal: React.FC<SaleStatusModalProps> = ({
  isOpen,
  fileName,
  onConfirm,
  onClose
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-60 flex items-center justify-center px-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-full max-w-sm shadow-2xl relative text-center space-y-6">
        <div>
          <h3 className="text-lg font-bold text-white mb-2">Sale Status</h3>
          <p className="text-xs text-slate-400">
            Is this sale for <span className="font-semibold text-white">"{fileName}"</span> Sold or Unsold?
          </p>
        </div>
        
        <div className="flex gap-3 justify-center max-w-[280px] mx-auto">
          <button
            onClick={() => onConfirm('UNSOLD')}
            className="flex-1 py-2.5 px-3.5 bg-slate-955 border border-slate-800 hover:border-rose-950/40 hover:bg-rose-950/10 text-slate-300 hover:text-rose-400 font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <XCircle className="h-3.5 w-3.5 stroke-2 shrink-0" />
            <span>Unsold</span>
          </button>
          <button
            onClick={() => onConfirm('SOLD')}
            className="flex-1 py-2.5 px-3.5 bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-emerald-950/20 cursor-pointer"
          >
            <CheckCircle className="h-3.5 w-3.5 stroke-2 shrink-0" />
            <span>Sold</span>
          </button>
        </div>
      </div>
    </div>
  );
};
