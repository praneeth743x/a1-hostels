import { initializeApp, getApps } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence, indexedDBLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyASgA4N_MhefT0Cq7LjuFVkmJe_l66Zu8s",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "a1-hostels.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "a1-hostels",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "a1-hostels.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "601498292075",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:601498292075:web:6ad45c45c111f7d422462e"
};
console.log("🔥 Firebase Config Loaded. API Key:", firebaseConfig.apiKey === "dummy" ? "FAILED_TO_LOAD" : "SUCCESSFULLY_LOADED");

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
// Explicitly set persistence to browserLocalPersistence (IndexedDB + LocalStorage fallback for iOS Safari)
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch(() => {
    setPersistence(auth, indexedDBLocalPersistence).catch(console.error);
  });
}

export const db = getFirestore(app);

export const storage = getStorage(app);
