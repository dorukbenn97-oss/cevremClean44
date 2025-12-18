import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../../firebaseConfig";

/* 🆔 DEVICE ID */
async function getDeviceId(): Promise<string> {
  if (Platform.OS === "web") {
    let id = localStorage.getItem("deviceId");
    if (!id) {
      id = Math.random().toString(36).substring(2, 10);
      localStorage.setItem("deviceId", id);
    }
    return id;
  }

  let id = await AsyncStorage.getItem("deviceId");
  if (!id) {
    id = Math.random().toString(36).substring(2, 10);
    await AsyncStorage.setItem("deviceId", id);
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

export default function ChatRoom() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const chatId = Array.isArray(params.code) ? params.code[0] : params.code;

  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [ready, setReady] = useState(false);
  const [someoneTyping, setSomeoneTyping] = useState(false);

  const [locked, setLocked] = useState(false);
  const [closed, setClosed] = useState(false);
  const [ownerId, setOwnerId] = useState<string | null>(null);

  const typingTimeout = useRef<any>(null);
  const isOwner = deviceId && ownerId === deviceId;

  /* DEVICE */
  useEffect(() => {
    getDeviceId().then(setDeviceId);
  }, []);

  /* CHAT META */
  useEffect(() => {
    if (!chatId || !deviceId) return;
    const ref = doc(db, "chats", chatId);

    return onSnapshot(ref, async (snap) => {
      if (!snap.exists()) {
        Alert.alert("Geçersiz Kod");
        router.replace("/");
        return;
      }

      const data = snap.data();
      let ownerNow = data.ownerId;
      const allowed = data.allowed || [];

      if (!ownerNow) {
        ownerNow = deviceId;
        await updateDoc(ref, { ownerId: ownerNow });
      }

      if (!allowed.includes(deviceId)) {
        if (data.locked || data.closed) {
          Alert.alert("Giriş Kapalı");
          router.replace("/");
          return;
        }

        const shouldAutoLock =
          ownerNow !== deviceId && allowed.length === 1;

        await updateDoc(ref, {
          allowed: [...allowed, deviceId],
          ...(shouldAutoLock ? { locked: true } : {}),
        });
      }

      setLocked(data.locked || false);
      setClosed(data.closed || false);
      setOwnerId(ownerNow);
      setReady(true);
    });
  }, [chatId, deviceId]);

  /* MESSAGES */
  useEffect(() => {
    if (!ready || !chatId || !deviceId) return;

    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "asc")
    );

    return onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(list);

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
    if (!ready || !chatId || !deviceId || closed) return;
    return onSnapshot(collection(db, "chats", chatId, "typing"), (snap) => {
      setSomeoneTyping(snap.docs.some((d) => d.id !== deviceId));
    });
  }, [ready, chatId, deviceId, closed]);

  const handleTyping = async (v: string) => {
    if (!chatId || !deviceId || closed) return;
    setText(v);

    if (typingTimeout.current) clearTimeout(typingTimeout.current);

    if (!v) {
      await deleteDoc(doc(db, "chats", chatId, "typing", deviceId));
      return;
    }

    await setDoc(doc(db, "chats", chatId, "typing", deviceId), { typing: true });

    typingTimeout.current = setTimeout(async () => {
      await deleteDoc(doc(db, "chats", chatId, "typing", deviceId));
    }, 2000);
  };

  const sendMessage = async () => {
    if (!text.trim() || !chatId || !deviceId || closed) return;

    await addDoc(collection(db, "chats", chatId, "messages"), {
      text,
      senderId: deviceId,
      createdAt: serverTimestamp(),
      readBy: [deviceId],
    });

    await deleteDoc(doc(db, "chats", chatId, "typing", deviceId));
    setText("");
  };

  /* OWNER ACTIONS */
  const toggleLock = async () => {
    if (!isOwner || closed) return;
    await updateDoc(doc(db, "chats", chatId!), { locked: !locked });
  };

  const closeChatForever = async () => {
    if (!isOwner) return;

    Alert.alert(
      "Sohbeti Kapat",
      "Bu sohbet kalıcı olarak kapatılacak. Geri alınamaz.",
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Kapat",
          style: "destructive",
          onPress: async () => {
            await updateDoc(doc(db, "chats", chatId!), {
              closed: true,
              locked: true,
            });
          },
        },
      ]
    );
  };

  if (!ready) return null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#fff" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* HEADER */}
      <View style={{ padding: 12, borderBottomWidth: 1, borderColor: "#eee", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View>
          <Text style={{ fontSize: 16, fontWeight: "700" }}>
            Sohbet {closed ? "🛑" : locked ? "🔒" : ""}
          </Text>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <Text style={{ color: "#007AFF" }}>Kod: {chatId}</Text>
            <TouchableOpacity onPress={() => Clipboard.setStringAsync(chatId || "")}>
              <Text style={{ color: "#007AFF" }}>📋 Kopyala</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 14 }}>
          {isOwner && !closed && (
            <>
              <TouchableOpacity onPress={toggleLock}>
                <Text style={{ color: "#007AFF" }}>
                  {locked ? "Kilidi Aç" : "Kilitle"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={closeChatForever}>
                <Text style={{ color: "#FF3B30" }}>Kapat</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ fontSize: 18 }}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      {(locked || closed) && (
        <View style={{ padding: 8, backgroundColor: closed ? "#F8D7DA" : "#FFF3CD", alignItems: "center" }}>
          <Text style={{ color: closed ? "#721C24" : "#856404", fontSize: 13 }}>
            {closed
              ? "🛑 Bu sohbet kalıcı olarak kapatıldı"
              : "🎟️ Davet kullanıldı — yeni giriş yok"}
          </Text>
        </View>
      )}

      {/* MESSAGES */}
      <FlatList
        data={messages}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => {
          const isMe = item.senderId === deviceId;
          const readCount = item.readBy?.length || 0;

          return (
            <View style={{ alignSelf: isMe ? "flex-end" : "flex-start", marginBottom: 8 }}>
              <View style={{ backgroundColor: isMe ? "#007AFF" : "#E5E5EA", padding: 10, borderRadius: 14 }}>
                <Text style={{ color: isMe ? "#fff" : "#000" }}>{item.text}</Text>
              </View>

              <View style={{ flexDirection: "row", gap: 4, alignSelf: isMe ? "flex-end" : "flex-start" }}>
                <Text style={{ fontSize: 11, color: "#999" }}>
                  {formatTime(item.createdAt)}
                </Text>
                {isMe && (
                  <Text style={{ fontSize: 12, color: readCount > 1 ? "#4FC3F7" : "#999" }}>
                    {readCount > 1 ? "✓✓" : "✓"}
                  </Text>
                )}
              </View>
            </View>
          );
        }}
      />

      {someoneTyping && !closed && (
        <Text style={{ marginLeft: 16, color: "#999" }}>
          Karşı taraf yazıyor...
        </Text>
      )}

      {!closed && (
        <View style={{ flexDirection: "row", padding: 10 }}>
          <TextInput
            value={text}
            onChangeText={handleTyping}
            placeholder="Mesaj yaz..."
            style={{ flex: 1, borderWidth: 1, borderColor: "#ccc", borderRadius: 20, paddingHorizontal: 12 }}
          />
          <TouchableOpacity onPress={sendMessage} style={{ backgroundColor: "#007AFF", padding: 12, borderRadius: 20, marginLeft: 6 }}>
            <Text style={{ color: "#fff" }}>➤</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}