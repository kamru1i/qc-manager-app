// Quotes offline sync module — uses shared offlineSyncFactory for IDB operations
import { supabase } from './supabase';
import { RecordItem, FileType } from '@/types';
import { createOfflineSyncManager, logDeadLetter, MAX_SYNC_RETRIES, generateUUID, SyncConflict } from './offlineSyncFactory';

export type { SyncConflict };

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
  _retryCount?: number;
}

const STORE_NAME = 'pending_records';

export const manager = createOfflineSyncManager<PendingRecordAction>({
  dbName: 'QuotesOfflineDB',
  dbVersion: 1,
  storeName: STORE_NAME,
  stores: {
    [STORE_NAME]: 'localId',
    records_cache: 'id',
    profiles_cache: 'id',
    user_profile_cache: 'id',
    sync_metadata: 'table_name',
  },
});

export const getOfflineRecords = manager.getOfflineRecords;
export const deleteOfflineRecord = manager.deleteOfflineRecord;
export const setCacheData = manager.setCacheData;
export const getCacheData = manager.getCacheData;
export const upsertCacheItem = manager.upsertCacheItem;
export const mergeCacheData = manager.mergeCacheData;
export const removeCacheItems = manager.removeCacheItems;
export const getSyncTimestamp = manager.getSyncTimestamp;
export const setSyncTimestamp = manager.setSyncTimestamp;
export const purgeStaleCacheData = manager.purgeStaleCacheData;

// Save a record creation to IndexedDB
export const saveOfflineRecord = async (record: Omit<PendingRecordAction, 'localId' | 'synced' | 'action'>): Promise<string> => {
  return manager.saveOfflineRecord(record as any);
};

// Save a record update to IndexedDB
export const saveOfflineUpdate = async (id: string, userId: string, updates: Partial<Omit<RecordItem, 'id' | 'profiles'>>): Promise<string> => {
  const dummyData = {
    user_id: userId,
    file_name: updates.file_name || '',
    branch_name: updates.branch_name || '',
    codename: updates.codename || '',
    file_type: updates.file_type || 'Quote',
    submitted_at: updates.submitted_at || new Date().toISOString(),
    data: updates,
  };
  return manager.saveOfflineUpdate(id, dummyData as any);
};

// Save a delete action to IndexedDB (and clean up pending updates)
export const saveOfflineDelete = async (id: string, userId: string): Promise<string> => {
  const dummyData = {
    user_id: userId,
    file_name: '',
    branch_name: '',
    codename: '',
    file_type: 'Quote' as FileType,
    submitted_at: new Date().toISOString(),
  };
  return manager.saveOfflineDelete(id, dummyData as any);
};

// Delete a single key from a specific cache store
export const deleteCacheItem = async (storeName: string, id: string): Promise<void> => {
  return manager.idb.deleteItem(storeName, id);
};



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
          const retries = (record._retryCount || 0) + 1;
          if (retries >= MAX_SYNC_RETRIES && record.localId) {
            logDeadLetter('QuotesOfflineSync', 'delete', { ...record, _retryCount: retries }, deleteError);
            await deleteOfflineRecord(record.localId);
          } else if (record.localId) {
            await manager.idb.putItem(STORE_NAME, { ...record, _retryCount: retries });
          }
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
          const retries = (record._retryCount || 0) + 1;
          if (retries >= MAX_SYNC_RETRIES && record.localId) {
            logDeadLetter('QuotesOfflineSync', 'update', { ...record, _retryCount: retries }, updateError);
            await deleteOfflineRecord(record.localId);
          } else if (record.localId) {
            await manager.idb.putItem(STORE_NAME, { ...record, _retryCount: retries });
          }
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
          // 23505 = unique_violation on uq_records_user_file_submitted: this exact
          // record already exists on the server (e.g. the outbox entry survived a
          // successful earlier sync). Treat as synced so it isn't retried forever.
          if (insertError.code === '23505') {
            isSyncedSuccessfully = true;
          } else {
            console.error('Error syncing offline record:', insertError);
            const retries = (record._retryCount || 0) + 1;
            if (retries >= MAX_SYNC_RETRIES && record.localId) {
              logDeadLetter('QuotesOfflineSync', 'insert', { ...record, _retryCount: retries }, insertError);
              await deleteOfflineRecord(record.localId);
            } else if (record.localId) {
              await manager.idb.putItem(STORE_NAME, { ...record, _retryCount: retries });
            }
            continue;
          }
        } else {
          isSyncedSuccessfully = true;
        }
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

// Update an offline pending action in-place
export const updateOfflineRecordAction = async (localId: string, updates: Partial<Omit<PendingRecordAction, 'localId'>>): Promise<void> => {
  const item = await manager.idb.getItem<PendingRecordAction>(STORE_NAME, localId);
  if (!item) return;

  const updatedItem = { ...item, ...updates };
  // Merge updates data if it's an update action
  if (item.action === 'update' && item.data && updates.data) {
    updatedItem.data = { ...item.data, ...updates.data };
  }
  await manager.idb.putItem(STORE_NAME, updatedItem);
};

// Clear all data from all cache stores and metadata
export const clearAllCache = async (): Promise<void> => {
  return manager.idb.clearStores(['records_cache', 'profiles_cache', 'user_profile_cache', 'sync_metadata', 'pending_records']);
};
