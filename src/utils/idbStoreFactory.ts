// Shared IndexedDB store factory used by both offline-sync utilities
// (offlineSync.ts = leave tracker DB, quotesOfflineSync.ts = quotes DB).
// Each domain file creates its own DB instance via createIdbStore() and keeps
// its own domain-specific record shapes and syncOfflineData() business logic.

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

export interface IdbStoreConfig {
  dbName: string;
  dbVersion: number;
  // storeName -> keyPath, created on upgrade if missing
  stores: Record<string, string>;
}

export const createIdbStore = (config: IdbStoreConfig) => {
  const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(config.dbName, config.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = () => {
        const db = request.result;
        Object.entries(config.stores).forEach(([name, keyPath]) => {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath });
          }
        });
      };
    });
  };

  // Run a single-request operation inside a transaction and close the DB after
  const withStore = <T>(
    storeName: string,
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void
  ): Promise<T> => {
    return openDB().then(db => new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      transaction.oncomplete = () => db.close();
      transaction.onerror = () => db.close();

      fn(transaction.objectStore(storeName), resolve, reject);
    }));
  };

  // Add a new item (fails on key collision)
  const addItem = <T>(storeName: string, item: T): Promise<void> =>
    withStore(storeName, 'readwrite', (store, resolve, reject) => {
      const request = store.add(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

  // Retrieve every item in a store
  const getAllItems = <T>(storeName: string): Promise<T[]> =>
    withStore(storeName, 'readonly', (store, resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

  // Get a single item by key
  const getItem = <T>(storeName: string, key: IDBValidKey): Promise<T | undefined> =>
    withStore(storeName, 'readonly', (store, resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

  // Upsert a single item (put = insert or update by keyPath)
  const putItem = <T>(storeName: string, item: T): Promise<void> =>
    withStore(storeName, 'readwrite', (store, resolve, reject) => {
      const request = store.put(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

  // Delete a single item by key
  const deleteItem = (storeName: string, key: IDBValidKey): Promise<void> =>
    withStore(storeName, 'readwrite', (store, resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

  // Put many items in one transaction, resolving when all complete
  const putMany = <T>(store: IDBObjectStore, data: T[], resolve: () => void, reject: (reason?: unknown) => void) => {
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

  // Clear a store then save the given list
  const setCacheData = <T>(storeName: string, data: T[]): Promise<void> =>
    withStore(storeName, 'readwrite', (store, resolve, reject) => {
      const clearRequest = store.clear();
      clearRequest.onsuccess = () => {
        if (!data || data.length === 0) {
          resolve();
          return;
        }
        putMany(store, data, () => resolve(), reject);
      };
      clearRequest.onerror = () => reject(clearRequest.error);
    });

  // Merge new data into cache without clearing — upserts each item individually
  const mergeCacheData = <T>(storeName: string, data: T[]): Promise<void> => {
    if (!data || data.length === 0) return Promise.resolve();
    return withStore(storeName, 'readwrite', (store, resolve, reject) => {
      putMany(store, data, () => resolve(), reject);
    });
  };

  // Remove a set of items (by key) from a cache store
  const removeCacheItems = (storeName: string, keys: string[]): Promise<void> => {
    if (!keys || keys.length === 0) return Promise.resolve();
    return withStore(storeName, 'readwrite', (store, resolve, reject) => {
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

  // TTL Cache Purge — remove records older than maxAgeDays from a cache store
  const purgeStaleCacheData = (storeName: string, dateField: string, maxAgeDays: number = 730): Promise<number> =>
    withStore(storeName, 'readwrite', (store, resolve, reject) => {
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

  // Delta Sync metadata helpers (sync_metadata store, keyPath 'table_name')
  const getSyncTimestamp = async (tableName: string): Promise<string | null> => {
    const result = await getItem<{ last_synced_at: string }>('sync_metadata', tableName);
    return result ? result.last_synced_at : null;
  };

  const setSyncTimestamp = (tableName: string, timestamp: string): Promise<void> =>
    putItem('sync_metadata', { table_name: tableName, last_synced_at: timestamp });

  // Clear every listed store in one transaction
  const clearStores = (storeNames: string[]): Promise<void> => {
    return openDB().then(db => new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storeNames, 'readwrite');
      transaction.oncomplete = () => db.close();
      transaction.onerror = () => db.close();

      let errorOccurred = false;
      let pendingCount = storeNames.length;

      storeNames.forEach(storeName => {
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
    }));
  };

  return {
    openDB,
    addItem,
    getAllItems,
    getItem,
    putItem,
    deleteItem,
    setCacheData,
    mergeCacheData,
    removeCacheItems,
    purgeStaleCacheData,
    getSyncTimestamp,
    setSyncTimestamp,
    clearStores,
  };
};
