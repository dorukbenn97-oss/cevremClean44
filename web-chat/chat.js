// 🔥 Firebase SDK (Firestore ONLY)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    addDoc,
    collection,
    doc,
    getDoc,
    getFirestore,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// 🔧 Firebase config (AUTH YOK)
const firebaseConfig = {
  apiKey: "AIzaSyCrjrp17W88jJgcz6rAU5CDV2TJdRApwJI",
  authDomain: "cleanapp-f2720.firebaseapp.com",
  projectId: "cleanapp-f2720",
  storageBucket: "cleanapp-f2720.firebasestorage.app",
  messagingSenderId: "646677343584",
  appId: "1:646677343584:web:456bee25be8db2a16cee05",
};

// 🔥 Init
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 🆔 deviceId (auth yerine)
let deviceId = localStorage.getItem("deviceId");
if (!deviceId) {
  deviceId = Math.random().toString(36).substring(2, 10);
  localStorage.setItem("deviceId", deviceId);
}

// 🔑 Chat code
const params = new URLSearchParams(location.search);
const chatId = params.get("code");
if (!chatId) {
  alert("Kod yok");
  location.href = "index.html";
}

// 📌 DOM
const messagesEl = document.getElementById("messages");
const inputEl = document.getElementById("text");

// 🔒 Chat kontrol (var mı?)
const chatRef = doc(db, "chats", chatId);
const chatSnap = await getDoc(chatRef);
if (!chatSnap.exists()) {
  alert("Geçersiz kod");
  location.href = "index.html";
}

// 👂 Mesajları dinle
const q = query(
  collection(db, "chats", chatId, "messages"),
  orderBy("createdAt", "asc")
);

onSnapshot(q, (snap) => {
  messagesEl.innerHTML = "";
  snap.forEach((d) => {
    const m = d.data();
    const div = document.createElement("div");
    div.textContent = m.text;
    div.style.margin = "6px 0";
    div.style.textAlign = m.senderId === deviceId ? "right" : "left";
    messagesEl.appendChild(div);
  });
  messagesEl.scrollTop = messagesEl.scrollHeight;
});

// ➤ Gönder
window.send = async function () {
  const text = inputEl.value.trim();
  if (!text) return;

  await addDoc(collection(db, "chats", chatId, "messages"), {
    text,
    senderId: deviceId,
    createdAt: serverTimestamp(),
  });

  inputEl.value = "";
};