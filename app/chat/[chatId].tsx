import { useLocalSearchParams, useRouter } from "expo-router";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../../firebaseConfig";

export default function ChatRoom() {
  const router = useRouter();
  const params = useLocalSearchParams<{ chatId?: string | string[] }>();
  const chatId = Array.isArray(params.chatId)
    ? params.chatId[0]
    : params.chatId;

  const [text, setText] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [ready, setReady] = useState(false);

  // 🔒 CHAT VAR MI KONTROL
  useEffect(() => {
    if (!chatId) return;

    (async () => {
      const snap = await getDoc(doc(db, "chats", chatId));
      if (!snap.exists()) {
        Alert.alert("Geçersiz Kod", "Bu sohbete erişim yok.");
        router.replace("/");
        return;
      }
      setReady(true);
    })();
  }, [chatId]);

  // 📡 MESAJLARI DİNLE
  useEffect(() => {
    if (!ready || !chatId) return;

    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "asc")
    );

    return onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [ready, chatId]);

  const sendMessage = async () => {
    if (!text.trim() || !chatId) return;

    await addDoc(collection(db, "chats", chatId, "messages"), {
      text: text.trim(),
      createdAt: serverTimestamp(),
    });

    setText("");
  };

  if (!ready) return null;

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
        <TouchableOpacity onPress={() => router.replace("/")}>
          <Text style={{ fontSize: 18 }}>←</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: "700", marginLeft: 12 }}>
          Sohbet ({chatId})
        </Text>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View
            style={{
              backgroundColor: "#eee",
              padding: 10,
              borderRadius: 10,
              marginBottom: 8,
              maxWidth: "80%",
            }}
          >
            <Text>{item.text}</Text>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 80 }}
      />

      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          flexDirection: "row",
          padding: 10,
          borderTopWidth: 1,
          borderColor: "#ddd",
          backgroundColor: "#fff",
        }}
      >
        <TextInput
          value={text}
          onChangeText={setText}
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
            paddingHorizontal: 16,
            justifyContent: "center",
            borderRadius: 20,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>
            Gönder
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}