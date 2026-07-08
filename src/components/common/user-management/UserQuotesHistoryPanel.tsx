'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Profile, RecordItem, FileType } from '@/types';
import { supabase } from '@/utils/supabase';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { StatsGrid } from '@/components/common/StatsGrid';
import { RecordsTable } from '@/components/quotes-tracker/RecordsTable';
import { calculateSummaryStats } from '@/utils/quotesDashboardHelpers';
import { EditRecordModal } from '@/components/quotes-tracker/modals/EditRecordModal';

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
 
  const [editingRecord, setEditingRecord] = useState<RecordItem | null>(null);
  const [editFileName, setEditFileName] = useState('');
  const [editBranchName, setEditBranchName] = useState('');
  const [editCodename, setEditCodename] = useState('');
  const [editFileType, setEditFileType] = useState<FileType>('Quote');
  const [editCanChangeSubmittedAt, setEditCanChangeSubmittedAt] = useState(false);
  const [editSubmittedDate, setEditSubmittedDate] = useState('');
  const [editSubmittedTime, setEditSubmittedTime] = useState('');
  const [editSaleStatus, setEditSaleStatus] = useState<'SOLD' | 'UNSOLD'>('SOLD');

  const [globalOtherSiteCount, setGlobalOtherSiteCount] = useState<number>(0);

  useEffect(() => {
    const fetchGlobalOtherSiteCount = async () => {
      try {
        const yearInt = parseInt(selectedYear);
        const monthInt = parseInt(selectedMonth);
        const nextMonth = monthInt === 12 ? 1 : monthInt + 1;
        const nextYear = monthInt === 12 ? yearInt + 1 : yearInt;
        
        const startISO = new Date(yearInt, monthInt - 1, 1, 0, 0, 0, 0).toISOString();
        const endISO = new Date(nextYear, nextMonth - 1, 1, 0, 0, 0, 0).toISOString();

        let query = supabase
          .from('records')
          .select('id', { count: 'exact', head: true })
          .eq('file_type', 'Other Site')
          .gte('submitted_at', startISO)
          .lt('submitted_at', endISO);

        if (selectedBranch) {
          query = query.eq('branch_name', selectedBranch);
        }

        const { count, error } = await query;
        if (error) throw error;
        setGlobalOtherSiteCount(count || 0);
      } catch (err) {
        console.error("Error fetching global other site count:", err);
      }
    };

    fetchGlobalOtherSiteCount();
  }, [selectedMonth, selectedYear, selectedBranch]);

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
    const stats = calculateSummaryStats(monthlyFilteredRecords);
    return {
      ...stats,
      datasetOtherSiteTotal: globalOtherSiteCount
    };
  }, [monthlyFilteredRecords, globalOtherSiteCount]);

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

  const handleSaveInline = async (id: string, updates: Partial<RecordItem>): Promise<boolean> => {
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

  const handleOpenEditRecord = (record: RecordItem, canChangeSubmittedAt = true) => {
    const submittedAt = new Date(record.submitted_at);

    setEditingRecord(record);
    const cleanName = record.file_name.replace(/ \[(SOLD|UNSOLD)\]$/, '');
    setEditFileName(cleanName);
    setEditBranchName(record.branch_name);
    setEditCodename(record.codename);
    setEditFileType(record.file_type);
    setEditCanChangeSubmittedAt(canChangeSubmittedAt);

    if (record.file_name.endsWith(" [UNSOLD]")) {
      setEditSaleStatus("UNSOLD");
    } else {
      setEditSaleStatus("SOLD");
    }

    if (!isNaN(submittedAt.getTime())) {
      setEditSubmittedDate(
        `${String(submittedAt.getDate()).padStart(2, "0")}-${String(
          submittedAt.getMonth() + 1,
        ).padStart(2, "0")}-${submittedAt.getFullYear()}`,
      );
      const hour24 = submittedAt.getHours();
      const hour12 = hour24 % 12 || 12;
      const meridiem = hour24 >= 12 ? "PM" : "AM";
      setEditSubmittedTime(
        `${String(hour12).padStart(2, "0")}:${String(
          submittedAt.getMinutes(),
        ).padStart(2, "0")} ${meridiem}`,
      );
    } else {
      setEditSubmittedDate("");
      setEditSubmittedTime("");
    }
  };

  const handleSaveEdit = async () => {
    if (!editingRecord) return;

    if (!editFileName.trim()) {
      toast.error("File name cannot be empty.");
      return;
    }
    if (!editBranchName.trim()) {
      toast.error("Branch name cannot be empty.");
      return;
    }
    if (!editCodename.trim()) {
      toast.error("Codename cannot be empty.");
      return;
    }

    let editedSubmittedAt: string | undefined;

    if (editCanChangeSubmittedAt) {
      const [dayText, monthText, yearText] = editSubmittedDate.split("-");
      const day = Number(dayText);
      const month = Number(monthText);
      const year = Number(yearText);
      const parsedDate = new Date(year, month - 1, day);

      if (
        !dayText ||
        !monthText ||
        !yearText ||
        dayText.length !== 2 ||
        monthText.length !== 2 ||
        yearText.length !== 4 ||
        isNaN(parsedDate.getTime()) ||
        parsedDate.getFullYear() !== year ||
        parsedDate.getMonth() !== month - 1 ||
        parsedDate.getDate() !== day
      ) {
        toast.error("Please enter the date as DD-MM-YYYY.");
        return;
      }

      const timeMatch = editSubmittedTime
        .trim()
        .match(/^(0[1-9]|1[0-2]):([0-5]\d)\s?(AM|PM)$/i);

      if (!timeMatch) {
        toast.error("Please enter the time as 09:21 PM/AM.");
        return;
      }

      let hours = Number(timeMatch[1]);
      const minutes = Number(timeMatch[2]);
      const meridiem = timeMatch[3].toUpperCase();

      if (meridiem === "PM" && hours !== 12) hours += 12;
      if (meridiem === "AM" && hours === 12) hours = 0;

      parsedDate.setHours(hours, minutes, 0, 0);
      editedSubmittedAt = parsedDate.toISOString();
    }

    const finalFileName = editFileType === "Sale" ? `${editFileName} [${editSaleStatus}]` : editFileName;

    setSubmitting(true);
    try {
      const updates: Partial<RecordItem> = {
        file_name: finalFileName,
        branch_name: editBranchName,
        codename: editCodename,
        file_type: editFileType,
      };
      if (editedSubmittedAt) {
        updates.submitted_at = editedSubmittedAt;
      }
      
      const { error } = await supabase.from('records').update(updates).eq('id', editingRecord.id);
      if (error) throw error;

      toast.success('Record updated successfully.');
      setEditingRecord(null);
      fetchRecords();
    } catch (e) {
      console.error(e);
      toast.error('Failed to update record.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkDelete = async (ids: string[]) => {
    if (!confirm(`Are you sure you want to permanently delete these ${ids.length} selected file records?`)) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('records').delete().in('id', ids);
      if (error) throw error;
      toast.success('Records deleted successfully.');
      fetchRecords();
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete records.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkSaveInline = async (updatesMap: Record<string, Partial<RecordItem>>): Promise<boolean> => {
    setSubmitting(true);
    try {
      const promises = Object.entries(updatesMap).map(async ([id, updates]) => {
        const { error } = await supabase.from('records').update(updates).eq('id', id);
        if (error) throw error;
      });

      await Promise.all(promises);
      toast.success('Records updated successfully.');
      fetchRecords();
      return true;
    } catch (e) {
      console.error(e);
      toast.error('Failed to save bulk updates.');
      return false;
    } finally {
      setSubmitting(false);
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
          onEdit={handleOpenEditRecord}
          onDelete={handleToggleDelete}
          isLoading={loading}
          currentUserId={viewingStaff.id}
          isAdmin={true}
          onBulkDelete={handleBulkDelete}
          onSaveInline={handleSaveInline}
          onBulkSaveInline={handleBulkSaveInline}
          allowedCategories={viewingStaff.allowed_types || []}
          submitting={submitting}
        />
      </div>

      {editingRecord && (
        <EditRecordModal
          editFileName={editFileName}
          setEditFileName={setEditFileName}
          editBranchName={editBranchName}
          setEditBranchName={setEditBranchName}
          editCodename={editCodename}
          setEditCodename={setEditCodename}
          editFileType={editFileType}
          setEditFileType={setEditFileType}
          canEditSubmittedAt={editCanChangeSubmittedAt}
          editSubmittedDate={editSubmittedDate}
          setEditSubmittedDate={setEditSubmittedDate}
          editSubmittedTime={editSubmittedTime}
          setEditSubmittedTime={setEditSubmittedTime}
          allowedCategories={viewingStaff.allowed_types || []}
          onClose={() => setEditingRecord(null)}
          onSave={handleSaveEdit}
          editSaleStatus={editSaleStatus}
          setEditSaleStatus={setEditSaleStatus}
          submitting={submitting}
        />
      )}
    </div>
  );
};
