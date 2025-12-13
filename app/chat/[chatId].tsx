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
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../../firebaseConfig";

export default function ChatScreen() {
  const { chatId, otherUserId } = useLocalSearchParams<{
    chatId: string;
    otherUserId: string;
  }>();

  const router = useRouter();

  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");

  const currentUser = auth.currentUser?.uid;

  /* ---------------- MESSAGES LISTENER ---------------- */
  useEffect(() => {
    if (!chatId) return;

    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("timestamp", "asc")
    );

    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return unsub;
  }, [chatId]);

  /* ---------------- SEND MESSAGE ---------------- */
  const sendMessage = async () => {
    if (!text.trim() || !currentUser || !chatId || !otherUserId) return;

    // 1️⃣ Mesajı yaz
    await addDoc(collection(db, "chats", chatId, "messages"), {
      text,
      senderId: currentUser,
      timestamp: serverTimestamp(),
    });

    // 2️⃣ Chat ana dokümanını GÜNCELLE / OLUŞTUR
    await setDoc(
      doc(db, "chats", chatId),
      {
        users: [currentUser, otherUserId],
        lastMessage: text,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    setText("");
  };

  /* ---------------- UNSEND ---------------- */
  const unsendMessage = async (msgId: string) => {
    if (!chatId) return;
    await deleteDoc(doc(db, "chats", chatId, "messages", msgId));
  };

  /* ---------------- BLOCK ---------------- */
  const blockUser = async () => {
    if (!currentUser || !chatId) return;

    Alert.alert("Engelle", "Bu kullanıcıyı engellemek istiyor musun?", [
      { text: "İptal", style: "cancel" },
      {
        text: "Engelle",
        style: "destructive",
        onPress: async () => {
          await setDoc(
            doc(db, "blocked", currentUser),
            { [chatId]: true },
            { merge: true }
          );
          router.replace("../");
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* TOP BAR */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.replace("../")}>
          <Text style={styles.topBtn}>←</Text>
        </TouchableOpacity>

        <Text style={styles.topTitle}>Sohbet</Text>

        <TouchableOpacity onPress={blockUser}>
          <Text style={[styles.topBtn, { color: "red" }]}>🛑</Text>
        </TouchableOpacity>
      </View>

      {/* MESSAGES */}
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 15 }}
        renderItem={({ item }) => {
          const isMe = item.senderId === currentUser;
          return (
            <TouchableOpacity
              onLongPress={() => (isMe ? unsendMessage(item.id) : null)}
            >
              <View
                style={[
                  styles.msgBubble,
                  isMe ? styles.myMsg : styles.otherMsg,
                ]}
              >
                <Text style={styles.msgText}>{item.text}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* INPUT */}
      <View style={styles.inputArea}>
        <TextInput
          style={styles.input}
          placeholder="Mesaj yaz..."
          value={text}
          onChangeText={setText}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
          <Text style={{ color: "white", fontWeight: "700" }}>Gönder</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ---------------- STYLES ---------------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "white" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    backgroundColor: "#f3f3f3",
  },
  topBtn: { fontSize: 22 },
  topTitle: { fontSize: 18, fontWeight: "700" },
  msgBubble: {
    maxWidth: "80%",
    padding: 10,
    marginVertical: 4,
    borderRadius: 10,
  },
  myMsg: {
    backgroundColor: "#d1ffd6",
    alignSelf: "flex-end",
  },
  otherMsg: {
    backgroundColor: "#eee",
    alignSelf: "flex-start",
  },
  msgText: { fontSize: 16 },
  inputArea: {
    flexDirection: "row",
    padding: 10,
    borderTopWidth: 1,
    borderColor: "#ddd",
  },
  input: {
    flex: 1,
    backgroundColor: "#f0f0f0",
    padding: 10,
    borderRadius: 8,
  },
  sendBtn: {
    backgroundColor: "#0084ff",
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginLeft: 8,
    borderRadius: 8,
  },
});