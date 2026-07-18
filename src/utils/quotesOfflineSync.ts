import { supabase } from './supabase';
import { RecordItem, FileType } from '@/types';
import { createIdbStore, generateUUID } from './idbStoreFactory';

export { generateUUID };

export interface PendingRecordAction {
  localId?: string; // local temporary UUID key
  id?: string; // remote Supabase ID (for update/delete)
  user_id: string;
  file_name: string;
  branch_name: string;
  codename: string;
  file_type: FileType;
  submitted_at: string;
  action: 'insert' | 'update' | 'delete';
  data?: Partial<Omit<RecordItem, 'id' | 'profiles'>>;
  synced: boolean;
}

const STORE_NAME = 'pending_records';

const idb = createIdbStore({
  dbName: 'QuotesOfflineDB',
  dbVersion: 1,
  stores: {
    [STORE_NAME]: 'localId',
    records_cache: 'id',
    profiles_cache: 'id',
    user_profile_cache: 'id',
    sync_metadata: 'table_name',
  },
});

// Save a record creation to IndexedDB
export const saveOfflineRecord = async (record: Omit<PendingRecordAction, 'localId' | 'synced' | 'action'>): Promise<string> => {
  const localId = generateUUID();
  const newRecord: PendingRecordAction = {
    ...record,
    localId,
    synced: false,
    action: 'insert',
  };
  await idb.addItem(STORE_NAME, newRecord);
  return localId;
};

// Save a record update to IndexedDB
export const saveOfflineUpdate = async (id: string, userId: string, updates: Partial<Omit<RecordItem, 'id' | 'profiles'>>): Promise<string> => {
  const localId = generateUUID();
  const newRecord: PendingRecordAction = {
    localId,
    id,
    user_id: userId,
    file_name: updates.file_name || '',
    branch_name: updates.branch_name || '',
    codename: updates.codename || '',
    file_type: updates.file_type || 'Quote',
    submitted_at: updates.submitted_at || new Date().toISOString(),
    synced: false,
    action: 'update',
    data: updates,
  };
  await idb.addItem(STORE_NAME, newRecord);
  return localId;
};

// Save a delete action to IndexedDB (and clean up pending updates)
export const saveOfflineDelete = async (id: string, userId: string): Promise<string> => {
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
  const newRecord: PendingRecordAction = {
    localId,
    id,
    user_id: userId,
    file_name: '',
    branch_name: '',
    codename: '',
    file_type: 'Quote',
    submitted_at: new Date().toISOString(),
    synced: false,
    action: 'delete',
  };
  await idb.addItem(STORE_NAME, newRecord);
  return localId;
};

// Retrieve all unsynced local records
export const getOfflineRecords = async (): Promise<PendingRecordAction[]> => {
  return idb.getAllItems<PendingRecordAction>(STORE_NAME);
};

// Delete a single record from the pending outbox database
export const deleteOfflineRecord = async (localId: string): Promise<void> => {
  return idb.deleteItem(STORE_NAME, localId);
};

// Delete a single key from a specific cache store
export const deleteCacheItem = async (storeName: string, id: string): Promise<void> => {
  return idb.deleteItem(storeName, id);
};

export interface SyncConflict {
  localId: string;
  recordId: string;
  action: 'update' | 'delete';
  reason: string;
}

let isSyncing = false;

// Sync all local records to Supabase with conflict resolution (Server Wins)
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
      return { success: true, syncedCount: 0, conflicts: [] };
    }

    let syncedCount = 0;
    const conflicts: SyncConflict[] = [];

    for (const record of offlineRecords) {
      let isSyncedSuccessfully = false;

      if (record.action === 'delete' && record.id) {
        // Conflict Check: Check if record exists on server before deleting
        const { data: serverRecord } = await supabase
          .from('records')
          .select('id')
          .eq('id', record.id)
          .maybeSingle();

        if (!serverRecord) {
          // Already deleted on server
          if (record.localId) await deleteOfflineRecord(record.localId);
          continue;
        }

        const { error: deleteError } = await supabase
          .from('records')
          .delete()
          .eq('id', record.id);

        if (deleteError) {
          console.error('Error syncing offline delete:', deleteError);
          continue;
        }
        isSyncedSuccessfully = true;

      } else if (record.action === 'update' && record.id && record.data) {
        // Conflict detection: check if server record has been modified or deleted
        const { data: serverRecord } = await supabase
          .from('records')
          .select('id')
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

        const { error: updateError } = await supabase
          .from('records')
          .update(record.data)
          .eq('id', record.id);

        if (updateError) {
          console.error('Error syncing offline update:', updateError);
          continue;
        }
        isSyncedSuccessfully = true;

      } else {
        // Sync offline insert
        const { error: insertError } = await supabase.from('records').insert({
          user_id: record.user_id,
          file_name: record.file_name,
          branch_name: record.branch_name,
          codename: record.codename,
          file_type: record.file_type,
          submitted_at: record.submitted_at,
        });

        if (insertError) {
          console.error('Error syncing offline record:', insertError);
          continue;
        }
        isSyncedSuccessfully = true;
      }

      if (isSyncedSuccessfully && record.localId) {
        await deleteOfflineRecord(record.localId);
        if (record.action === 'insert') {
          await deleteCacheItem('records_cache', record.localId);
        }
        syncedCount++;
      }
    }

    if (syncedCount > 0 && onSyncSuccess) {
      onSyncSuccess(syncedCount);
    }

    return { success: true, syncedCount, conflicts };
  } catch (err) {
    console.error('Offline sync failed:', err);
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, syncedCount: 0, conflicts: [], error: message };
  } finally {
    isSyncing = false;
  }
};

// Clear and save list to cache store
export const setCacheData = async <T>(storeName: string, data: T[]): Promise<void> => {
  return idb.setCacheData(storeName, data);
};

// Retrieve cached data list
export const getCacheData = async <T>(storeName: string): Promise<T[]> => {
  return idb.getAllItems<T>(storeName);
};

// Merge delta values into the cache
export const mergeCacheData = async <T>(storeName: string, data: T[]): Promise<void> => {
  return idb.mergeCacheData(storeName, data);
};

// Sync metadata timestamp helpers
export const getSyncTimestamp = async (tableName: string): Promise<string | null> => {
  return idb.getSyncTimestamp(tableName);
};

export const setSyncTimestamp = async (tableName: string, timestamp: string): Promise<void> => {
  return idb.setSyncTimestamp(tableName, timestamp);
};

// Update an offline pending action in-place
export const updateOfflineRecordAction = async (localId: string, updates: Partial<Omit<PendingRecordAction, 'localId'>>): Promise<void> => {
  const item = await idb.getItem<PendingRecordAction>(STORE_NAME, localId);
  if (!item) return;

  const updatedItem = { ...item, ...updates };
  // Merge updates data if it's an update action
  if (item.action === 'update' && item.data && updates.data) {
    updatedItem.data = { ...item.data, ...updates.data };
  }
  await idb.putItem(STORE_NAME, updatedItem);
};

// TTL Cache Purging
export const purgeStaleCacheData = async (storeName: string, dateField: string, maxAgeDays: number = 730): Promise<number> => {
  return idb.purgeStaleCacheData(storeName, dateField, maxAgeDays);
};

// Clear all data from all cache stores and metadata
export const clearAllCache = async (): Promise<void> => {
  return idb.clearStores(['records_cache', 'profiles_cache', 'user_profile_cache', 'sync_metadata', 'pending_records']);
};
