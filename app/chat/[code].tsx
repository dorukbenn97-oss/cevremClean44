import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
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

export default function ChatRoom() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const chatId = Array.isArray(params.code) ? params.code[0] : params.code;

  const deviceIdRef = useRef<string | null>(null);

  const [text, setText] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [ready, setReady] = useState(false);
  const [someoneTyping, setSomeoneTyping] = useState(false);

  /* DEVICE ID */
  useEffect(() => {
    getDeviceId().then((id) => (deviceIdRef.current = id));
  }, []);

  /* CHAT VAR MI */
  useEffect(() => {
    if (!chatId) return;
    (async () => {
      const snap = await getDoc(doc(db, "chats", chatId));
      if (!snap.exists()) {
        Alert.alert("Geçersiz Kod");
        router.replace("/");
        return;
      }
      setReady(true);
    })();
  }, [chatId]);

  /* MESAJLAR */
  useEffect(() => {
    if (!ready || !chatId || !deviceIdRef.current) return;

    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "asc")
    );

    return onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(list);

      list.forEach((msg: any) => {
        if (
          msg.senderId !== deviceIdRef.current &&
          !msg.readBy?.includes(deviceIdRef.current)
        ) {
          updateDoc(doc(db, "chats", chatId, "messages", msg.id), {
            readBy: [...(msg.readBy || []), deviceIdRef.current],
          });
        }
      });
    });
  }, [ready, chatId]);

  /* TYPING */
  useEffect(() => {
    if (!ready || !chatId || !deviceIdRef.current) return;
    return onSnapshot(
      collection(db, "chats", chatId, "typing"),
      (snap) => {
        setSomeoneTyping(
          snap.docs.some((d) => d.id !== deviceIdRef.current)
        );
      }
    );
  }, [ready, chatId]);

  const handleTyping = async (v: string) => {
    setText(v);
    if (!chatId || !deviceIdRef.current) return;

    if (v.length > 0) {
      await setDoc(doc(db, "chats", chatId, "typing", deviceIdRef.current), {
        typing: true,
      });
    } else {
      await deleteDoc(
        doc(db, "chats", chatId, "typing", deviceIdRef.current)
      );
    }
  };

  const sendMessage = async () => {
    if (!text.trim() || !chatId || !deviceIdRef.current) return;

    await addDoc(collection(db, "chats", chatId, "messages"), {
      text,
      senderId: deviceIdRef.current,
      createdAt: serverTimestamp(),
      readBy: [deviceIdRef.current],
    });

    await deleteDoc(
      doc(db, "chats", chatId, "typing", deviceIdRef.current)
    );
    setText("");
  };

  const deleteMessageForEveryone = (messageId: string) => {
    Alert.alert(
      "Mesajı sil",
      "Bu mesaj herkes için silinsin mi?",
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: async () => {
            await deleteDoc(
              doc(db, "chats", chatId!, "messages", messageId)
            );
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
          <Text style={{ fontSize: 16, fontWeight: "700" }}>Sohbet</Text>
          <TouchableOpacity
            onPress={() => {
              Clipboard.setStringAsync(chatId || "");
              Alert.alert("Kopyalandı", `Kod: ${chatId}`);
            }}
          >
            <Text style={{ fontSize: 12, color: "#007AFF" }}>
              Kod: {chatId} (kopyala)
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ fontSize: 22 }}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* MESAJLAR */}
      <FlatList
        data={messages}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => {
          const isMe = item.senderId === deviceIdRef.current;
          const read = item.readBy?.length > 1;

          return (
            <TouchableOpacity
              onLongPress={() => {
                if (isMe) deleteMessageForEveryone(item.id);
              }}
              activeOpacity={0.7}
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
            </TouchableOpacity>
          );
        }}
      />

      {someoneTyping && (
        <Text style={{ marginLeft: 16, color: "#999" }}>
          Karşı taraf yazıyor...
        </Text>
      )}

      {/* INPUT */}
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
    </KeyboardAvoidingView>
  );
}