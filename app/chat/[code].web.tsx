import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../../firebaseConfig";

/* 🆔 WEB DEVICE ID */
function getWebDeviceId(): string {
  let id = localStorage.getItem("deviceId");
  if (!id) {
    id = Math.random().toString(36).substring(2, 10);
    localStorage.setItem("deviceId", id);
  }
  return id;
}

/* 🕒 TIME */
function formatTime(ts: any) {
  if (!ts?.seconds) return "";
  const d = new Date(ts.seconds * 1000);
  return d.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ChatRoomWeb() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const chatId = useMemo(
    () => (Array.isArray(params.code) ? params.code[0] : params.code),
    [params.code]
  );

  const [deviceId] = useState(getWebDeviceId);
  const [ownerId, setOwnerId] = useState<string | null>(null);

  const [text, setText] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [ready, setReady] = useState(false);
  const [someoneTyping, setSomeoneTyping] = useState(false);

  const [locked, setLocked] = useState(false);
  const [closed, setClosed] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<any>(null);

  const isOwner = ownerId === deviceId;

  /* 📱 iOS / PWA VIEWPORT FIX (ASIL MESELE) */
  useEffect(() => {
    const updateHeight = () => {
      const vh = window.visualViewport?.height || window.innerHeight;
      document.documentElement.style.setProperty("--app-height", `${vh}px`);
    };
    updateHeight();
    window.visualViewport?.addEventListener("resize", updateHeight);
    window.addEventListener("resize", updateHeight);
    return () => {
      window.visualViewport?.removeEventListener("resize", updateHeight);
      window.removeEventListener("resize", updateHeight);
    };
  }, []);

  /* CHAT META */
  useEffect(() => {
    if (!chatId) return;
    const ref = doc(db, "chats", chatId);

    return onSnapshot(ref, async (snap) => {
      if (!snap.exists()) {
        alert("Geçersiz Kod");
        router.replace("/");
        return;
      }

      const data: any = snap.data();

      if (!data.ownerId) {
        await updateDoc(ref, { ownerId: deviceId });
        setOwnerId(deviceId);
      } else {
        setOwnerId(data.ownerId);
      }

      if (data.closed) {
        alert("Bu sohbet kapatıldı");
        router.replace("/");
        return;
      }

      if (data.locked && data.ownerId !== deviceId) {
        alert("Oda kilitli");
        router.replace("/");
        return;
      }

      setLocked(!!data.locked);
      setClosed(!!data.closed);
      setReady(true);
    });
  }, [chatId, deviceId, router]);

  /* MESSAGES */
  useEffect(() => {
    if (!ready || !chatId) return;

    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "asc")
    );

    return onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(list);

      requestAnimationFrame(() => {
        listRef.current?.scrollTo({
          top: listRef.current.scrollHeight,
          behavior: "smooth",
        });
      });

      list.forEach((msg: any) => {
        if (msg.senderId !== deviceId && !msg.readBy?.includes(deviceId)) {
          updateDoc(doc(db, "chats", chatId, "messages", msg.id), {
            readBy: [...(msg.readBy || []), deviceId],
          });
        }
      });
    });
  }, [ready, chatId, deviceId]);

  /* TYPING */
  useEffect(() => {
    if (!ready || !chatId || closed) return;
    return onSnapshot(collection(db, "chats", chatId, "typing"), (snap) => {
      setSomeoneTyping(snap.docs.some((d) => d.id !== deviceId));
    });
  }, [ready, chatId, deviceId, closed]);

  const handleTyping = async (v: string) => {
    if (!chatId || closed) return;
    setText(v);

    if (typingTimeout.current) clearTimeout(typingTimeout.current);

    if (!v) {
      await deleteDoc(doc(db, "chats", chatId, "typing", deviceId));
      return;
    }

    await setDoc(doc(db, "chats", chatId, "typing", deviceId), { typing: true });

    typingTimeout.current = setTimeout(async () => {
      await deleteDoc(doc(db, "chats", chatId, "typing", deviceId));
    }, 1500);
  };

  const sendMessage = async () => {
    if (!text.trim() || !chatId || closed) return;

    await addDoc(collection(db, "chats", chatId, "messages"), {
      text,
      senderId: deviceId,
      createdAt: serverTimestamp(),
      readBy: [deviceId],
      deleted: false,
    });

    await deleteDoc(doc(db, "chats", chatId, "typing", deviceId));
    setText("");
  };

  if (!ready) return null;

  return (
    <div
      style={{
        height: "var(--app-height)",
        display: "flex",
        flexDirection: "column",
        background: "#0B0B0F",
        overscrollBehavior: "none",
      }}
    >
      {/* HEADER */}
      <div style={{
        padding: 14,
        borderBottom: "1px solid #1C1C22",
        background: "#111117",
        display: "flex",
        justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div>
          <div style={{ color: "#fff", fontWeight: 700 }}>
            Sohbet {closed ? "🛑" : locked ? "🔒" : ""}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ color: "#4FC3F7" }}>Kod: {chatId}</span>
            <button
              onClick={() => Clipboard.setStringAsync(chatId || "")}
              style={{ background: "none", border: "none", color: "#4FC3F7" }}
            >
              📋 Kopyala
            </button>
          </div>
        </div>

        <button
          onClick={() => router.replace("/")}
          style={{ background: "none", border: "none", color: "#fff" }}
        >
          ✕
        </button>
      </div>

      {/* LIST */}
      <div
        ref={listRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 16,
          WebkitOverflowScrolling: "touch",
        }}
      >
        {messages.map((item) => {
          const isMe = item.senderId === deviceId;
          const readCount = item.readBy?.length || 0;

          return (
            <div key={item.id} style={{ marginBottom: 12 }}>
              <div
                style={{
                  marginLeft: isMe ? "auto" : 0,
                  background: isMe ? "#007AFF" : "#1C1C22",
                  padding: 12,
                  borderRadius: 16,
                  maxWidth: "80%",
                  color: "#fff",
                }}
              >
                {item.deleted ? "Bu mesaj silindi" : item.text}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "#888",
                  textAlign: isMe ? "right" : "left",
                }}
              >
                {formatTime(item.createdAt)}{" "}
                {isMe && (readCount > 1 ? "✓✓" : "✓")}
              </div>
            </div>
          );
        })}
      </div>

      {someoneTyping && !closed && (
        <div style={{ color: "#888", paddingLeft: 16, paddingBottom: 6 }}>
          Karşı taraf yazıyor...
        </div>
      )}

      {/* INPUT */}
      {!closed && (
        <div style={{
          padding: 10,
          paddingBottom: "env(safe-area-inset-bottom)",
          borderTop: "1px solid #1C1C22",
          background: "#111117",
          flexShrink: 0,
        }}>
          <input
            value={text}
            onChange={(e) => handleTyping(e.target.value)}
            placeholder="Mesaj yaz..."
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            style={{
              width: "100%",
              background: "#1C1C22",
              color: "#fff",
              borderRadius: 20,
              padding: "14px",
              border: "none",
              outline: "none",
              fontSize: 16,
            }}
          />
        </div>
      )}
    </div>
  );
}