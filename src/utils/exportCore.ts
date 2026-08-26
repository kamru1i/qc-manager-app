import { User as SupabaseUser } from '@supabase/supabase-js';
import { Profile, GovtHolidayResponse } from '../types';
import { ChutiRecord } from './offlineSync';
import { calculateStats } from './dashboardHelpers';
import { formatDate, escapeHtml } from './formatters';
import { isTauriApp } from './apiUrlHelper';
import { isAdminRole } from '@/utils/permissionService';
import { getLatestActionComment, getCleanComment } from './leaveCalculations';

// Helper to save file inside Tauri using Save Dialog and FS API
export const saveTauriFile = async (
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
export const printHtml = (
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

// Helper function to format time in HH:MM to 12-hour AM/PM format
export const formatTimeToAMPM = (timeStr: string | null | undefined): string => {
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

export const buildTeamWiseTablesHtml = (
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
          <td>${escapeHtml(getLatestActionComment(r.comment, r)) || '-'}</td>
          <td>${escapeHtml(r.status || 'pending')}</td>
        </tr>
      `;
    });
    return rowsHtml;
  };

  // If the exporter is not an admin, we just output a single table with their team name
  if (!isAdminRole(profile)) {
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

