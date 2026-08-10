import { User as SupabaseUser } from '@supabase/supabase-js';
import { Profile, GovtHolidayResponse } from '../types';
import { ChutiRecord } from './offlineSync';
import { calculateStats, formatTimeToAMPM, getCleanComment, formatDate, escapeHtml } from './dashboardHelpers';
import { printHtml, buildTeamWiseTablesHtml } from './exportCore';

export const exportIndividualPDF = (
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
            }; 500);
          }
        </script>
      </body>
      </html>
    `;
    printHtml(htmlContent, onSuccess, onError);
  };

  // Export summary report for all staff as PDF
  export const exportSummaryPDF = (
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
            }; 500);
          }
        </script>
      </body>
      </html>
    `;
    printHtml(htmlContent, onSuccess, onError);
  };


  // Export Govt Holiday Responses as Excel
  export const exportHolidayResponsesPDF = (
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
            }; 500);
          }
        </script>
      </body>
      </html>
    `;
    printHtml(htmlContent, onSuccess, onError);
  };

  // Export Settlements as Excel
  export const exportSettlementsPDF = (
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
            }; 500);
          }
        </script>
      </body>
      </html>
    `;
    printHtml(htmlContent, onSuccess, onError);
  };

  export const exportDailyLeavesPDF = (
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
            }; 500);
          }
        </script>
      </body>
      </html>
    `;
    printHtml(htmlContent, onSuccess, onError);
  }
