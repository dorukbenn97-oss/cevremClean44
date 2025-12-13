import { useRouter } from "expo-router";
import {
    collection,
    onSnapshot,
    orderBy,
    query,
    where,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { auth, db } from "../../firebaseConfig";

type ChatItem = {
  id: string;
  users: string[];
  lastMessage?: string;
  updatedAt?: number;
};

export default function ChatListScreen() {
  const router = useRouter();
  const currentUser = auth.currentUser?.uid;
  const [chats, setChats] = useState<ChatItem[]>([]);

  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, "chats"),
      where("users", "array-contains", currentUser),
      orderBy("updatedAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as ChatItem[];

      setChats(list);
    });

    return unsub;
  }, [currentUser]);

  if (!currentUser) {
    return (
      <View style={styles.center}>
        <Text>Giriş yapılmadı</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mesajlar</Text>

      {chats.length === 0 ? (
        <View style={styles.center}>
          <Text style={{ color: "#777" }}>Henüz sohbet yok</Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.chatItem}
              onPress={() => router.push(`./${item.id}`)}
            >
              <Text style={styles.chatUser}>Anon Kullanıcı</Text>
              <Text style={styles.lastMsg} numberOfLines={1}>
                {item.lastMessage ?? "Sohbeti aç"}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 16,
  },
  chatItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  chatUser: {
    fontSize: 16,
    fontWeight: "700",
  },
  lastMsg: {
    fontSize: 14,
    color: "#777",
    marginTop: 4,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});