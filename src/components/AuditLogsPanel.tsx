import React, { useState, useMemo } from 'react';
import { AuditLogItem } from '@/types';
import { 
  ScrollText, 
  Search, 
  Clock, 
  User, 
  ShieldAlert, 
  RefreshCw,
  X
} from 'lucide-react';

interface AuditLogsPanelProps {
  logs: AuditLogItem[];
  isLoading: boolean;
  onRefresh: () => void;
}

export const AuditLogsPanel: React.FC<AuditLogsPanelProps> = ({
  logs,
  isLoading,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActionGroup, setSelectedActionGroup] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Filter logs based on search and action group
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // 1. Search Query
      if (searchQuery) {
        const q = searchQuery.toLowerCase().trim();
        const actorMatch = log.actor_codename.toLowerCase().includes(q);
        const detailsMatch = log.details.toLowerCase().includes(q);
        const typeMatch = log.action_type.toLowerCase().includes(q);
        if (!actorMatch && !detailsMatch && !typeMatch) {
          return false;
        }
      }

      // 2. Action Category Selector
      if (selectedActionGroup !== 'all') {
        const type = log.action_type;
        if (selectedActionGroup === 'records') {
          return type === 'CREATE_RECORD' || type === 'UPDATE_RECORD' || type === 'DELETE_RECORD';
        }
        if (selectedActionGroup === 'users') {
          return type === 'CREATE_USER' || type === 'UPDATE_USER' || type === 'DELETE_USER';
        }
        if (selectedActionGroup === 'security') {
          return type === 'RESET_PASSWORD' || type === 'ONBOARD_USER';
        }
      }
      return true;
    });
  }, [logs, searchQuery, selectedActionGroup]);

  // Reset pagination when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedActionGroup]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / itemsPerPage));
  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredLogs, currentPage]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const getActionBadge = (type: string) => {
    switch (type) {
      case 'CREATE_RECORD':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-450 dark:text-emerald-400">
            Create Record
          </span>
        );
      case 'UPDATE_RECORD':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 border border-purple-500/20 text-purple-450 dark:text-purple-400">
            Update Record
          </span>
        );
      case 'DELETE_RECORD':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 border border-rose-500/20 text-rose-450 dark:text-rose-400">
            Delete Record
          </span>
        );
      case 'CREATE_USER':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 border border-blue-500/20 text-blue-455 dark:text-blue-400">
            Create User
          </span>
        );
      case 'UPDATE_USER':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 border border-sky-500/20 text-sky-455 dark:text-sky-400">
            Update User
          </span>
        );
      case 'DELETE_USER':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 border border-rose-500/20 text-rose-450 dark:text-rose-400">
            Delete User
          </span>
        );
      case 'RESET_PASSWORD':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 border border-purple-500/20 text-purple-450 dark:text-purple-400">
            Password Reset
          </span>
        );
      case 'ONBOARD_USER':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/10 border border-teal-500/20 text-teal-450 dark:text-teal-400">
            User Onboarded
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/10 border border-slate-500/20 text-slate-450">
            {type}
          </span>
        );
    }
  };

  const formatLogTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '-';
      
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      
      const hours24 = date.getHours();
      const hours12 = hours24 % 12 || 12;
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const ampm = hours24 >= 12 ? 'PM' : 'AM';
      
      return `${day}-${month}-${year} ${String(hours12).padStart(2, '0')}:${minutes} ${ampm}`;
    } catch {
      return '-';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/20 p-4 border border-slate-800/40 rounded-2xl backdrop-blur-md">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-blue-500" />
            System Audit Log Panel
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 font-medium">Review administrative actions and user record modifications with exact timestamps.</p>
        </div>

        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-xs font-semibold text-slate-350 hover:text-white transition-all cursor-pointer shadow-md disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Logs</span>
        </button>
      </div>

      {/* Filter Row */}
      <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-850 grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
        {/* Search */}
        <div className="md:col-span-8">
          <label className="block text-[11px] font-semibold text-slate-350 mb-1">Search Logs</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Search by actor codename, description details, or action type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-8 pr-8 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs h-9"
            />
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-555" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 flex items-center justify-center p-0.5 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Action Category Filter */}
        <div className="md:col-span-4">
          <label className="block text-[11px] font-semibold text-slate-350 mb-1">Category Filter</label>
          <select
            value={selectedActionGroup}
            onChange={(e) => setSelectedActionGroup(e.target.value)}
            className="block w-full px-3 py-2 bg-slate-955 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer h-9"
          >
            <option value="all">All Logs & Activities</option>
            <option value="records">Record Modifications (Add/Edit/Delete)</option>
            <option value="users">User Account Changes (Add/Update/Delete)</option>
            <option value="security">Security & Onboarding (Passwords/Onboard)</option>
          </select>
        </div>
      </div>

      {/* Main logs list table */}
      <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-850 space-y-4 overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-slate-955 border-b border-slate-850 text-slate-400 font-semibold uppercase">
              <th className="px-4 py-3 w-48">Timestamp</th>
              <th className="px-4 py-3 w-32">Actor</th>
              <th className="px-4 py-3 w-40">Action Type</th>
              <th className="px-4 py-3">Description Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-850 text-slate-355">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx} className="hover:bg-slate-900/10 border-b border-slate-850/40">
                  <td className="px-4 py-3.5"><div className="h-4 w-36 bg-slate-800 rounded animate-pulse" /></td>
                  <td className="px-4 py-3.5"><div className="h-4 w-16 bg-slate-800 rounded animate-pulse" /></td>
                  <td className="px-4 py-3.5"><div className="h-5 w-24 bg-slate-800/80 rounded-full animate-pulse" /></td>
                  <td className="px-4 py-3.5"><div className="h-4 w-96 bg-slate-800 rounded animate-pulse" /></td>
                </tr>
              ))
            ) : paginatedLogs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-slate-500">
                  <ShieldAlert className="h-10 w-10 text-slate-650 stroke-[1.5] mx-auto mb-2.5" />
                  <p className="font-medium text-xs">No matching system audit logs found.</p>
                </td>
              </tr>
            ) : (
              paginatedLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-900/20 transition-all">
                  <td className="px-4 py-3 font-semibold text-slate-400 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-slate-500" />
                    {formatLogTime(log.created_at)}
                  </td>
                  <td className="px-4 py-3 font-bold text-white">
                    <span className="inline-flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-slate-500" />
                      {log.actor_codename}
                    </span>
                  </td>
                  <td className="px-4 py-3">{getActionBadge(log.action_type)}</td>
                  <td className="px-4 py-3 font-medium text-slate-350 text-xs max-w-lg whitespace-pre-wrap break-words">{log.details}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination Controls */}
        {!isLoading && totalPages > 1 && (
          <div className="flex justify-between items-center pt-4 border-t border-slate-850/40 text-xs">
            <span className="text-slate-450 font-medium">
              Showing <strong className="text-white">{((currentPage - 1) * itemsPerPage) + 1}</strong> to{' '}
              <strong className="text-white">{Math.min(currentPage * itemsPerPage, filteredLogs.length)}</strong> of{' '}
              <strong className="text-white">{filteredLogs.length}</strong> logs
            </span>

            <div className="flex items-center bg-slate-950/40 border border-slate-850 p-1 rounded-xl gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
                className="px-2.5 py-1 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer font-bold"
              >
                Previous
              </button>
              
              <span className="px-2.5 py-1 text-slate-300 font-bold">
                {currentPage} / {totalPages}
              </span>

              <button
                disabled={currentPage === totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
                className="px-2.5 py-1 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer font-bold"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
