import { supabase } from '@/utils/supabase';
import { RECORD_COLUMNS, QUOTATION_MISTAKE_COLUMNS, CHUTI_COLUMNS } from '@/utils/dbColumns';
import { recordsService, mistakesService, chutiService, profilesService } from '@/services';
import { Profile, RecordItem, QuotationMistake } from '@/types';
import { ChutiRecord } from '@/utils/offlineSync';
import {
  UserEntityDetails,
  QuotationEntityDetails,
  MistakeEntityDetails,
  LeaveEntityDetails,
} from '@/types/entityDrawer';
import {
  getBusinessTodayDateKey,
  getBusinessYear,
  getBusinessMonth,
} from '@/utils/businessDateTime';
import {
  calculateCanonicalQuotationStats,
  filterQuotationRecordsByDate,
} from '@/utils/quotationConsistency';

// In-memory cache with 60-second TTL
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
const CACHE_TTL_MS = 60_000;
const entityCache = new Map<string, CacheEntry<unknown>>();
const inFlightRequests = new Map<string, Promise<unknown>>();

function getFromCache<T>(key: string): T | null {
  const entry = entityCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    entityCache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setInCache<T>(key: string, data: T): void {
  entityCache.set(key, { data, timestamp: Date.now() });
}

export const entityDrawerService = {
  /**
   * Fetch complete user context for Entity Drawer
   */
  async fetchUserDetails(
    options: { userId?: string; username?: string; profile?: Profile },
    profilesList: Profile[] = []
  ): Promise<UserEntityDetails | null> {
    const cacheKey = `user_${options.userId || ''}_${options.username || ''}`;
    const cached = getFromCache<UserEntityDetails>(cacheKey);
    if (cached) return cached;

    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey) as Promise<UserEntityDetails | null>;
    }

    const promise = (async () => {
      // 1. Resolve Profile
      let profile: Profile | null = options.profile || null;
      if (!profile && options.userId) {
        profile = profilesList.find((p) => p.id === options.userId) || null;
        if (!profile) {
          const { data } = await profilesService.getProfileById(options.userId);
          profile = data;
        }
      }
      if (!profile && options.username) {
        const normalized = options.username.trim().toLowerCase();
        profile =
          profilesList.find(
            (p) =>
              p.username?.toLowerCase() === normalized ||
              p.codename?.toLowerCase() === normalized
          ) || null;
      }
      if (!profile) return null;

      const userId = profile.id;

      // 2. Resolve Supervisor Names
      let supervisorName: string | null = null;
      if (profile.supervisor_ids && profile.supervisor_ids.length > 0) {
        const supNames = profile.supervisor_ids
          .map((id) => {
            const sup = profilesList.find((p) => p.id === id);
            return sup?.full_name || sup?.username || null;
          })
          .filter(Boolean);
        if (supNames.length > 0) {
          supervisorName = supNames.join(', ');
        }
      }

      // 3. Parallel fetch of recent records, mistakes, and leaves
      const [recordsRes, mistakesRes, leavesRes] = await Promise.all([
        recordsService.getRecords({ userId }).catch(() => ({ data: [] })),
        mistakesService
          .getQuotationMistakes({ userId, pageSize: 5 })
          .catch(() => ({ data: [], count: 0 })),
        chutiService.getChutiRecords({ userId }).catch(() => ({ data: [] })),
      ]);

      const userRecords = (recordsRes.data || []) as RecordItem[];
      const recentRecords = userRecords.slice(0, 5);
      const recentMistakes = (mistakesRes.data || []) as QuotationMistake[];
      const totalMistakesCount = mistakesRes.count ?? recentMistakes.length;
      const userLeaves = (leavesRes.data || []) as ChutiRecord[];
      const recentLeaves = userLeaves.slice(0, 5);

      // 4. Quotation Stats (Asia/Dhaka business time)
      const todayStr = getBusinessTodayDateKey();
      const currentYear = getBusinessYear();
      const currentMonth = getBusinessMonth();

      const todayRecords = filterQuotationRecordsByDate(userRecords, todayStr);
      const todaySubmissionsCount = todayRecords.filter(
        (r) => r.file_type !== 'Other Site'
      ).length;

      const monthRecords = userRecords.filter((r) => {
        if (!r.submitted_at) return false;
        const [y, m] = r.submitted_at.substring(0, 7).split('-');
        return y === currentYear && m === currentMonth;
      });
      const monthStats = calculateCanonicalQuotationStats(monthRecords);

      // 5. Leave Summary
      let officeLeavesTaken = 0;
      let shortMins = 0;
      let overtimeMins = 0;
      userLeaves.forEach((l) => {
        if (l.status === 'approved') {
          if (l.leave_type === 'Office Leave' || l.leave_type === 'Full Leave') {
            officeLeavesTaken++;
          } else if (l.leave_type === 'Short Leave' || l.leave_type === 'Late Join' || l.leave_type === 'Early Leave') {
            if (l.leave_hour) {
              const [h, m] = l.leave_hour.split(':').map(Number);
              if (!isNaN(h)) shortMins += (h * 60) + (m || 0);
            }
          } else if (l.leave_type === 'Overtime') {
            if (l.leave_hour) {
              const [h, m] = l.leave_hour.split(':').map(Number);
              if (!isNaN(h)) overtimeMins += (h * 60) + (m || 0);
            }
          }
        }
      });

      const shortLeaveHours = `${(shortMins / 60).toFixed(1)} hrs`;
      const overtimeHours = `${(overtimeMins / 60).toFixed(1)} hrs`;

      const details: UserEntityDetails = {
        profile,
        supervisorName,
        recentRecords,
        recentMistakes,
        recentLeaves,
        todaySubmissionsCount,
        monthSubmissionsCount: monthStats.total,
        conversionRate: monthStats.conversionRate,
        totalMistakesCount,
        leaveSummary: {
          officeLeavesTaken,
          shortLeaveHours,
          overtimeHours,
        },
        globalRank: null,
      };

      setInCache(cacheKey, details);
      return details;
    })();

    inFlightRequests.set(cacheKey, promise);
    try {
      return await promise;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  },

  /**
   * Fetch complete quotation context for Entity Drawer
   */
  async fetchQuotationDetails(
    options: {
      recordId?: string;
      record?: RecordItem;
      fileName?: string;
      codename?: string;
    },
    profilesList: Profile[] = []
  ): Promise<QuotationEntityDetails | null> {
    const cacheKey = `quote_${options.recordId || ''}_${options.fileName || ''}`;
    const cached = getFromCache<QuotationEntityDetails>(cacheKey);
    if (cached) return cached;

    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey) as Promise<QuotationEntityDetails | null>;
    }

    const promise = (async () => {
      let record: RecordItem | null = options.record || null;

      if (!record && options.recordId) {
        const { data } = await supabase
          .from('records')
          .select(RECORD_COLUMNS)
          .eq('id', options.recordId)
          .single();
        record = data as unknown as RecordItem | null;
      }

      if (!record && options.fileName) {
        const cleanName = options.fileName.replace(/ \[(SOLD|UNSOLD)\]$/, '').trim();
        let query = supabase
          .from('records')
          .select(RECORD_COLUMNS)
          .ilike('file_name', `${cleanName}%`)
          .order('submitted_at', { ascending: false })
          .limit(1);
        if (options.codename) {
          query = query.eq('codename', options.codename);
        }
        const { data } = await query;
        if (data && data.length > 0) {
          record = data[0] as unknown as RecordItem;
        }
      }

      if (!record) return null;

      // Resolve submitter profile
      let submitterProfile: Profile | null = null;
      if (record.user_id) {
        submitterProfile = profilesList.find((p) => p.id === record.user_id) || null;
      }
      if (!submitterProfile && record.codename) {
        const code = record.codename.trim().toLowerCase();
        submitterProfile =
          profilesList.find(
            (p) =>
              p.username?.toLowerCase() === code ||
              p.codename?.toLowerCase() === code
          ) || null;
      }

      // Check for matching mistake on this file name
      const cleanTargetName = record.file_name.replace(/ \[(SOLD|UNSOLD)\]$/, '').trim().toUpperCase();
      let matchingMistake: QuotationMistake | null = null;

      const { data: mistakesData } = await mistakesService
        .getQuotationMistakes({ search: cleanTargetName, pageSize: 5 })
        .catch(() => ({ data: [] }));

      if (mistakesData && mistakesData.length > 0) {
        matchingMistake =
          mistakesData.find(
            (m) =>
              m.filename.trim().toUpperCase() === cleanTargetName &&
              (!record?.codename || m.codename.trim().toUpperCase() === record.codename.trim().toUpperCase())
          ) || mistakesData[0];
      }

      const details: QuotationEntityDetails = {
        record,
        submitterProfile,
        matchingMistake,
      };

      setInCache(cacheKey, details);
      return details;
    })();

    inFlightRequests.set(cacheKey, promise);
    try {
      return await promise;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  },

  /**
   * Fetch complete mistake context for Entity Drawer
   */
  async fetchMistakeDetails(
    options: {
      mistakeId?: string;
      mistake?: QuotationMistake;
    },
    profilesList: Profile[] = []
  ): Promise<MistakeEntityDetails | null> {
    const cacheKey = `mistake_${options.mistakeId || options.mistake?.id || ''}`;
    const cached = getFromCache<MistakeEntityDetails>(cacheKey);
    if (cached) return cached;

    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey) as Promise<MistakeEntityDetails | null>;
    }

    const promise = (async () => {
      let mistake: QuotationMistake | null = options.mistake || null;

      if (!mistake && options.mistakeId) {
        const { data } = await supabase
          .from('quotation_mistakes')
          .select(QUOTATION_MISTAKE_COLUMNS)
          .eq('id', options.mistakeId)
          .single();
        mistake = data as unknown as QuotationMistake | null;
      }

      if (!mistake) return null;

      // Resolve submitter profile
      let submitterProfile: Profile | null = null;
      if (mistake.user_id) {
        submitterProfile = profilesList.find((p) => p.id === mistake.user_id) || null;
      }
      if (!submitterProfile && mistake.codename) {
        const code = mistake.codename.trim().toLowerCase();
        submitterProfile =
          profilesList.find(
            (p) =>
              p.username?.toLowerCase() === code ||
              p.codename?.toLowerCase() === code
          ) || null;
      }

      // Check if related quotation record exists
      let matchingRecord: RecordItem | null = null;
      if (mistake.filename) {
        const cleanName = mistake.filename.trim();
        const { data: quoteRows } = await supabase
          .from('records')
          .select(RECORD_COLUMNS)
          .ilike('file_name', `${cleanName}%`)
          .order('submitted_at', { ascending: false })
          .limit(1);

        if (quoteRows && quoteRows.length > 0) {
          matchingRecord = quoteRows[0] as unknown as RecordItem;
        }
      }

      const details: MistakeEntityDetails = {
        mistake,
        submitterProfile,
        matchingRecord,
      };

      setInCache(cacheKey, details);
      return details;
    })();

    inFlightRequests.set(cacheKey, promise);
    try {
      return await promise;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  },

  /**
   * Fetch complete leave context for Entity Drawer
   */
  async fetchLeaveDetails(
    options: {
      leaveId?: string;
      leaveRecord?: ChutiRecord;
    },
    profilesList: Profile[] = []
  ): Promise<LeaveEntityDetails | null> {
    const cacheKey = `leave_${options.leaveId || options.leaveRecord?.id || ''}`;
    const cached = getFromCache<LeaveEntityDetails>(cacheKey);
    if (cached) return cached;

    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey) as Promise<LeaveEntityDetails | null>;
    }

    const promise = (async () => {
      let leave: ChutiRecord | null = options.leaveRecord || null;

      if (!leave && options.leaveId) {
        const { data } = await supabase
          .from('chuti')
          .select(`${CHUTI_COLUMNS}, profiles (username, full_name, role, supervisor_ids)`)
          .eq('id', options.leaveId)
          .single();
        leave = data as unknown as ChutiRecord | null;
      }

      if (!leave) return null;

      let employeeProfile: Profile | null = null;
      if (leave.user_id) {
        employeeProfile = profilesList.find((p) => p.id === leave.user_id) || null;
      }

      const details: LeaveEntityDetails = {
        leave,
        employeeProfile,
      };

      setInCache(cacheKey, details);
      return details;
    })();

    inFlightRequests.set(cacheKey, promise);
    try {
      return await promise;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  },
};
