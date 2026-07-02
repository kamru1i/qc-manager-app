import { supabase } from './supabase';

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

const DB_NAME = 'ChutiOfflineDB';
const DB_VERSION = 3;
const STORE_NAME = 'pending_chuti';

// Secure context safe UUID generator helper
export const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Helper to open IndexedDB
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'localId' });
      }
      if (!db.objectStoreNames.contains('profiles_cache')) {
        db.createObjectStore('profiles_cache', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('chuti_cache')) {
        db.createObjectStore('chuti_cache', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('holiday_responses_cache')) {
        db.createObjectStore('holiday_responses_cache', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('settlements_cache')) {
        db.createObjectStore('settlements_cache', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('global_settings_cache')) {
        db.createObjectStore('global_settings_cache', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('sync_metadata')) {
        db.createObjectStore('sync_metadata', { keyPath: 'table_name' });
      }
    };
  });
};

// Save a record to IndexedDB
export const saveOfflineRecord = async (record: Omit<ChutiRecord, 'localId' | 'synced'>): Promise<string> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => db.close();

    const store = transaction.objectStore(STORE_NAME);
    const localId = generateUUID();
    const newRecord: ChutiRecord = {
      ...record,
      localId,
      synced: false,
      action: 'insert',
    };

    const request = store.add(newRecord);
    request.onsuccess = () => resolve(localId);
    request.onerror = () => reject(request.error);
  });
};

// Save an update record to IndexedDB
export const saveOfflineUpdate = async (id: string, updates: Partial<Omit<ChutiRecord, 'localId' | 'synced'>>): Promise<string> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => db.close();

    const store = transaction.objectStore(STORE_NAME);
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

    const request = store.add(newRecord);
    request.onsuccess = () => resolve(localId);
    request.onerror = () => reject(request.error);
  });
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

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => db.close();

    const store = transaction.objectStore(STORE_NAME);
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

    const request = store.add(newRecord);
    request.onsuccess = () => resolve(localId);
    request.onerror = () => reject(request.error);
  });
};

// Retrieve all unsynced local records
export const getOfflineRecords = async (): Promise<ChutiRecord[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => db.close();

    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
};

// Delete a single record from IndexedDB
export const deleteOfflineRecord = async (localId: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => db.close();

    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(localId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
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

    return { success: true, syncedCount, conflicts };
  } catch (err) {
    console.error('Offline sync failed:', err);
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, syncedCount: 0, conflicts: [], error: message };
  }
};

// Clear and save list to cache
export const setCacheData = async (storeName: string, data: any[]): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => db.close();

    const store = transaction.objectStore(storeName);

    // Clear existing cache items
    const clearRequest = store.clear();
    clearRequest.onsuccess = () => {
      // If no data to add, resolve immediately
      if (!data || data.length === 0) {
        resolve();
        return;
      }

      let errorOccurred = false;
      let pendingCount = data.length;

      data.forEach(item => {
        if (!item) {
          pendingCount--;
          if (pendingCount === 0 && !errorOccurred) {
            resolve();
          }
          return;
        }
        const request = store.put(item);
        request.onsuccess = () => {
          pendingCount--;
          if (pendingCount === 0 && !errorOccurred) {
            resolve();
          }
        };
        request.onerror = () => {
          errorOccurred = true;
          reject(request.error);
        };
      });
    };
    clearRequest.onerror = () => reject(clearRequest.error);
  });
};

// Retrieve list from cache
export const getCacheData = async (storeName: string): Promise<any[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => db.close();

    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
};

// Upsert a single item into a cache store without clearing existing data
export const upsertCacheItem = async (storeName: string, item: any): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => db.close();

    const store = transaction.objectStore(storeName);
    const request = store.put(item); // put = upsert (insert or update by keyPath)
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// Merge new data into cache without clearing — upserts each item individually
export const mergeCacheData = async (storeName: string, data: any[]): Promise<void> => {
  if (!data || data.length === 0) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => db.close();

    const store = transaction.objectStore(storeName);
    let errorOccurred = false;
    let pendingCount = data.length;

    data.forEach(item => {
      if (!item) {
        pendingCount--;
        if (pendingCount === 0 && !errorOccurred) resolve();
        return;
      }
      const request = store.put(item);
      request.onsuccess = () => {
        pendingCount--;
        if (pendingCount === 0 && !errorOccurred) resolve();
      };
      request.onerror = () => {
        errorOccurred = true;
        reject(request.error);
      };
    });
  });
};

// Remove a set of items (by key) from a cache store. Used to purge rows that
// were soft-deleted on the server (deleted_at is set) from the local cache.
export const removeCacheItems = async (storeName: string, keys: string[]): Promise<void> => {
  if (!keys || keys.length === 0) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => db.close();

    const store = transaction.objectStore(storeName);
    let errorOccurred = false;
    let pendingCount = keys.length;

    keys.forEach(key => {
      if (key === undefined || key === null) {
        pendingCount--;
        if (pendingCount === 0 && !errorOccurred) resolve();
        return;
      }
      const request = store.delete(key);
      request.onsuccess = () => {
        pendingCount--;
        if (pendingCount === 0 && !errorOccurred) resolve();
      };
      request.onerror = () => {
        errorOccurred = true;
        reject(request.error);
      };
    });
  });
};

// Delta Sync metadata helpers
export const getSyncTimestamp = async (tableName: string): Promise<string | null> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('sync_metadata', 'readonly');
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => db.close();

    const store = transaction.objectStore('sync_metadata');
    const request = store.get(tableName);
    request.onsuccess = () => resolve(request.result ? request.result.last_synced_at : null);
    request.onerror = () => reject(request.error);
  });
};

export const setSyncTimestamp = async (tableName: string, timestamp: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('sync_metadata', 'readwrite');
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => db.close();

    const store = transaction.objectStore('sync_metadata');
    const request = store.put({ table_name: tableName, last_synced_at: timestamp });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// TTL Cache Purge — remove records older than maxAgeDays from a cache store
export const purgeStaleCacheData = async (storeName: string, dateField: string, maxAgeDays: number = 730): Promise<number> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => db.close();

    const store = transaction.objectStore(storeName);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);
    const cutoffStr = cutoffDate.toISOString();

    const getAllReq = store.getAll();
    getAllReq.onsuccess = () => {
      const all = getAllReq.result || [];
      let purgedCount = 0;
      let pendingDeletes = 0;
      const staleItems = all.filter(item => {
        const dateVal = item[dateField];
        return dateVal && dateVal < cutoffStr;
      });

      if (staleItems.length === 0) {
        resolve(0);
        return;
      }

      pendingDeletes = staleItems.length;
      staleItems.forEach(item => {
        const keyPath = store.keyPath as string;
        const deleteReq = store.delete(item[keyPath]);
        deleteReq.onsuccess = () => {
          purgedCount++;
          pendingDeletes--;
          if (pendingDeletes === 0) resolve(purgedCount);
        };
        deleteReq.onerror = () => {
          pendingDeletes--;
          if (pendingDeletes === 0) resolve(purgedCount);
        };
      });
    };
    getAllReq.onerror = () => reject(getAllReq.error);
  });
};

// Global Settings cache helpers
export const setGlobalSettingsCache = async (settings: any): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('global_settings_cache', 'readwrite');
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => db.close();

    const store = transaction.objectStore('global_settings_cache');
    const request = store.put({ key: 'settings', value: settings });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getGlobalSettingsCache = async (): Promise<any | null> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('global_settings_cache', 'readonly');
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => db.close();

    const store = transaction.objectStore('global_settings_cache');
    const request = store.get('settings');
    request.onsuccess = () => resolve(request.result ? request.result.value : null);
    request.onerror = () => reject(request.error);
  });
};
