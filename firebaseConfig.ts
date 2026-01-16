import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCrjrpl7W88jJqcz6rAU5CDV2TJdRApwJI",
  authDomain: "cleanapp-f2720.firebaseapp.com",
  projectId: "cleanapp-f2720",
  storageBucket: "cleanapp-f2720.firebasestorage.app",
  messagingSenderId: "646677343584",
  appId: "1:646677343584:web:456bee25be8db2a16cee05",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

/**
 * 🔥 SADECE SERVİS EXPORT
 * ❌ onAuthStateChanged YOK
 * ❌ signInAnonymously YOK
 */
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);