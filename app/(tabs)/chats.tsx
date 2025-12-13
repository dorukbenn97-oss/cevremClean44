import { useRouter } from "expo-router";
import {
    collection,
    onSnapshot,
    orderBy,
    query,
    where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
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
  updatedAt?: any;
};

export default function ChatsScreen() {
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
        ...(d.data() as Omit<ChatItem, "id">),
      }));
      setChats(list);
    });

    return unsub;
  }, [currentUser]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mesajlar</Text>

      {chats.length === 0 ? (
        <Text style={styles.empty}>Henüz sohbet yok.</Text>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const otherUserId = item.users.find(
              (u) => u !== currentUser
            );

            return (
              <TouchableOpacity
                style={styles.chatBox}
                onPress={() =>
                  router.push(
                    `/chat/${item.id}?otherUserId=${otherUserId}`
                  )
                }
              >
                <Text style={styles.chatUser}>
                  👤 {otherUserId}
                </Text>
                <Text style={styles.lastMsg}>
                  {item.lastMessage || "Mesaj yok"}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "white" },
  title: { fontSize: 26, fontWeight: "700", marginBottom: 20 },
  empty: {
    fontSize: 16,
    color: "#888",
    marginTop: 40,
    textAlign: "center",
  },
  chatBox: {
    padding: 15,
    borderRadius: 12,
    backgroundColor: "#f1f1f1",
    marginBottom: 12,
  },
  chatUser: { fontSize: 15, fontWeight: "700" },
  lastMsg: { fontSize: 14, color: "#555", marginTop: 4 },
});