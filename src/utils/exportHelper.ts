import { User as SupabaseUser } from '@supabase/supabase-js';
import { Profile, GovtHolidayResponse } from '../types';
import { ChutiRecord } from './offlineSync';
import { calculateStats } from './dashboardHelpers';
import { isTauriApp } from './apiUrlHelper';

// Helper to save file inside Tauri using Save Dialog and FS API
const saveTauriFile = async (
  contentStr: string,
  suggestedFilename: string,
  fileTypeLabel: string,
  fileExtension: string,
  onSuccess: () => void,
  onError: (msg: string) => void
) => {
  try {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeFile } = await import('@tauri-apps/plugin-fs');

    const filePath = await save({
      defaultPath: suggestedFilename,
      filters: [{
        name: fileTypeLabel,
        extensions: [fileExtension]
      }]
    });

    if (!filePath) {
      // User cancelled, trigger success to clear loaders
      onSuccess();
      return;
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(contentStr);

    await writeFile(filePath, data);
    onSuccess();
  } catch (err) {
    console.error('Tauri file save error:', err);
    const msg = err instanceof Error ? err.message : 'Failed to save file in desktop app.';
    onError(msg);
  }
};

// Helper to print HTML content using a hidden iframe to bypass popup blockers
const printHtml = (
  htmlContent: string,
  onSuccess: () => void,
  onError: (msg: string) => void
) => {
  try {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      onError('Failed to create print document.');
      return;
    }

    doc.open();
    doc.write(htmlContent);
    doc.close();

    // Give it a moment to load and render, then print
    setTimeout(() => {
      if (iframe.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
        onSuccess();
      } else {
        onError('Failed to access print window.');
        document.body.removeChild(iframe);
      }
    }, 600);
  } catch (err) {
    console.error('Error during iframe printing:', err);
    onError('Failed to execute print command.');
  }
};

// Helper function to format date from YYYY-MM-DD to DD-MM-YYYY
const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '';
  const parts = dateString.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateString;
};

// Helper function to format time in HH:MM to 12-hour AM/PM format
const formatTimeToAMPM = (timeStr: string | null | undefined): string => {
  if (!timeStr) return '-';
  try {
    const [hoursStr, minutesStr] = timeStr.split(':');
    const hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
    return `${displayHours}:${displayMinutes} ${ampm}`;
  } catch {
    return timeStr;
  }
};

// Helper function to clean supervisor/admin approval prefix from comment for table display
const getCleanComment = (comment: string | null | undefined): string => {
  if (!comment) return '';
  let clean = comment;
  const regex = /^[A-Za-z0-9_-]+\s+Approved(?:\s*\|\s*)?/;
  while (regex.test(clean)) {
    clean = clean.replace(regex, '');
  }
  return clean.trim();
};

const escapeHtml = (unsafeStr: unknown): string => {
  if (unsafeStr === null || unsafeStr === undefined) return '';
  return unsafeStr
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const buildTeamWiseTablesHtml = (
  recordsToExport: ChutiRecord[],
  profilesList: Profile[],
  profile: Profile | null
): string => {
  const headersHtml = `
    <tr>
      <th>Name</th>
      <th>Codename</th>
      <th>Leave Type</th>
      <th>Sign In/Out</th>
      <th>Leave Hour</th>
      <th>Comment</th>
      <th>Status</th>
    </tr>
  `;

  const getTableRowsHtml = (records: ChutiRecord[]) => {
    let rowsHtml = '';
    records.forEach(r => {
      const staffProfile = profilesList.find(p => p.id === r.user_id);
      const fullName = staffProfile?.full_name || staffProfile?.username || r.username || '';
      const codename = staffProfile?.username || r.username || '';
      const signInStr = r.leave_type === 'Full Leave' ? '-' : formatTimeToAMPM(r.sign_in_time);
      const signOutStr = r.leave_type === 'Full Leave' ? '-' : formatTimeToAMPM(r.sign_out_time);
      const leaveHourStr = r.leave_type === 'Full Leave' || r.leave_type === 'Overtime' ? '-' : (r.leave_hour ? r.leave_hour.toString().split('.')[0].substring(0, 5) : '-');

      rowsHtml += `
        <tr>
          <td>${escapeHtml(fullName)}</td>
          <td>${escapeHtml(codename)}</td>
          <td>${escapeHtml(r.leave_type)}</td>
          <td>${r.leave_type === 'Full Leave' ? '-' : escapeHtml(`${signInStr} / ${signOutStr}`)}</td>
          <td>${escapeHtml(leaveHourStr)}</td>
          <td>${escapeHtml(getCleanComment(r.comment))}</td>
          <td>${escapeHtml(r.status || 'pending')}</td>
        </tr>
      `;
    });
    return rowsHtml;
  };

  // If the exporter is not an admin, we just output a single table with their team name
  if (profile?.role !== 'admin') {
    const supervisorName = (profile?.username || 'Supervisor').toUpperCase();
    const rows = getTableRowsHtml(recordsToExport);
    return `
      <h3 style="margin-top: 25px; color: #1e293b;">${escapeHtml(supervisorName)} Team Leave Records</h3>
      <table>
        <thead>${headersHtml}</thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  // Admin logic: group by supervisor, and gather unassigned records
  const supervisors = profilesList.filter(
    (p) => p.role === 'supervisor' || p.role === 'admin'
  );

  // Sort supervisors by username/codename
  const sortedSupervisors = [...supervisors].sort((a, b) => 
    (a.username || '').localeCompare(b.username || '')
  );

  let outputHtml = '';
  const assignedRecordIds = new Set<string>();

  sortedSupervisors.forEach(sup => {
    const teamRecords = recordsToExport.filter(r => {
      const staff = profilesList.find(p => p.id === r.user_id);
      return staff?.supervisor_ids?.includes(sup.id);
    });

    if (teamRecords.length > 0) {
      teamRecords.forEach(r => {
        if (r.id) assignedRecordIds.add(r.id);
      });
      const supName = (sup.username || 'Supervisor').toUpperCase();
      const rows = getTableRowsHtml(teamRecords);
      outputHtml += `
        <h3 style="margin-top: 25px; color: #1e293b;">${escapeHtml(supName)} Team Leave Records</h3>
        <table>
          <thead>${headersHtml}</thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    }
  });

  const unassignedRecords = recordsToExport.filter(r => !r.id || !assignedRecordIds.has(r.id));
  if (unassignedRecords.length > 0) {
    const rows = getTableRowsHtml(unassignedRecords);
    outputHtml += `
      <h3 style="margin-top: 25px; color: #1e293b;">Direct Staff Leave Records</h3>
      <table>
        <thead>${headersHtml}</thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  return outputHtml;
};

export const exportHelper = {

  // Export individual staff report as Excel (HTML format)
  exportIndividualExcel: (
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
  },


  // Export summary report for all staff as Excel (HTML format)
  exportSummaryExcel: (
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
  },

  // Export individual staff report as PDF
  exportIndividualPDF: (
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
    const stats = calculateStats(recordsToExport);

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
          <td>${escapeHtml(formatDate(r.date))}</td>
          <td>${escapeHtml(r.leave_type)}</td>
          <td>${escapeHtml(adjustmentVal)}</td>
          <td>${r.leave_type === 'Full Leave' ? '-' : escapeHtml(`${signInStr} / ${signOutStr}`)}</td>
          <td>${escapeHtml(leaveHourStr)}</td>
          ${showOvertime ? `<td>${escapeHtml(r.leave_type === 'Overtime' ? (r.leave_hour ? r.leave_hour.toString().split('.')[0].substring(0, 5) : '-') : '-')}</td>` : ''}
          <td>${escapeHtml(getCleanComment(r.comment)) || '-'}</td>
          <td><span class="status-badge ${escapeHtml(r.status || '')}">${escapeHtml(r.status)}</span></td>
        </tr>
      `;
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Detailed Leave Report - ${escapeHtml(activeProfile?.full_name || 'Staff')}</title>
        <meta charset="utf-8">
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; color: #1e293b; line-height: 1.5; padding: 20px; }
          .header { text-align: center; margin-bottom: 25px; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; }
          .header h1 { margin: 0 0 5px 0; font-size: 22px; color: #0f172a; }
          .header p { margin: 0; font-size: 13px; color: #64748b; }
          
          .info-grid { display: grid; grid-template-cols: 1fr 1fr; gap: 15px; margin-bottom: 25px; font-size: 13px; }
          .info-card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px 15px; border-radius: 8px; }
          .info-card strong { color: #0f172a; }
          
          .stats-grid { display: flex; gap: 10px; margin-bottom: 25px; }
          .stat-box { flex: 1; text-align: center; background: #f1f5f9; border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; }
          .stat-box span { display: block; font-size: 11px; color: #64748b; text-transform: uppercase; }
          .stat-box strong { font-size: 16px; color: #0f172a; display: block; margin-top: 3px; }
          
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
          th { background-color: #f1f5f9; color: #334155; font-weight: 600; }
          tr:nth-child(even) { background-color: #f8fafc; }
          
          .status-badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; text-transform: uppercase; }
          .status-badge.approved { background: #dcfce7; color: #15803d; }
          .status-badge.approved_by_supervisor { background: #e0f2fe; color: #0369a1; }
          .status-badge.pending_supervisor { background: #fef3c7; color: #b45309; }
          .status-badge.needs_review { background: #fee2e2; color: #b91c1c; }

          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Detailed Leave Report</h1>
          <p>${escapeHtml(activeProfile?.full_name)} (${escapeHtml((activeProfile?.username || '').toUpperCase())})</p>
        </div>
        
        <div class="info-grid">
          <div class="info-card">
            <strong>Staff Profile:</strong><br>
            Role: ${escapeHtml(activeProfile?.job_role || activeProfile?.role)}<br>
            Working Hours: ${escapeHtml(activeProfile?.working_hours || 9.5)} hrs (Break: ${escapeHtml(activeProfile?.break_time || 0)}m)
          </div>
          <div class="info-card">
            <strong>Report Filters:</strong><br>
            Year: ${filters.selectedYear || 'All'}<br>
            Date Range: ${filters.filterStartDate ? formatDate(filters.filterStartDate) : 'Start'} to ${filters.filterEndDate ? formatDate(filters.filterEndDate) : 'End'}
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-box">
            <span>Short Leave</span>
            <strong>${stats.shortHours} hrs</strong>
          </div>
          <div class="stat-box">
            <span>Full Leave</span>
            <strong>${stats.fullLeaves} days</strong>
          </div>

          ${showOvertime ? `<div class="stat-box">
            <span>Overtime</span>
            <strong>${stats.overtimeHours} hrs</strong>
          </div>` : ''}
        </div>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Adjustment</th>
              <th>Sign In/Out</th>
              <th>Leave Hour</th>
              ${showOvertime ? '<th>Overtime</th>' : ''}
              <th>Comment</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          }
        </script>
      </body>
      </html>
    `;
    printHtml(htmlContent, onSuccess, onError);
  },

  // Export summary report for all staff as PDF
  exportSummaryPDF: (
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

    let rowsHtml = '';
    staffProfiles.forEach(p => {
      const stats = getUserSummaryStats(p.id);
      rowsHtml += `
        <tr>
          <td>${escapeHtml(p.full_name || '')}</td>
          <td>${escapeHtml((p.username || '').toUpperCase())}</td>
          <td>${escapeHtml(p.job_role || p.role)}</td>
          <td>${escapeHtml(stats.full)} days</td>
          <td>${escapeHtml(stats.short)} hrs</td>
          <td>${p.allow_overtime ? `${escapeHtml(stats.overtime)} hrs` : '-'}</td>
        </tr>
      `;
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Staff Leave Summary Report</title>
        <meta charset="utf-8">
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; color: #1e293b; line-height: 1.5; padding: 20px; }
          .header { text-align: center; margin-bottom: 25px; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; }
          .header h1 { margin: 0 0 5px 0; font-size: 22px; color: #0f172a; }
          .header p { margin: 0; font-size: 13px; color: #64748b; }
          
          .filters-card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px 15px; border-radius: 8px; margin-bottom: 25px; font-size: 13px; }
          .filters-card strong { color: #0f172a; }
          
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
          th { background-color: #f1f5f9; color: #334155; font-weight: 600; }
          tr:nth-child(even) { background-color: #f8fafc; }
          
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Staff Leave Attendance Summary Report</h1>
          <p>Official Report Generated On: ${new Date().toLocaleDateString('en-US')}</p>
        </div>
        
        <div class="filters-card">
          <strong>Report Filters:</strong><br>
          Year: ${filters.selectedYear || 'All'}<br>
          Date Range: ${filters.filterStartDate ? formatDate(filters.filterStartDate) : 'Start'} to ${filters.filterEndDate ? formatDate(filters.filterEndDate) : 'End'}
        </div>

        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Codename</th>
              <th>Job Role</th>
              <th>Full Leave</th>
              <th>Short Leave</th>
              <th>Overtime</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          }
        </script>
      </body>
      </html>
    `;
    printHtml(htmlContent, onSuccess, onError);
  },


  // Export Govt Holiday Responses as Excel
  exportHolidayResponsesExcel: (
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
  },

  // Export Govt Holiday Responses as PDF
  exportHolidayResponsesPDF: (
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
          <td>${escapeHtml(formatDate(r.holiday_date))}</td>
          <td>${escapeHtml(r.holiday_name)}</td>
          <td>${escapeHtml(staffName)} (${escapeHtml(staffCode)})</td>
          <td><span class="status-badge ${r.response === 'paid' ? 'approved' : 'pending_supervisor'}">${r.response === 'paid' ? 'Get Paid' : 'Reserve'}</span></td>
          <td>${r.created_at ? escapeHtml(new Date(r.created_at).toLocaleString('en-US')) : ''}</td>
        </tr>
      `;
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Govt Holiday Staff Response Report</title>
        <meta charset="utf-8">
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; color: #1e293b; line-height: 1.5; padding: 20px; }
          .header { text-align: center; margin-bottom: 25px; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; }
          .header h1 { margin: 0 0 5px 0; font-size: 22px; color: #0f172a; }
          .header p { margin: 0; font-size: 13px; color: #64748b; }
          
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
          th { background-color: #f1f5f9; color: #334155; font-weight: 600; }
          tr:nth-child(even) { background-color: #f8fafc; }
          
          .status-badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; }
          .status-badge.approved { background: #dcfce7; color: #15803d; }
          .status-badge.pending_supervisor { background: #fef3c7; color: #b45309; }

          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Govt Holiday Staff Response Report</h1>
          <p>Report Generated On: ${new Date().toLocaleDateString('en-US')}</p>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>Holiday Date</th>
              <th>Holiday Name</th>
              <th>Name & Codename</th>
              <th>Selection</th>
              <th>Response Time</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          }
        </script>
      </body>
      </html>
    `;
    printHtml(htmlContent, onSuccess, onError);
  },

  // Export Settlements as Excel
  exportSettlementsExcel: (
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
  },

  // Export Settlements as PDF
  exportSettlementsPDF: (
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
      let statusBadgeClass = 'needs_review';
      if (s.status === 'processed') statusBadgeClass = 'approved';
      else if (s.status === 'responded') statusBadgeClass = 'approved_by_supervisor';
      else if (s.status === 'initiated') statusBadgeClass = 'pending_supervisor';

      rowsHtml += `
        <tr>
          <td>${escapeHtml(s.staffName)}</td>
          <td>${escapeHtml(s.username.toUpperCase())}</td>
          <td><strong>${s.remainingDays} days</strong></td>
          <td>${escapeHtml(s.actionLabel)}</td>
          <td><span class="status-badge ${statusBadgeClass}">${escapeHtml(s.status === 'initiated' ? 'Preference Pending' : s.status === 'responded' ? 'Preference Submitted' : s.status)}</span></td>
        </tr>
      `;
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Unified Leave Review & Settlements Report - ${year}</title>
        <meta charset="utf-8">
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; color: #1e293b; line-height: 1.5; padding: 20px; }
          .header { text-align: center; margin-bottom: 25px; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; }
          .header h1 { margin: 0 0 5px 0; font-size: 22px; color: #0f172a; }
          .header p { margin: 0; font-size: 13px; color: #64748b; }
          
          .info-card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px 15px; border-radius: 8px; margin-bottom: 25px; font-size: 13px; }
          .info-card strong { color: #0f172a; }
          
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
          th { background-color: #f1f5f9; color: #334155; font-weight: 600; }
          tr:nth-child(even) { background-color: #f8fafc; }
          
          .status-badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; text-transform: uppercase; }
          .status-badge.approved { background: #dcfce7; color: #15803d; }
          .status-badge.approved_by_supervisor { background: #e0f2fe; color: #0369a1; }
          .status-badge.pending_supervisor { background: #fef3c7; color: #b45309; }
          .status-badge.needs_review { background: #f1f5f9; color: #64748b; }

          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Unified Leave Review & Settlements Report</h1>
          <p>Generated On: ${new Date().toLocaleDateString('en-US')}</p>
        </div>
        
        <div class="info-card">
          <strong>Settlement Details:</strong><br>
          Year: ${escapeHtml(year)}<br>
          Review Period: ${escapeHtml(periodLabel)}<br>
          Leave Category: ${escapeHtml(category)}
        </div>

        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Codename</th>
              <th>Unused Balance</th>
              <th>Settlement Split Choice</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          }
        </script>
      </body>
      </html>
    `;
    printHtml(htmlContent, onSuccess, onError);
  },

  exportDailyLeavesExcel: (
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
  },

  exportDailyLeavesPDF: (
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

    const supervisorName = profile?.full_name || profile?.username || 'Supervisor';
    const documentTitle = `${selectedDate}-${supervisorName}'s Team Leave record`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${escapeHtml(documentTitle)}</title>
        <style>
          body { font-family: sans-serif; color: #333; margin: 20px; }
          .header { text-align: center; margin-bottom: 25px; }
          .header h1 { margin: 0; font-size: 22px; color: #1e293b; }
          .header p { margin: 5px 0 0 0; font-size: 14px; color: #64748b; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; margin-bottom: 25px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
          th { background-color: #f1f5f9; font-weight: bold; color: #334155; }
          tr:nth-child(even) { background-color: #f8fafc; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Team Daily Leave Records</h1>
          <p>Date: ${escapeHtml(formatDate(selectedDate))}</p>
        </div>
        ${tablesHtml}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          }
        </script>
      </body>
      </html>
    `;
    printHtml(htmlContent, onSuccess, onError);
  }
};
