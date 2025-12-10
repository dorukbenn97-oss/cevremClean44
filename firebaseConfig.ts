// firebaseConfig.ts

import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCrjrpl7W88jJqcz6rAU5CDV2TJdRApwJI",
  authDomain: "cleanapp-f2720.firebaseapp.com",
  projectId: "cleanapp-f2720",
  storageBucket: "cleanapp-f2720.appspot.com",
  messagingSenderId: "640677343584",
  appId: "1:640677343584:web:456bee25be8db2a16cee05",
};

// ⭐ Firebase başlat
const app = initializeApp(firebaseConfig);

// ⭐ Eski sürüm destekli AUTH
export const auth = getAuth(app);

// ⭐ Her cihaz farklı kullanıcı olarak giriş yapacak
signInAnonymously(auth).catch((err) =>
  console.log("Anon Login Error:", err)
);

// ⭐ Firestore
export const db = getFirestore(app);

// ⭐ Storage
export const storage = getStorage(app);