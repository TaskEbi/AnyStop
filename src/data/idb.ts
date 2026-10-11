/** Tiny promise wrapper around IndexedDB: three record stores plus a key/value "meta" store. */

const STORES = ['rooms', 'items', 'connections', 'meta'] as const;
type StoreName = (typeof STORES)[number];

export interface LocalDb {
  getAll<T>(store: Exclude<StoreName, 'meta'>): Promise<T[]>;
  putMany(store: Exclude<StoreName, 'meta'>, records: { id: string }[]): Promise<void>;
  getMeta<T>(key: string): Promise<T | undefined>;
  setMeta(key: string, value: unknown): Promise<void>;
  close(): void;
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function openLocalDb(name: string): Promise<LocalDb> {
  const open = indexedDB.open(name, 1);
  open.onupgradeneeded = () => {
    const db = open.result;
    for (const s of STORES) {
      if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, s === 'meta' ? undefined : { keyPath: 'id' });
    }
  };
  const db = await req(open);

  return {
    async getAll<T>(store: Exclude<StoreName, 'meta'>) {
      return (await req(db.transaction(store).objectStore(store).getAll())) as T[];
    },
    async putMany(store, records) {
      if (!records.length) return;
      const tx = db.transaction(store, 'readwrite');
      const os = tx.objectStore(store);
      for (const r of records) os.put(r);
      await done(tx);
    },
    async getMeta<T>(key: string) {
      return (await req(db.transaction('meta').objectStore('meta').get(key))) as T | undefined;
    },
    async setMeta(key, value) {
      const tx = db.transaction('meta', 'readwrite');
      tx.objectStore('meta').put(value, key);
      await done(tx);
    },
    close: () => db.close(),
  };
}

export function deleteLocalDb(name: string): Promise<void> {
  return new Promise((resolve) => {
    const r = indexedDB.deleteDatabase(name);
    r.onsuccess = r.onerror = r.onblocked = () => resolve();
  });
}
