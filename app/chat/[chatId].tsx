import { useLocalSearchParams, useRouter } from "expo-router";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { auth, db } from "../../firebaseConfig"; // 🔥 DOĞRU YOL

export default function ChatScreen() {
  const { chatId } = useLocalSearchParams();
  const router = useRouter();

  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");

  const currentUser = auth.currentUser?.uid;

  // MESAJLARI ÇEK 🔥
  useEffect(() => {
    if (!chatId) return;

    const q = query(
      collection(db, "chats", String(chatId), "messages"),
      orderBy("timestamp", "asc") // 🔥 createdAt yerine timestamp
    );

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(list);
    });

    return unsub;
  }, [chatId]);

  // MESAJ GÖNDER 🔥
  const sendMessage = async () => {
    if (!text.trim()) return;

    await addDoc(collection(db, "chats", String(chatId), "messages"), {
      text,
      senderId: currentUser,
      timestamp: Date.now(), // 🔥 serverTimestamp yerine Date.now
    });

    setText("");
  };

  // MESAJ GERİ AL 🔥
  const unsendMessage = async (msgId: string) => {
    await deleteDoc(doc(db, "chats", String(chatId), "messages", msgId));
  };

  // ENGELLE 🔥
  const blockUser = async () => {
    Alert.alert("Engelle", "Bu kullanıcıyı engellemek istediğine emin misin?", [
      { text: "İptal", style: "cancel" },
      {
        text: "Engelle",
        style: "destructive",
        onPress: async () => {
          const chatRef = doc(db, "blocked", String(currentUser));
          await setDoc(
            chatRef,
            { [String(chatId)]: true },
            { merge: true }
          );

          router.back();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* ÜST BAR */}
      <View style={styles.topBar}>

        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.topBtn}>✖</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.topBtn}>➖</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={blockUser}>
          <Text style={[styles.topBtn, { color: "red" }]}>🛑</Text>
        </TouchableOpacity>
      </View>

      {/* MESAJLAR */}
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 15 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            onLongPress={() =>
              item.senderId === currentUser ? unsendMessage(item.id) : null
            }
            delayLongPress={300}
          >
            <View
              style={[
                styles.msgBubble,
                item.senderId === currentUser
                  ? styles.myMsg
                  : styles.otherMsg,
              ]}
            >
              <Text style={styles.msgText}>{item.text}</Text>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* YAZMA ALANI */}
      <View style={styles.inputArea}>
        <TextInput
          style={styles.input}
          placeholder="Mesaj yaz..."
          value={text}
          onChangeText={setText}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
          <Text style={{ color: "white", fontWeight: "bold" }}>Gönder</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---------------- STYLES ----------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "white" },

  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
    backgroundColor: "#f3f3f3",
  },

  topBtn: { fontSize: 22, marginHorizontal: 10 },

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