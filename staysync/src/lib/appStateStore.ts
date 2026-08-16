"use client";

/**
 * High-Performance Persistent Application State Store (IndexedDB + Synchronous In-Memory Mirror)
 * Designed for Native Android-like Frame 0 (<0-10ms) state restoration across session restarts.
 */

const DB_NAME = 'RalivingPwaDB';
const DB_VERSION = 1;
const STORE_NAME = 'app_state';

// Synchronous in-memory snapshot layer for zero-latency frame 0 hydration
const memoryStateCache: Record<string, any> = {};

// Helper: Seed memory cache from synchronous localStorage fallbacks on client boot
if (typeof window !== 'undefined') {
  try {
    const rawCache = localStorage.getItem('raliving_pwa_mem_state');
    if (rawCache) {
      const parsed = JSON.parse(rawCache);
      Object.assign(memoryStateCache, parsed);
    }
  } catch (e) {
    // Graceful fallback
  }
}

// Open IndexedDB Connection Promise
let dbPromise: Promise<IDBDatabase> | null = null;

function getIDB(): Promise<IDBDatabase> {
  if (typeof window === 'undefined') return Promise.reject('SSR environment');
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = (event: any) => {
        resolve(event.target.result);
      };

      request.onerror = (event: any) => {
        console.warn('[AppStateStore] IndexedDB open error:', event.target.error);
        reject(event.target.error);
      };
    } catch (err) {
      reject(err);
    }
  });

  return dbPromise;
}

/**
 * Hydrate state from IndexedDB into synchronous memory cache on app boot.
 */
export async function initAppStateStore(): Promise<Record<string, any>> {
  if (typeof window === 'undefined') return memoryStateCache;

  try {
    const db = await getIDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    
    return new Promise((resolve) => {
      const request = store.openCursor();
      request.onsuccess = (event: any) => {
        const cursor = event.target.result;
        if (cursor) {
          memoryStateCache[cursor.key as string] = cursor.value;
          cursor.continue();
        } else {
          // Persist snapshot to quick localStorage backup for frame 0 restoration
          try {
            localStorage.setItem('raliving_pwa_mem_state', JSON.stringify(memoryStateCache));
          } catch (e) {}
          resolve(memoryStateCache);
        }
      };
      request.onerror = () => {
        resolve(memoryStateCache);
      };
    });
  } catch (e) {
    return memoryStateCache;
  }
}

/**
 * Synchronously read app state from in-memory mirror (<0.1ms).
 */
export function getAppState<T = any>(key: string, defaultValue: T | null = null): T | null {
  if (memoryStateCache[key] !== undefined) {
    return memoryStateCache[key] as T;
  }
  if (typeof window !== 'undefined') {
    try {
      const item = localStorage.getItem(`raliving_state_${key}`);
      if (item) {
        const parsed = JSON.parse(item);
        memoryStateCache[key] = parsed;
        return parsed as T;
      }
    } catch (e) {}
  }
  return defaultValue;
}

/**
 * Persist app state asynchronously to IndexedDB while updating memory mirror instantly.
 */
export async function setAppState(key: string, value: any): Promise<void> {
  // 1. Instant synchronous memory update
  memoryStateCache[key] = value;

  if (typeof window === 'undefined') return;

  // 2. Synchronous quick localStorage backup for critical keys
  try {
    localStorage.setItem(`raliving_state_${key}`, JSON.stringify(value));
    localStorage.setItem('raliving_pwa_mem_state', JSON.stringify(memoryStateCache));
  } catch (e) {}

  // 3. Asynchronous background IndexedDB commit
  try {
    const db = await getIDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(value, key);
  } catch (e) {
    console.warn(`[AppStateStore] Failed to write key "${key}" to IndexedDB`, e);
  }
}

/**
 * Clear user application state on logout.
 */
export async function clearAppState(): Promise<void> {
  Object.keys(memoryStateCache).forEach(k => delete memoryStateCache[k]);

  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('raliving_pwa_mem_state');
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('raliving_state_')) localStorage.removeItem(k);
      });
      const db = await getIDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
    } catch (e) {}
  }
}
