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
import { useEffect, useState } from "react";
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
  const [allowed, setAllowed] = useState<string[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);

  const isOwner = deviceId && ownerId === deviceId;

  /* DEVICE ID */
  useEffect(() => {
    getDeviceId().then(setDeviceId);
  }, []);

  /* CHAT + OWNER + TEK KULLANIMLIK DAVET */
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
      const lockedNow = data.locked || false;
      const closedNow = data.closed || false;
      const allowedNow: string[] = data.allowed || [];
      let ownerNow: string | null = data.ownerId || null;

      // OWNER YOKSA → İLK GİREN
      if (!ownerNow) {
        ownerNow = deviceId;
        await updateDoc(ref, { ownerId: ownerNow });
      }

      const isAlreadyInside = allowedNow.includes(deviceId);

      // YENİ GİRİŞ
      if (!isAlreadyInside) {
        if (lockedNow || closedNow) {
          Alert.alert(
            "Giriş Kapalı",
            closedNow
              ? "Bu sohbet kalıcı olarak kapatıldı."
              : "Bu davet kodu artık geçersiz."
          );
          router.replace("/");
          return;
        }

        const updatedAllowed = [...allowedNow, deviceId];

        // 🎟️ TEK KULLANIMLIK DAVET:
        // Owner dışındaki İLK girişten sonra otomatik kilitlenir
        const shouldAutoLock =
          ownerNow !== deviceId && allowedNow.length === 1;

        await updateDoc(ref, {
          allowed: updatedAllowed,
          ...(shouldAutoLock ? { locked: true } : {}),
        });
      }

      setLocked(data.locked || false);
      setClosed(closedNow);
      setAllowed(allowedNow);
      setOwnerId(ownerNow);
      setReady(true);
    });
  }, [chatId, deviceId]);

  /* MESAJLAR + OKUNDU */
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
          updateDoc(
            doc(db, "chats", chatId, "messages", msg.id),
            {
              readBy: [...(msg.readBy || []), deviceId],
            }
          );
        }
      });
    });
  }, [ready, chatId, deviceId]);

  /* TYPING */
  useEffect(() => {
    if (!ready || !chatId || !deviceId || closed) return;
    return onSnapshot(
      collection(db, "chats", chatId, "typing"),
      (snap) => {
        setSomeoneTyping(snap.docs.some((d) => d.id !== deviceId));
      }
    );
  }, [ready, chatId, deviceId, closed]);

  const handleTyping = async (v: string) => {
    if (closed) return;
    setText(v);
    if (!chatId || !deviceId) return;

    if (v.length > 0) {
      await setDoc(doc(db, "chats", chatId, "typing", deviceId), {
        typing: true,
      });
    } else {
      await deleteDoc(doc(db, "chats", chatId, "typing", deviceId));
    }
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

  /* 🔐 SADECE OWNER */
  const toggleLock = async () => {
    if (!isOwner || closed) return;
    await updateDoc(doc(db, "chats", chatId!), {
      locked: !locked,
    });
  };

  /* 🛑 KALICI KAPAT */
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
      <View
        style={{
          padding: 12,
          borderBottomWidth: 1,
          borderColor: "#eee",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <View>
          <Text style={{ fontSize: 16, fontWeight: "700" }}>
            Sohbet {closed ? "🛑" : locked ? "🔒" : ""}
          </Text>

          <TouchableOpacity
            onPress={() => {
              Clipboard.setStringAsync(chatId || "");
              Alert.alert("Kopyalandı", `Kod: ${chatId}`);
            }}
          >
            <Text style={{ fontSize: 12, color: "#007AFF" }}>
              Kod: {chatId}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: "row", gap: 14 }}>
          {isOwner && !closed && (
            <>
              <TouchableOpacity onPress={toggleLock}>
                <Text style={{ fontSize: 14, color: "#007AFF" }}>
                  {locked ? "Kilidi Aç" : "Kilitle"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={closeChatForever}>
                <Text style={{ fontSize: 14, color: "#FF3B30" }}>
                  Kapat
                </Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ fontSize: 18 }}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      {(locked || closed) && (
        <View
          style={{
            padding: 8,
            backgroundColor: closed ? "#F8D7DA" : "#FFF3CD",
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: closed ? "#721C24" : "#856404",
              fontSize: 13,
            }}
          >
            {closed
              ? "🛑 Bu sohbet kalıcı olarak kapatıldı"
              : "🎟️ Davet kullanıldı — yeni giriş yok"}
          </Text>
        </View>
      )}

      {/* MESAJLAR */}
      <FlatList
        data={messages}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => {
          const isMe = item.senderId === deviceId;
          const read = item.readBy?.length > 1;

          return (
            <View
              style={{
                alignSelf: isMe ? "flex-end" : "flex-start",
                backgroundColor: isMe ? "#007AFF" : "#E5E5EA",
                padding: 10,
                borderRadius: 14,
                marginBottom: 8,
                maxWidth: "75%",
              }}
            >
              <Text style={{ color: isMe ? "#fff" : "#000" }}>
                {item.text}
              </Text>

              {isMe && (
                <Text
                  style={{
                    fontSize: 12,
                    color: read ? "#4FC3F7" : "#fff",
                    alignSelf: "flex-end",
                  }}
                >
                  {read ? "✓✓" : "✓"}
                </Text>
              )}
            </View>
          );
        }}
      />

      {someoneTyping && !closed && (
        <Text style={{ marginLeft: 16, color: "#999" }}>
          Karşı taraf yazıyor...
        </Text>
      )}

      {!closed ? (
        <View style={{ flexDirection: "row", padding: 10 }}>
          <TextInput
            value={text}
            onChangeText={handleTyping}
            placeholder="Mesaj yaz..."
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: "#ccc",
              borderRadius: 20,
              paddingHorizontal: 12,
              marginRight: 8,
            }}
          />
          <TouchableOpacity
            onPress={sendMessage}
            style={{
              backgroundColor: "#007AFF",
              padding: 12,
              borderRadius: 20,
            }}
          >
            <Text style={{ color: "#fff" }}>➤</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ padding: 14, alignItems: "center" }}>
          <Text style={{ color: "#999" }}>
            Bu sohbet kalıcı olarak kapatıldı.
          </Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}