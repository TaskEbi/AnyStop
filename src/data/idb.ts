/** Tiny promise wrapper around IndexedDB: one store per record table plus key/value "meta" and "blobs" stores. */
import { TABLES, type TableName } from './types';

const STORES = [...TABLES, 'meta', 'blobs'] as const;
/** 2 → 3 adds the Daily Log stores. Upgrades only ever add missing stores, so nothing is lost. */
const VERSION = 3;

type RecordStore = TableName;

export interface LocalDb {
  getAll<T>(store: RecordStore): Promise<T[]>;
  putMany(store: RecordStore, records: { id: string }[]): Promise<void>;
  getBlob(key: string): Promise<Blob | undefined>;
  putBlob(key: string, blob: Blob): Promise<void>;
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
  const open = indexedDB.open(name, VERSION);
  open.onupgradeneeded = () => {
    const db = open.result;
    for (const s of STORES) {
      if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, s === 'meta' || s === 'blobs' ? undefined : { keyPath: 'id' });
    }
  };
  const db = await req(open);
  // A newer version of the app opened in another tab wants to upgrade: step aside and reload into it.
  db.onversionchange = () => {
    db.close();
    location.reload();
  };

  return {
    async getAll<T>(store: RecordStore) {
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
    async getBlob(key) {
      return (await req(db.transaction('blobs').objectStore('blobs').get(key))) as Blob | undefined;
    },
    async putBlob(key, blob) {
      const tx = db.transaction('blobs', 'readwrite');
      tx.objectStore('blobs').put(blob, key);
      await done(tx);
    },
    close: () => db.close(),
  };
}
