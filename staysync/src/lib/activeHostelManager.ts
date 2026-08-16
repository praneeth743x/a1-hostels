"use client";

const DB_NAME = 'rentok-cache';
const DB_VERSION = 1;
const STORE_NAME = 'app-state';

export interface PersistedHostelState {
  ownerId: string;
  selectedHostelId: string;
  selectedHostelName: string;
  selectedHostelImage?: string;
  lastSelectedTimestamp: number;
}

function openRentokDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject('IndexedDB not supported');
      return;
    }

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
      reject(event.target.error);
    };
  });
}

export async function getPersistedActiveHostel(ownerId?: string): Promise<PersistedHostelState | null> {
  try {
    const db = await openRentokDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const key = ownerId ? `active_hostel_${ownerId}` : 'current_active_hostel';
      const req = store.get(key);

      req.onsuccess = () => {
        const res = req.result;
        if (res && typeof res === 'object') {
          resolve(res as PersistedHostelState);
        } else {
          resolve(null);
        }
      };

      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('[ActiveHostelManager] IndexedDB read fallback:', e);
    return null;
  }
}

export async function savePersistedActiveHostel(data: {
  ownerId: string;
  selectedHostelId: string;
  selectedHostelName: string;
  selectedHostelImage?: string;
}): Promise<void> {
  try {
    const state: PersistedHostelState = {
      ownerId: data.ownerId,
      selectedHostelId: data.selectedHostelId,
      selectedHostelName: data.selectedHostelName,
      selectedHostelImage: data.selectedHostelImage || '',
      lastSelectedTimestamp: Date.now(),
    };

    const db = await openRentokDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      
      // Save under specific ownerId key as well as global key for <20ms startup read
      store.put(state, `active_hostel_${data.ownerId}`);
      const req = store.put(state, 'current_active_hostel');

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('[ActiveHostelManager] IndexedDB write fallback:', e);
  }
}

export async function clearPersistedActiveHostel(ownerId?: string): Promise<void> {
  try {
    const db = await openRentokDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      if (ownerId) {
        store.delete(`active_hostel_${ownerId}`);
      }
      const req = store.delete('current_active_hostel');

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('[ActiveHostelManager] IndexedDB clear error:', e);
  }
}
