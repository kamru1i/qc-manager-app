import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchFiltersProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  onClear: () => void;
}

export const SearchFilters: React.FC<SearchFiltersProps> = ({
  searchQuery,
  setSearchQuery,
  onClear
}) => {
  return (
    <div className="bg-slate-950/30 p-4 rounded-xl border border-slate-850">
      <div className="relative">
        <input
          type="text"
          placeholder="Search by File Name, Codename, Branch, or Type (e.g. Williams James, NN, Sale, Requote Van)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="block w-full pl-10 pr-10 py-2.5 bg-slate-955 border border-slate-800 rounded-xl text-white placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
        />
        <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" />
        {searchQuery && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-3.5 top-3 flex items-center justify-center p-0.5 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-all duration-200 hover:scale-110 active:scale-90 cursor-pointer"
            title="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};
