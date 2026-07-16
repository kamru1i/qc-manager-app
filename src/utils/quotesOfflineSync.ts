import { supabase } from './supabase';
import { RecordItem, FileType } from '@/types';

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

const DB_NAME = 'QuotesOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'pending_records';

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
      if (!db.objectStoreNames.contains('records_cache')) {
        db.createObjectStore('records_cache', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('profiles_cache')) {
        db.createObjectStore('profiles_cache', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('user_profile_cache')) {
        db.createObjectStore('user_profile_cache', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('sync_metadata')) {
        db.createObjectStore('sync_metadata', { keyPath: 'table_name' });
      }
    };
  });
};

// Save a record creation to IndexedDB
export const saveOfflineRecord = async (record: Omit<PendingRecordAction, 'localId' | 'synced' | 'action'>): Promise<string> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => db.close();
    
    const store = transaction.objectStore(STORE_NAME);
    const localId = generateUUID();
    const newRecord: PendingRecordAction = {
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

// Save a record update to IndexedDB
export const saveOfflineUpdate = async (id: string, userId: string, updates: Partial<Omit<RecordItem, 'id' | 'profiles'>>): Promise<string> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => db.close();
    
    const store = transaction.objectStore(STORE_NAME);
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

    const request = store.add(newRecord);
    request.onsuccess = () => resolve(localId);
    request.onerror = () => reject(request.error);
  });
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

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => db.close();
    
    const store = transaction.objectStore(STORE_NAME);
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

    const request = store.add(newRecord);
    request.onsuccess = () => resolve(localId);
    request.onerror = () => reject(request.error);
  });
};

// Retrieve all unsynced local records
export const getOfflineRecords = async (): Promise<PendingRecordAction[]> => {
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

// Delete a single record from the pending outbox database
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

// Delete a single key from a specific cache store
export const deleteCacheItem = async (storeName: string, id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => db.close();
    
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
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
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => db.close();

    const store = transaction.objectStore(storeName);
    const clearRequest = store.clear();
    clearRequest.onsuccess = () => {
      if (!data || data.length === 0) {
        resolve();
        return;
      }
      
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
    };
    clearRequest.onerror = () => reject(clearRequest.error);
  });
};

// Retrieve cached data list
export const getCacheData = async <T>(storeName: string): Promise<T[]> => {
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

// Merge delta values into the cache
export const mergeCacheData = async <T>(storeName: string, data: T[]): Promise<void> => {
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

// Sync metadata timestamp helpers
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

// Update an offline pending action in-place
export const updateOfflineRecordAction = async (localId: string, updates: Partial<Omit<PendingRecordAction, 'localId'>>): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => db.close();
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(localId);
    getRequest.onsuccess = () => {
      const item = getRequest.result;
      if (item) {
        const updatedItem = { ...item, ...updates };
        // Merge updates data if it's an update action
        if (item.action === 'update' && item.data && updates.data) {
          updatedItem.data = { ...item.data, ...updates.data };
        }
        const putRequest = store.put(updatedItem);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        resolve();
      }
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
};

// TTL Cache Purging
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
      const staleItems = all.filter(item => {
        const dateVal = item[dateField];
        return dateVal && dateVal < cutoffStr;
      });

      if (staleItems.length === 0) {
        resolve(0);
        return;
      }

      let pendingDeletes = staleItems.length;
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

// Clear all data from all cache stores and metadata
export const clearAllCache = async (): Promise<void> => {
  const db = await openDB();
  const stores = ['records_cache', 'profiles_cache', 'user_profile_cache', 'sync_metadata', 'pending_records'];
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(stores, 'readwrite');
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => db.close();

    let errorOccurred = false;
    let pendingCount = stores.length;

    stores.forEach(storeName => {
      const store = transaction.objectStore(storeName);
      const request = store.clear();
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
