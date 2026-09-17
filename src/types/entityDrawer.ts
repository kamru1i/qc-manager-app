import { Profile, RecordItem, QuotationMistake } from '@/types';
import { ChutiRecord } from '@/utils/offlineSync';

export type EntityDrawerType = 'user' | 'quotation' | 'mistake' | 'leave';

export interface UserEntityRequest {
  type: 'user';
  userId?: string;
  username?: string; // codename
  profile?: Profile;
  sourceContext?: 'quotation' | 'leave' | 'mistake' | 'general';
}

export interface QuotationEntityRequest {
  type: 'quotation';
  recordId?: string;
  record?: RecordItem;
  fileName?: string;
  codename?: string;
}

export interface MistakeEntityRequest {
  type: 'mistake';
  mistakeId?: string;
  mistake?: QuotationMistake;
}

export interface LeaveEntityRequest {
  type: 'leave';
  leaveId?: string;
  leaveRecord?: ChutiRecord;
}

export type EntityDrawerRequest =
  | UserEntityRequest
  | QuotationEntityRequest
  | MistakeEntityRequest
  | LeaveEntityRequest;

export interface UserEntityDetails {
  profile: Profile;
  supervisorName: string | null;
  recentRecords: RecordItem[];
  recentMistakes: QuotationMistake[];
  recentLeaves: ChutiRecord[];
  todaySubmissionsCount: number;
  monthSubmissionsCount: number;
  conversionRate: number;
  totalMistakesCount: number;
  leaveSummary: {
    officeLeavesTaken: number;
    shortLeaveHours: string;
    overtimeHours: string;
  };
  globalRank: number | null;
}

export interface QuotationEntityDetails {
  record: RecordItem;
  submitterProfile: Profile | null;
  matchingMistake: QuotationMistake | null;
}

export interface MistakeEntityDetails {
  mistake: QuotationMistake;
  submitterProfile: Profile | null;
  matchingRecord: RecordItem | null;
}

export interface LeaveEntityDetails {
  leave: ChutiRecord;
  employeeProfile: Profile | null;
}
