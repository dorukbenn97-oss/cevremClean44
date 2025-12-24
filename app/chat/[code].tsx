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
  const [ownerId, setOwnerId] = useState<string | null>(null);

  const [text, setText] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [ready, setReady] = useState(false);
  const [someoneTyping, setSomeoneTyping] = useState(false);

  const [locked, setLocked] = useState(false);
  const [closed, setClosed] = useState(false);

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

      if (!data.ownerId) {
        await updateDoc(ref, { ownerId: deviceId });
        setOwnerId(deviceId);
      } else {
        setOwnerId(data.ownerId);
      }

      if (data.closed) {
        Alert.alert("Sohbet kapalı", "Bu sohbet kalıcı olarak kapatıldı");
        router.replace("/");
        return;
      }

      if (data.locked && data.ownerId !== deviceId) {
        Alert.alert("Oda kilitli", "Bu odaya yeni girişler kapalı");
        router.replace("/");
        return;
      }

      setLocked(!!data.locked);
      setClosed(!!data.closed);
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
        if (
          msg.senderId !== deviceId &&
          !msg.readBy?.includes(deviceId)
        ) {
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
      deleted: false, // 👈 EKLENDİ
    });

    await deleteDoc(doc(db, "chats", chatId, "typing", deviceId));
    setText("");
  };

  /* 🗑 HERKES İÇİN MESAJ SİL */
  const deleteMessageForEveryone = async (msg: any) => {
    if (msg.senderId !== deviceId) return;

    Alert.alert(
      "Mesajı Sil",
      "Bu mesaj herkes için silinecek.",
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: async () => {
            await updateDoc(
              doc(db, "chats", chatId!, "messages", msg.id),
              { deleted: true }
            );
          },
        },
      ]
    );
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
            router.replace("/");
          },
        },
      ]
    );
  };

  if (!ready) return null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#0B0B0F" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* HEADER */}
      <View style={{
        padding: 14,
        borderBottomWidth: 1,
        borderColor: "#1C1C22",
        backgroundColor: "#111117",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <View>
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff" }}>
            Sohbet {closed ? "🛑" : locked ? "🔒" : ""}
          </Text>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <Text style={{ color: "#4FC3F7" }}>Kod: {chatId}</Text>
            <TouchableOpacity onPress={() => Clipboard.setStringAsync(chatId || "")}>
              <Text style={{ color: "#4FC3F7" }}>📋 Kopyala</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 14 }}>
          {isOwner && !closed && (
            <>
              <TouchableOpacity onPress={toggleLock}>
                <Text style={{ color: "#4FC3F7" }}>
                  {locked ? "Kilidi Aç" : "Kilitle"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={closeChatForever}>
                <Text style={{ color: "#FF453A" }}>Kapat</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ fontSize: 18, color: "#fff" }}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* MESSAGES */}
      <FlatList
        data={messages}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => {
          const isMe = item.senderId === deviceId;
          const readCount = item.readBy?.length || 0;

          return (
            <TouchableOpacity
              activeOpacity={0.8}
              onLongPress={() => {
                if (isMe && !item.deleted) {
                  deleteMessageForEveryone(item);
                }
              }}
              style={{
                alignSelf: isMe ? "flex-end" : "flex-start",
                marginBottom: 10,
              }}
            >
              <View
                style={{
                  backgroundColor: isMe ? "#007AFF" : "#1C1C22",
                  padding: 12,
                  borderRadius: 16,
                  maxWidth: "80%",
                }}
              >
                <Text style={{ color: "#fff" }}>
                  {item.deleted ? "Bu mesaj silindi" : item.text}
                </Text>
              </View>

              <View style={{
                flexDirection: "row",
                gap: 6,
                alignSelf: isMe ? "flex-end" : "flex-start",
              }}>
                <Text style={{ fontSize: 11, color: "#888" }}>
                  {formatTime(item.createdAt)}
                </Text>
                {isMe && (
                  <Text style={{
                    fontSize: 12,
                    color: readCount > 1 ? "#4FC3F7" : "#666",
                  }}>
                    {readCount > 1 ? "✓✓" : "✓"}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {someoneTyping && !closed && (
        <Text style={{ marginLeft: 16, color: "#888" }}>
          Karşı taraf yazıyor...
        </Text>
      )}

      {!closed && (
        <View style={{
          flexDirection: "row",
          padding: 10,
          borderTopWidth: 1,
          borderColor: "#1C1C22",
          backgroundColor: "#111117",
        }}>
          <TextInput
            value={text}
            onChangeText={handleTyping}
            placeholder="Mesaj yaz..."
            placeholderTextColor="#666"
            style={{
              flex: 1,
              backgroundColor: "#1C1C22",
              color: "#fff",
              borderRadius: 20,
              paddingHorizontal: 14,
            }}
          />
          <TouchableOpacity
            onPress={sendMessage}
            style={{
              backgroundColor: "#007AFF",
              padding: 12,
              borderRadius: 20,
              marginLeft: 6,
            }}
          >
            <Text style={{ color: "#fff" }}>➤</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}