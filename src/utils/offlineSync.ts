import { supabase } from './supabase';
import { createIdbStore, generateUUID } from './idbStoreFactory';

export { generateUUID };

export interface AdminEditRequest {
  adjusted_hour?: string | null;
  adjust_short_leave?: boolean;
  adjustment?: boolean;
  notifications?: any[];
  supervisor_ids?: string[];
}

export interface ChutiRecord {
  id?: string;
  localId?: string; // local temporary ID
  user_id: string;
  username?: string;
  date: string;
  leave_type: string;
  adjustment: boolean;
  adjusted_hour?: string | null;
  sign_in_time: string | null;
  sign_out_time: string | null;
  leave_hour: string | null;
  reserve_holiday: string | null;
  created_at?: string;
  reserve_adjustment_status?: string;
  status?: string;
  admin_edit_request?: AdminEditRequest | null;
  admin_edit_status?: string;
  is_edited?: boolean;
  adjust_short_leave?: boolean;
  comment: string | null;
  synced: boolean;
  deleted_at?: string | null;
  bulk_id?: string | null;
  action?: 'insert' | 'update' | 'delete';
  data?: Partial<Omit<ChutiRecord, 'localId' | 'synced'>>;
}

const STORE_NAME = 'pending_chuti';

const idb = createIdbStore({
  dbName: 'ChutiOfflineDB',
  dbVersion: 3,
  stores: {
    [STORE_NAME]: 'localId',
    profiles_cache: 'id',
    chuti_cache: 'id',
    holiday_responses_cache: 'id',
    settlements_cache: 'id',
    global_settings_cache: 'key',
    sync_metadata: 'table_name',
  },
});

let isSyncing = false;

// Save a record to IndexedDB
export const saveOfflineRecord = async (record: Omit<ChutiRecord, 'localId' | 'synced'>): Promise<string> => {
  const localId = generateUUID();
  const newRecord: ChutiRecord = {
    ...record,
    localId,
    synced: false,
    action: 'insert',
  };
  await idb.addItem(STORE_NAME, newRecord);
  return localId;
};

// Save an update record to IndexedDB
export const saveOfflineUpdate = async (id: string, updates: Partial<Omit<ChutiRecord, 'localId' | 'synced'>>): Promise<string> => {
  const localId = generateUUID();
  const newRecord: ChutiRecord = {
    localId,
    id,
    user_id: '', // Dummy values to satisfy required fields
    date: '',
    leave_type: '',
    adjustment: false,
    sign_in_time: null,
    sign_out_time: null,
    leave_hour: null,
    reserve_holiday: null,
    comment: null,
    synced: false,
    action: 'update',
    data: updates,
  };
  await idb.addItem(STORE_NAME, newRecord);
  return localId;
};

// Save a delete action to IndexedDB (and clean up any pending updates for this ID)
export const saveOfflineDelete = async (id: string): Promise<string> => {
  // First, clean up any pending offline updates for this record to prevent redundant sync attempts
  try {
    const allRecords = await getOfflineRecords();
    const pendingUpdates = allRecords.filter(r => r.id === id && r.action === 'update');
    for (const r of pendingUpdates) {
      if (r.localId) {
        await deleteOfflineRecord(r.localId);
      }
    }
  } catch (err) {
    console.error('Failed to clean up pending updates before offline delete:', err);
  }

  const localId = generateUUID();
  const newRecord: ChutiRecord = {
    localId,
    id,
    user_id: '', // Dummy values to satisfy required fields
    date: '',
    leave_type: '',
    adjustment: false,
    sign_in_time: null,
    sign_out_time: null,
    leave_hour: null,
    reserve_holiday: null,
    comment: null,
    synced: false,
    action: 'delete',
  };
  await idb.addItem(STORE_NAME, newRecord);
  return localId;
};

// Retrieve all unsynced local records
export const getOfflineRecords = async (): Promise<ChutiRecord[]> => {
  return idb.getAllItems<ChutiRecord>(STORE_NAME);
};

// Delete a single record from IndexedDB
export const deleteOfflineRecord = async (localId: string): Promise<void> => {
  return idb.deleteItem(STORE_NAME, localId);
};

// Conflict info returned to the caller for UI notification
export interface SyncConflict {
  localId: string;
  recordId: string;
  action: 'update' | 'delete';
  reason: string; // Human-readable reason
}

// Sync all local records to Supabase with conflict resolution
export const syncOfflineData = async (onSyncSuccess?: (syncedCount: number) => void): Promise<{ success: boolean; syncedCount: number; conflicts: SyncConflict[]; error?: string }> => {
  if (typeof window === 'undefined' || !navigator.onLine) {
    return { success: false, syncedCount: 0, conflicts: [], error: 'Device is offline' };
  }

  if (isSyncing) {
    return { success: true, syncedCount: 0, conflicts: [] };
  }

  isSyncing = true;
  try {
    const offlineRecords = await getOfflineRecords();
    if (offlineRecords.length === 0) {
      isSyncing = false;
      return { success: true, syncedCount: 0, conflicts: [] };
    }

    let syncedCount = 0;
    const conflicts: SyncConflict[] = [];

    for (const record of offlineRecords) {
      let isSyncedSuccessfully = false;

      if (record.action === 'delete' && record.id) {
        // Check if the record still exists before deleting
        const { data: serverRecord } = await supabase
          .from('chuti')
          .select('id, status')
          .eq('id', record.id)
          .maybeSingle();

        if (!serverRecord) {
          // Record already deleted on server — just clean up local
          if (record.localId) await deleteOfflineRecord(record.localId);
          continue;
        }

        // If server already approved/rejected it while user was offline, flag a conflict
        if (serverRecord.status === 'approved' || serverRecord.status === 'approved_by_supervisor') {
          conflicts.push({
            localId: record.localId || '',
            recordId: record.id,
            action: 'delete',
            reason: 'The leave request you tried to delete offline has already been approved by an admin/supervisor. Delete action cancelled.',
          });
          if (record.localId) await deleteOfflineRecord(record.localId);
          continue;
        }

        // Soft delete: set deleted_at instead of hard-deleting so the change is
        // captured by delta sync (updated_at bumps via trigger) and other clients
        // can purge the row from their local cache.
        const { error: deleteError } = await supabase
          .from('chuti')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', record.id);

        if (deleteError) {
          console.error('Error syncing offline delete:', deleteError);
          continue;
        }
        isSyncedSuccessfully = true;

      } else if (record.action === 'update' && record.id && record.data) {
        // Conflict detection: check if server record has been modified since offline edit
        const { data: serverRecord } = await supabase
          .from('chuti')
          .select('id, status, created_at')
          .eq('id', record.id)
          .maybeSingle();

        if (!serverRecord) {
          // Record deleted on server while user was offline
          conflicts.push({
            localId: record.localId || '',
            recordId: record.id,
            action: 'update',
            reason: 'The record you edited offline has been deleted from the server. Your changes have been cancelled.',
          });
          if (record.localId) await deleteOfflineRecord(record.localId);
          continue;
        }

        // Server Wins: If the status changed on server (e.g., admin rejected it), skip local update
        const localStatusUpdate = record.data?.status;
        if (localStatusUpdate && serverRecord.status !== 'pending_supervisor' && serverRecord.status !== 'needs_review') {
          // Server has already been acted upon (approved/rejected) — don't overwrite with local change
          conflicts.push({
            localId: record.localId || '',
            recordId: record.id,
            action: 'update',
            reason: `Your offline changes have been cancelled because the admin has already changed the status of this record to "${serverRecord.status}".`,
          });
          if (record.localId) await deleteOfflineRecord(record.localId);
          continue;
        }

        const { error: updateError } = await supabase
          .from('chuti')
          .update(record.data)
          .eq('id', record.id);

        if (updateError) {
          console.error('Error syncing offline update:', updateError);
          continue;
        }
        isSyncedSuccessfully = true;

      } else {
        // Sync offline insert
        const { data: existing } = await supabase
          .from('chuti')
          .select('id')
          .eq('user_id', record.user_id)
          .eq('date', record.date)
          .is('deleted_at', null)
          .maybeSingle();

        if (!existing) {
          const { error: insertError } = await supabase.from('chuti').insert({
            user_id: record.user_id,
            date: record.date,
            leave_type: record.leave_type,
            adjustment: record.adjustment,
            sign_in_time: record.sign_in_time,
            sign_out_time: record.sign_out_time,
            leave_hour: record.leave_hour,
            reserve_holiday: record.reserve_holiday,
            comment: record.comment,
            status: record.status || 'pending_supervisor',
            adjust_short_leave: record.adjust_short_leave || false,
            reserve_adjustment_status: record.reserve_adjustment_status || 'none',
            bulk_id: record.bulk_id || null,
            admin_edit_request: record.admin_edit_request || null,
          });

          if (insertError) {
            console.error('Error syncing record:', insertError);
            continue;
          }
          isSyncedSuccessfully = true;
        } else {
          // Duplicate — clean up
          isSyncedSuccessfully = true;
          if (record.localId) {
            await deleteOfflineRecord(record.localId);
          }
          continue;
        }
      }

      // If synced successfully, delete from local DB
      if (isSyncedSuccessfully && record.localId) {
        await deleteOfflineRecord(record.localId);
        syncedCount++;
      }
    }

    if (syncedCount > 0 && onSyncSuccess) {
      onSyncSuccess(syncedCount);
    }

    isSyncing = false;
    return { success: true, syncedCount, conflicts };
  } catch (err) {
    isSyncing = false;
    console.error('Offline sync failed:', err);
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, syncedCount: 0, conflicts: [], error: message };
  }
};

// Clear and save list to cache
export const setCacheData = async (storeName: string, data: any[]): Promise<void> => {
  return idb.setCacheData(storeName, data);
};

// Retrieve list from cache
export const getCacheData = async (storeName: string): Promise<any[]> => {
  return idb.getAllItems(storeName);
};

// Upsert a single item into a cache store without clearing existing data
export const upsertCacheItem = async (storeName: string, item: any): Promise<void> => {
  return idb.putItem(storeName, item);
};

// Merge new data into cache without clearing — upserts each item individually
export const mergeCacheData = async (storeName: string, data: any[]): Promise<void> => {
  return idb.mergeCacheData(storeName, data);
};

// Remove a set of items (by key) from a cache store. Used to purge rows that
// were soft-deleted on the server (deleted_at is set) from the local cache.
export const removeCacheItems = async (storeName: string, keys: string[]): Promise<void> => {
  return idb.removeCacheItems(storeName, keys);
};

// Delta Sync metadata helpers
export const getSyncTimestamp = async (tableName: string): Promise<string | null> => {
  return idb.getSyncTimestamp(tableName);
};

export const setSyncTimestamp = async (tableName: string, timestamp: string): Promise<void> => {
  return idb.setSyncTimestamp(tableName, timestamp);
};

// TTL Cache Purge — remove records older than maxAgeDays from a cache store
export const purgeStaleCacheData = async (storeName: string, dateField: string, maxAgeDays: number = 730): Promise<number> => {
  return idb.purgeStaleCacheData(storeName, dateField, maxAgeDays);
};

// Global Settings cache helpers
export const setGlobalSettingsCache = async (settings: any): Promise<void> => {
  return idb.putItem('global_settings_cache', { key: 'settings', value: settings });
};

export const getGlobalSettingsCache = async (): Promise<any | null> => {
  const result = await idb.getItem<{ value: any }>('global_settings_cache', 'settings');
  return result ? result.value : null;
};
