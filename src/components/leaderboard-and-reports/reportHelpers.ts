import { RecordItem } from '@/types';
import { calculateCanonicalQuotationStats } from '@/utils/quotationConsistency';

export const monthsList = [
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

export interface TypeStats {
  quotes: number;
  requotes: number;
  reviews: number;
  sales: number;
  conversionRate: number;
}

// Quote/Requote/Review/Sale tallies + sales conversion rate for a record set
export const computeTypeStats = (records: RecordItem[]): TypeStats => {
  const stats = calculateCanonicalQuotationStats(records);
  return {
    quotes: stats.quote,
    requotes: stats.requote,
    reviews: stats.review + stats.individualReview,
    sales: stats.sale,
    conversionRate: stats.conversionRate,
  };
};

export type GrowthTrend = 'up' | 'down' | 'neutral';

export const getGrowthStats = (current: number, previous: number): { trend: GrowthTrend; label: string } => {
  if (previous === 0) {
    if (current === 0) {
      return { trend: 'neutral', label: '0.00%' };
    }
    return { trend: 'up', label: '+100.00%' };
  }
  const finalChange = ((current - previous) / Math.abs(previous)) * 100;
  const trend: GrowthTrend = finalChange > 0 ? 'up' : finalChange < 0 ? 'down' : 'neutral';
  const label =
    finalChange > 0
      ? `+${finalChange.toFixed(2)}%`
      : finalChange < 0
        ? `${finalChange.toFixed(2)}%`
        : '0.00%';
  return { trend, label };
};

export const ALL_12_CATEGORIES = [
  'Quote',
  'Requote',
  'Requote Van',
  'Requote Bike',
  'Review',
  'Review Van',
  'Review Bike',
  'Individual Review',
  'Other Site',
  'Van',
  'Bike',
  'Sale',
];

export const getCategoryColor = (name: string) => {
  switch (name) {
    case 'Quote':
      return 'from-blue-600 to-blue-400 border-blue-500/25 bg-blue-500';
    case 'Requote':
      return 'from-purple-600 to-purple-400 border-purple-500/25 bg-purple-500';
    case 'Requote Van':
      return 'from-indigo-600 to-indigo-400 border-indigo-500/25 bg-indigo-500';
    case 'Requote Bike':
      return 'from-violet-600 to-violet-400 border-violet-500/25 bg-violet-500';
    case 'Review':
      return 'from-pink-600 to-pink-400 border-pink-500/25 bg-pink-500';
    case 'Review Van':
      return 'from-rose-600 to-rose-450 border-rose-500/25 bg-rose-500';
    case 'Review Bike':
      return 'from-fuchsia-600 to-fuchsia-400 border-fuchsia-500/25 bg-fuchsia-500';
    case 'Individual Review':
      return 'from-purple-600 to-purple-400 border-purple-500/25 bg-purple-500';
    case 'Other Site':
      return 'from-blue-600 to-blue-400 border-blue-500/25 bg-blue-500';
    case 'Van':
      return 'from-teal-600 to-teal-400 border-teal-500/25 bg-teal-500';
    case 'Bike':
      return 'from-cyan-600 to-cyan-400 border-cyan-500/25 bg-cyan-500';
    case 'Sale':
      return 'from-emerald-600 to-emerald-400 border-emerald-500/25 bg-emerald-500';
    default:
      return 'from-slate-650 to-slate-450 border-slate-500/25 bg-slate-500';
  }
};

// Human label for the active period, e.g. "2026" or "July 2026"
export const getScopeLabel = (
  metricsTimeScope: 'yearly' | 'monthly',
  selectedYear: string,
  selectedMonth: string,
  short = false,
) => {
  if (metricsTimeScope === 'yearly') return selectedYear;
  const monthName = monthsList.find(m => m.value === selectedMonth)?.name || '';
  return `${short ? monthName.substring(0, 3) : monthName} ${selectedYear}`;
};
