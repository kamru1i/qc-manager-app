export const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '';
  const parts = dateString.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateString;
};

export const formatDateTime = (isoString: string | null | undefined): string => {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) {
      // If it's a date-only string like YYYY-MM-DD
      if (typeof isoString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(isoString)) {
        return formatDate(isoString);
      }
      return String(isoString);
    }

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 -> 12
    const hoursStr = String(hours).padStart(2, '0');

    return `${day}-${month}-${year}, ${hoursStr}:${minutes} ${ampm}`;
  } catch {
    return String(isoString);
  }
};

export const escapeHtml = (unsafeStr: unknown): string => {
  if (unsafeStr === null || unsafeStr === undefined) return '';
  return unsafeStr
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

