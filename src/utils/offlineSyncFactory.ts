import { createIdbStore, generateUUID } from './idbStoreFactory';

export { generateUUID };

export const MAX_SYNC_RETRIES = 3;

/** Conflict info returned to the caller for UI notification */
export interface SyncConflict {
  localId: string;
  recordId: string;
  action: 'update' | 'delete';
  reason: string; // Human-readable reason
}

export function logDeadLetter(module: string, action: string, record: { localId?: string; id?: string; _retryCount?: number }, error: unknown) {
  console.error(`[${module}] Dead-letter: permanently dropping ${action} after ${record._retryCount ?? 0} retries`, {
    localId: record.localId,
    remoteId: record.id,
    action,
    error: error instanceof Error ? error.message : String(error),
    timestamp: new Date().toISOString(),
  });
}

export interface BaseRecord {
  localId?: string;
  id?: string;
  synced?: boolean;
  action?: 'insert' | 'update' | 'delete';
  _retryCount?: number;
}

export interface OfflineSyncFactoryConfig<TRecord extends BaseRecord> {
  dbName: string;
  dbVersion: number;
  storeName: string;
  stores: Record<string, string>;
}

export function createOfflineSyncManager<TRecord extends BaseRecord>(config: OfflineSyncFactoryConfig<TRecord>) {
  const idb = createIdbStore({
    dbName: config.dbName,
    dbVersion: config.dbVersion,
    stores: config.stores,
  });

  const getOfflineRecords = async (): Promise<TRecord[]> => {
    return idb.getAllItems<TRecord>(config.storeName);
  };

  const deleteOfflineRecord = async (localId: string): Promise<void> => {
    return idb.deleteItem(config.storeName, localId);
  };

  const saveOfflineRecord = async (record: Omit<TRecord, 'localId' | 'synced' | 'action'> & { action?: 'insert' | 'update' | 'delete' }): Promise<string> => {
    const localId = generateUUID();
    const newRecord = {
      ...record,
      localId,
      synced: false,
      action: record.action || 'insert',
    } as unknown as TRecord;
    await idb.addItem(config.storeName, newRecord);
    return localId;
  };

  const saveOfflineUpdate = async (id: string, recordPayload: Partial<TRecord>): Promise<string> => {
    const localId = generateUUID();
    const newRecord = {
      ...recordPayload,
      localId,
      id,
      synced: false,
      action: 'update',
    } as unknown as TRecord;
    await idb.addItem(config.storeName, newRecord);
    return localId;
  };

  const saveOfflineDelete = async (id: string, deletePayload: Partial<TRecord>): Promise<string> => {
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
    const newRecord = {
      ...deletePayload,
      localId,
      id,
      synced: false,
      action: 'delete',
    } as unknown as TRecord;
    await idb.addItem(config.storeName, newRecord);
    return localId;
  };

  const setCacheData = async <T = any>(storeName: string, data: T[]): Promise<void> => {
    return idb.setCacheData(storeName, data);
  };

  const getCacheData = async <T = any>(storeName: string): Promise<T[]> => {
    return idb.getAllItems<T>(storeName);
  };

  const upsertCacheItem = async <T = any>(storeName: string, item: T): Promise<void> => {
    return idb.putItem(storeName, item);
  };

  const mergeCacheData = async <T = any>(storeName: string, data: T[]): Promise<void> => {
    return idb.mergeCacheData(storeName, data);
  };

  const removeCacheItems = async (storeName: string, keys: string[]): Promise<void> => {
    return idb.removeCacheItems(storeName, keys);
  };

  const getSyncTimestamp = async (tableName: string): Promise<string | null> => {
    return idb.getSyncTimestamp(tableName);
  };

  const setSyncTimestamp = async (tableName: string, timestamp: string): Promise<void> => {
    return idb.setSyncTimestamp(tableName, timestamp);
  };

  const purgeStaleCacheData = async (storeName: string, dateField: string, maxAgeDays: number = 730): Promise<number> => {
    return idb.purgeStaleCacheData(storeName, dateField, maxAgeDays);
  };

  return {
    idb,
    getOfflineRecords,
    deleteOfflineRecord,
    saveOfflineRecord,
    saveOfflineUpdate,
    saveOfflineDelete,
    setCacheData,
    getCacheData,
    upsertCacheItem,
    mergeCacheData,
    removeCacheItems,
    getSyncTimestamp,
    setSyncTimestamp,
    purgeStaleCacheData,
  };
}
