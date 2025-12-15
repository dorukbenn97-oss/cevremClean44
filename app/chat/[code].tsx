import { useLocalSearchParams, useRouter } from "expo-router";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../../firebaseConfig";

export default function ChatRoom() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();

  const [text, setText] = useState("");
  const [messages, setMessages] = useState<any[]>([]);

  /* ---------------- LISTEN MESSAGES ---------------- */
  useEffect(() => {
    if (!code) return;

    const q = query(
      collection(db, "messages", code, "items"),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return unsub;
  }, [code]);

  /* ---------------- SEND MESSAGE ---------------- */
  const sendMessage = async () => {
    if (!text.trim() || !code) return;

    const messageText = text.trim();

    // 1️⃣ Mesajı odaya ekle
    await addDoc(collection(db, "messages", code, "items"), {
      text: messageText,
      createdAt: serverTimestamp(),
    });

    // 2️⃣ DM kutusu için sohbeti güncelle
    await setDoc(
      doc(db, "chats", code),
      {
        lastMessage: messageText,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    setText("");
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      {/* HEADER */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        {/* 🔑 ÖNEMLİ: HER ZAMAN DM KUTUSUNA DÖN */}
        <TouchableOpacity onPress={() => router.replace("/chat")}>
          <Text style={{ fontSize: 18 }}>←</Text>
        </TouchableOpacity>

        <Text style={{ fontSize: 18, fontWeight: "700", marginLeft: 12 }}>
          Sohbet ({code})
        </Text>
      </View>

      {/* MESSAGES */}
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

      {/* INPUT */}
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