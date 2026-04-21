// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface PersistedSession {
  sessionId: string;
  messages: ChatMessage[];
  updatedAt: number;
}

// ─── IndexedDB internals ──────────────────────────────────────────────────────

const DB_NAME = "goalmind-chat";
const DB_VERSION = 1;
const STORE = "sessions";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "sessionId" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function loadSession(
  sessionId: string,
): Promise<ChatMessage[] | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(sessionId) as IDBRequest<
      PersistedSession | undefined
    >;
    req.onsuccess = () => resolve(req.result?.messages ?? null);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function saveSession(
  sessionId: string,
  messages: ChatMessage[],
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const record: PersistedSession = {
      sessionId,
      messages,
      updatedAt: Date.now(),
    };
    const req = tx.objectStore(STORE).put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

export async function clearSession(sessionId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).delete(sessionId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}
