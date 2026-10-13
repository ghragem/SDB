// Fila de capturas feitas sem internet (IndexedDB, no aparelho). Mesmo esquema usado por public/offline.html.
// O banco continua sendo a source of truth: a fila só guarda até conseguir subir.

export type QueuedCapture = {
  id: string;
  kind: string;          // tipo da Inbox (nota, ideia, despesa…); áudio vira "audio"
  body: string;
  amount?: number | null;
  audio?: Blob | null;
  mime?: string | null;
  durationSec?: number | null;
  createdAt: string;
};

const DB = "sdb-offline";
const STORE = "queue";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); resolve(r.result); };
    t.onerror = () => { db.close(); reject(t.error); };
  });
}

export const offlineSupported = () => typeof indexedDB !== "undefined";

export function enqueue(item: Omit<QueuedCapture, "id" | "createdAt">) {
  const full: QueuedCapture = { ...item, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  return tx("readwrite", (s) => s.put(full)).then(() => full);
}

export const listQueued = () => tx<QueuedCapture[]>("readonly", (s) => s.getAll() as IDBRequest<QueuedCapture[]>);
export const removeQueued = (id: string) => tx("readwrite", (s) => s.delete(id));
