// firebaseConfig.ts
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCrjrp17W88jJgcz6rAU5CDV2TJdRApwJI",
  authDomain: "cleanapp-f2720.firebaseapp.com",
  projectId: "cleanapp-f2720",
  storageBucket: "cleanapp-f2720.firebasestorage.app",
  messagingSenderId: "646677343584",
  appId: "1:646677343584:web:456bee25be8db2a16cee05",
};

// 🔥 Firebase başlat
const app = initializeApp(firebaseConfig);

// ✅ EN BASİT AUTH
export const auth = getAuth(app);

// (İstersen anon login — şart değil)
signInAnonymously(auth).catch(() => {});

// ✅ Firestore
export const db = getFirestore(app);

// ✅ Storage
export const storage = getStorage(app);