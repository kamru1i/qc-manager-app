'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Profile, RecordItem } from '@/types';
import { supabase } from '@/utils/supabase';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { StatsGrid } from '@/components/StatsGrid';
import { RecordsTable } from '@/components/RecordsTable';
import { calculateSummaryStats } from '@/utils/quotesDashboardHelpers';

interface UserQuotesHistoryPanelProps {
  viewingStaff: Profile;
}

export const UserQuotesHistoryPanel: React.FC<UserQuotesHistoryPanelProps> = ({ viewingStaff }) => {
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => String(new Date().getMonth() + 1).padStart(2, '0'));
  const [selectedYear, setSelectedYear] = useState<string>(() => new Date().getFullYear().toString());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('records')
        .select('*')
        .eq('user_id', viewingStaff.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRecords((data as RecordItem[]) || []);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load quotes history.');
    } finally {
      setLoading(false);
    }
  }, [viewingStaff.id]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Unique branches computed from user's records
  const uniqueBranches = useMemo(() => {
    const branches = new Set<string>();
    records.forEach((r) => {
      if (r.branch_name) {
        branches.add(r.branch_name.toUpperCase().trim());
      }
    });
    return Array.from(branches).sort();
  }, [records]);

  // Months and Years
  const availableMonths = [
    { value: '01', name: 'January' },
    { value: '02', name: 'February' },
    { value: '03', name: 'March' },
    { value: '04', name: 'April' },
    { value: '05', name: 'May' },
    { value: '06', name: 'June' },
    { value: '07', name: 'July' },
    { value: '08', name: 'August' },
    { value: '09', name: 'September' },
    { value: '10', name: 'October' },
    { value: '11', name: 'November' },
    { value: '12', name: 'December' },
  ];

  const availableYears = useMemo(() => {
    const years = new Set([new Date().getFullYear().toString()]);
    records.forEach(r => {
      if (r.submitted_at) {
        years.add(new Date(r.submitted_at).getFullYear().toString());
      }
    });
    return Array.from(years).sort().reverse();
  }, [records]);

  // Filtered records for selected Month and Year
  const monthlyFilteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (!r.submitted_at) return false;
      const dateObj = new Date(r.submitted_at);
      const y = dateObj.getFullYear().toString();
      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
      
      if (y !== selectedYear || m !== selectedMonth) return false;

      if (selectedBranch && r.branch_name.toUpperCase().trim() !== selectedBranch.toUpperCase().trim()) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchedFileType = [
          'Quote', 'Requote', 'Requote Van', 'Requote Bike', 'Review', 'Individual Review', 'Other Site', 'Van', 'Bike', 'Sale'
        ].find(ft => ft.toLowerCase() === q);

        if (matchedFileType) {
          if (r.file_type !== matchedFileType) return false;
        } else {
          const matchFileName = (r.file_name || '').toLowerCase().includes(q);
          const matchCodename = (r.codename || '').toLowerCase().includes(q);
          if (!matchFileName && !matchCodename) return false;
        }
      }
      return true;
    });
  }, [records, selectedMonth, selectedYear, selectedBranch, searchQuery]);

  // Stats summary grid
  const monthlyStats = useMemo(() => {
    return calculateSummaryStats(monthlyFilteredRecords);
  }, [monthlyFilteredRecords]);

  // Handle inline modification and delete directly if needed
  const handleToggleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this file record?')) return;
    try {
      const { error } = await supabase.from('records').delete().eq('id', id);
      if (error) throw error;
      toast.success('Record deleted successfully.');
      fetchRecords();
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete record.');
    }
  };

  const handleSaveInline = async (id: string, updates: Partial<RecordItem>) => {
    try {
      const { error } = await supabase.from('records').update(updates).eq('id', id);
      if (error) throw error;
      toast.success('Record updated.');
      fetchRecords();
      return true;
    } catch (e) {
      console.error(e);
      toast.error('Failed to update record.');
      return false;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 bg-slate-900/10 border border-slate-850/50 rounded-2xl">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="mt-2 text-xs text-slate-400 font-medium">Loading quotes history...</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/40 backdrop-blur-xl border border-slate-850 shadow-2xl rounded-2xl p-6 space-y-6">
      {/* Filters bar */}
      <div className="bg-slate-955/45 p-4 rounded-xl border border-slate-850 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Month Selector */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-xs px-2.5 py-1.5 focus:outline-none cursor-pointer"
          >
            {availableMonths.map(m => (
              <option key={m.value} value={m.value}>{m.name}</option>
            ))}
          </select>

          {/* Year Selector */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-xs px-2.5 py-1.5 focus:outline-none cursor-pointer"
          >
            {availableYears.map(yr => (
              <option key={yr} value={yr}>{yr}</option>
            ))}
          </select>

          {/* Branch Filter */}
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-xs px-2.5 py-1.5 focus:outline-none cursor-pointer"
          >
            <option value="">All Branches</option>
            {uniqueBranches.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <input
            type="text"
            placeholder="Search by file name or codename..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none text-xs"
          />
        </div>
      </div>

      {/* Stats summary grid */}
      <StatsGrid stats={monthlyStats} isLoading={loading} />

      {/* Records Table */}
      <div className="border border-slate-850 rounded-xl overflow-hidden bg-slate-950/20">
        <RecordsTable
          records={monthlyFilteredRecords}
          emptyMessage="No file records found matching the filters."
          showDate={true}
          onEdit={() => {}}
          onDelete={handleToggleDelete}
          isLoading={loading}
          currentUserId={viewingStaff.id}
          isAdmin={true}
          onSaveInline={handleSaveInline}
          allowedCategories={viewingStaff.allowed_types || []}
          submitting={submitting}
        />
      </div>
    </div>
  );
};
