import { User as SupabaseUser } from '@supabase/supabase-js';
import { Profile, GovtHolidayResponse } from '../types';
import { ChutiRecord } from './offlineSync';
import { calculateStats, formatTimeToAMPM, getCleanComment, formatDate, escapeHtml } from './dashboardHelpers';
import { isTauriApp } from './apiUrlHelper';
import { saveTauriFile, buildTeamWiseTablesHtml } from './exportCore';

export const exportIndividualExcel = (
    userId: string,
    recordsToExport: ChutiRecord[],
    staffProfile: Profile | null,
    sessionUser: SupabaseUser | null,
    profile: Profile | null,
    filters: {
      selectedYear?: string;
      filterType?: string;
      filterStartDate?: string;
      filterEndDate?: string;
      searchTerm?: string;
    },
    onSuccess: () => void,
    onError: (msg: string) => void
  ) => {
    const activeProfile = staffProfile || (userId === sessionUser?.id ? profile : null);
    if (recordsToExport.length === 0) {
      onError('No data found to export!');
      return;
    }

    const showOvertime = activeProfile?.allow_overtime === true;

    let headersHtml = `
      <th>Date</th>
      <th>Type</th>
      <th>Adjustment</th>
      <th>Sign In/Out</th>
      <th>Leave Hour</th>
    `;
    if (showOvertime) headersHtml += `<th>Overtime</th>`;
    headersHtml += `
      <th>Comment</th>
      <th>Status</th>
    `;

    let rowsHtml = '';
    recordsToExport.forEach(r => {
      let adjustmentVal = 'No';
      if (r.adjustment) {
        adjustmentVal = 'Yes';
      } else if (r.adjusted_hour) {
        const adjHourStr = r.adjusted_hour.toString().split('.')[0].substring(0, 5);
        adjustmentVal = `Partial (${adjHourStr})`;
      }

      const signInStr = r.leave_type === 'Full Leave' ? '-' : formatTimeToAMPM(r.sign_in_time);
      const signOutStr = r.leave_type === 'Full Leave' ? '-' : formatTimeToAMPM(r.sign_out_time);
      const leaveHourStr = r.leave_type === 'Full Leave' || r.leave_type === 'Overtime' ? '-' : (r.leave_hour ? r.leave_hour.toString().split('.')[0].substring(0, 5) : '-');

      rowsHtml += `
        <tr>
          <td style="mso-number-format:'\\@';">${escapeHtml(formatDate(r.date))}</td>
          <td>${escapeHtml(r.leave_type)}</td>
          <td>${escapeHtml(adjustmentVal)}</td>
          <td>${r.leave_type === 'Full Leave' ? '-' : escapeHtml(`${signInStr} / ${signOutStr}`)}</td>
          <td>${escapeHtml(leaveHourStr)}</td>
      `;

      if (showOvertime) {
        const overtimeStr = r.leave_type === 'Overtime' ? (r.leave_hour ? r.leave_hour.toString().split('.')[0].substring(0, 5) : '-') : '-';
        rowsHtml += `<td>${escapeHtml(overtimeStr)}</td>`;
      }



      rowsHtml += `
          <td>${escapeHtml(getCleanComment(r.comment)) || '-'}</td>
          <td>${escapeHtml(r.status)}</td>
        </tr>
      `;
    });

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"/><style>td { border: 0.5pt solid #ccc; }</style></head>
      <body>
        <h3>Detailed Leave Report: ${escapeHtml(activeProfile?.full_name)} (${escapeHtml((activeProfile?.username || '').toUpperCase())})</h3>
        <table border="1">
          <thead>
            <tr style="background-color: #4F81BD; color: white;">
              ${headersHtml}
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
      </html>
    `;

    let filename = `leave_report_${(activeProfile?.username || 'user').toUpperCase()}`;
    if (filters.selectedYear && filters.selectedYear !== 'all') {
      filename += `_year_${filters.selectedYear}`;
    }
    if (filters.filterType && filters.filterType !== 'all') {
      filename += `_type_${filters.filterType.replace(/\s+/g, '_')}`;
    }
    if (filters.filterStartDate && filters.filterEndDate) {
      filename += `_${filters.filterStartDate}_to_${filters.filterEndDate}`;
    } else if (filters.filterStartDate) {
      filename += `_from_${filters.filterStartDate}`;
    } else if (filters.filterEndDate) {
      filename += `_until_${filters.filterEndDate}`;
    }
    if (filters.searchTerm && filters.searchTerm.trim()) {
      const cleanSearch = filters.searchTerm.trim().replace(/[^a-zA-Z0-9\u0980-\u09FF_-]/g, '_');
      filename += `_search_${cleanSearch}`;
    }
    if (
      (!filters.selectedYear || filters.selectedYear === 'all') &&
      (!filters.filterType || filters.filterType === 'all') &&
      !filters.filterStartDate &&
      !filters.filterEndDate &&
      (!filters.searchTerm || !filters.searchTerm.trim())
    ) {
      filename += `_${new Date().toISOString().split('T')[0]}`;
    }
    filename += '.xls';

    if (isTauriApp()) {
      saveTauriFile(html, filename, 'Excel Files', 'xls', onSuccess, onError);
    } else {
      const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      onSuccess();
    }
  };


  // Export summary report for all staff as Excel (HTML format)
  export const exportSummaryExcel = (
    staffProfiles: Profile[],
    getUserSummaryStats: (id: string) => { full: number; short: string; overtime: string },
    filters: {
      selectedYear?: string;
      filterType?: string;
      filterStartDate?: string;
      filterEndDate?: string;
      searchQuery?: string;
    },
    onSuccess: () => void,
    onError: (msg: string) => void
  ) => {
    if (staffProfiles.length === 0) {
      onError('No data found to export!');
      return;
    }

    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"/><style>td { border: 0.5pt solid #ccc; }</style></head>
      <body>
        <h3>Staff Leave Master Database Summary</h3>
        <table border="1">
          <thead>
            <tr style="background-color: #4F81BD; color: white;">
              <th>Name</th>
              <th>Codename</th>
              <th>Full Leave</th>
              <th>Short Leave</th>
              <th>Overtime</th>
            </tr>
          </thead>
          <tbody>
    `;

    staffProfiles.forEach(p => {
      const stats = getUserSummaryStats(p.id);
      html += `
        <tr>
          <td>${escapeHtml(p.full_name || '')}</td>
          <td>${escapeHtml((p.username || '').toUpperCase())}</td>
          <td>${escapeHtml(stats.full)}</td>
          <td>${escapeHtml(stats.short)}</td>
          <td>${p.allow_overtime ? escapeHtml(stats.overtime) : '-'}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </body>
      </html>
    `;

    let filename = 'staff_leaves_summary';
    if (filters.selectedYear && filters.selectedYear !== 'all') {
      filename += `_year_${filters.selectedYear}`;
    }
    if (filters.filterType && filters.filterType !== 'all') {
      filename += `_type_${filters.filterType.replace(/\s+/g, '_')}`;
    }
    if (filters.filterStartDate && filters.filterEndDate) {
      filename += `_${filters.filterStartDate}_to_${filters.filterEndDate}`;
    } else if (filters.filterStartDate) {
      filename += `_from_${filters.filterStartDate}`;
    } else if (filters.filterEndDate) {
      filename += `_until_${filters.filterEndDate}`;
    }
    if (filters.searchQuery && filters.searchQuery.trim()) {
      const cleanSearch = filters.searchQuery.trim().replace(/[^a-zA-Z0-9\u0980-\u09FF_-]/g, '_');
      filename += `_search_${cleanSearch}`;
    }
    if (
      (!filters.selectedYear || filters.selectedYear === 'all') &&
      (!filters.filterType || filters.filterType === 'all') &&
      !filters.filterStartDate &&
      !filters.filterEndDate &&
      (!filters.searchQuery || !filters.searchQuery.trim())
    ) {
      filename += `_${new Date().toISOString().split('T')[0]}`;
    }
    filename += '.xls';

    if (isTauriApp()) {
      saveTauriFile(html, filename, 'Excel Files', 'xls', onSuccess, onError);
    } else {
      const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      onSuccess();
    }
  };

  // Export individual staff report as PDF
  export const exportHolidayResponsesExcel = (
    responses: GovtHolidayResponse[],
    onSuccess: () => void,
    onError: (msg: string) => void
  ) => {
    if (responses.length === 0) {
      onError('No data found to export!');
      return;
    }

    let rowsHtml = '';
    responses.forEach(r => {
      const staffName = r.profiles?.full_name || 'N/A';
      const staffCode = r.profiles?.username ? r.profiles.username.toUpperCase() : 'N/A';
      rowsHtml += `
        <tr>
          <td style="mso-number-format:'\\@';">${escapeHtml(formatDate(r.holiday_date))}</td>
          <td>${escapeHtml(r.holiday_name)}</td>
          <td>${escapeHtml(staffName)}</td>
          <td>${escapeHtml(staffCode)}</td>
          <td>${r.response === 'paid' ? 'Get Paid' : 'Reserve'}</td>
          <td>${escapeHtml(r.created_at ? new Date(r.created_at).toLocaleString('en-US') : '')}</td>
        </tr>
      `;
    });

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"/><style>td { border: 0.5pt solid #ccc; }</style></head>
      <body>
        <h3>Govt Holiday Staff Responses</h3>
        <table border="1">
          <thead>
            <tr style="background-color: #4F81BD; color: white;">
              <th>Holiday Date</th>
              <th>Holiday Name</th>
              <th>Name</th>
              <th>Codename</th>
              <th>Selection</th>
              <th>Response Time</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const filename = `govt_holiday_responses_${new Date().toISOString().split('T')[0]}.xls`;

    if (isTauriApp()) {
      saveTauriFile(html, filename, 'Excel Files', 'xls', onSuccess, onError);
    } else {
      const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      onSuccess();
    }
  };

  // Export Govt Holiday Responses as PDF
  export const exportSettlementsExcel = (
    settlementsData: Array<{
      staffName: string;
      username: string;
      category: string;
      period: string;
      year: string;
      remainingDays: number;
      actionLabel: string;
      status: string;
    }>,
    year: string,
    periodLabel: string,
    category: string,
    onSuccess: () => void,
    onError: (msg: string) => void
  ) => {
    if (settlementsData.length === 0) {
      onError('No data found to export!');
      return;
    }

    let rowsHtml = '';
    settlementsData.forEach(s => {
      rowsHtml += `
        <tr>
          <td>${escapeHtml(s.staffName)}</td>
          <td>${escapeHtml(s.username.toUpperCase())}</td>
          <td style="mso-number-format:'0.0';">${s.remainingDays}</td>
          <td>${escapeHtml(s.actionLabel)}</td>
          <td style="text-transform: capitalize;">${escapeHtml(s.status)}</td>
        </tr>
      `;
    });

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"/><style>td { border: 0.5pt solid #ccc; }</style></head>
      <body>
        <h3>Unified Leave Review & Settlements Report (${year})</h3>
        <p><strong>Review Period:</strong> ${escapeHtml(periodLabel)} | <strong>Leave Category:</strong> ${escapeHtml(category)}</p>
        <table border="1">
          <thead>
            <tr style="background-color: #4F81BD; color: white;">
              <th>Name</th>
              <th>Codename</th>
              <th>Unused Balance (days)</th>
              <th>Settlement Split Choice</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const filename = `leave_settlements_${category.replace(/\s+/g, '_')}_${periodLabel.replace(/\s+/g, '_')}_${year}.xls`;

    if (isTauriApp()) {
      saveTauriFile(html, filename, 'Excel Files', 'xls', onSuccess, onError);
    } else {
      const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      onSuccess();
    }
  };

  // Export Settlements as PDF
  export const exportDailyLeavesExcel = (
    recordsToExport: ChutiRecord[],
    selectedDate: string,
    profilesList: Profile[],
    profile: Profile | null,
    onSuccess: () => void,
    onError: (msg: string) => void
  ) => {
    if (recordsToExport.length === 0) {
      onError('No data found to export!');
      return;
    }

    const tablesHtml = buildTeamWiseTablesHtml(recordsToExport, profilesList, profile);

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8"/>
        <style>
          td { border: 0.5pt solid #ccc; }
          th { background-color: #f1f5f9; font-weight: bold; }
        </style>
      </head>
      <body>
        <h2>Team Daily Leave Records - ${formatDate(selectedDate)}</h2>
        ${tablesHtml}
      </body>
      </html>
    `;

    const supervisorName = profile?.full_name || profile?.username || 'Supervisor';
    const filename = `${selectedDate}-${supervisorName}'s Team Leave record.xls`;

    if (isTauriApp()) {
      saveTauriFile(html, filename, 'Excel Files', 'xls', onSuccess, onError);
    } else {
      const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      onSuccess();
    }
  };

  