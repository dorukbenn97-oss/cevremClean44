import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCrjrpl7W88jJqcz6rAU5CDV2TJdRApwJI",
  authDomain: "cleanapp-f2720.firebaseapp.com",
  projectId: "cleanapp-f2720",
  storageBucket: "cleanapp-f2720.appspot.com",
  messagingSenderId: "646677343584",
  appId: "1:646677343584:web:456bee25be8db2a16cee05",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

/* 🔐 OTOMATİK ANON AUTH (LAYOUT YOK) */
let authReady = false;

onAuthStateChanged(auth, (user) => {
  if (!user) {
    signInAnonymously(auth).catch(console.error);
  } else {
    authReady = true;
  }
});

export const waitForAuth = () =>
  new Promise<void>((resolve) => {
    if (authReady) return resolve();
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        authReady = true;
        unsub();
        resolve();
      }
    });
  });