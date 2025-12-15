import { useRouter } from "expo-router";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../../firebaseConfig";

type Post = {
  id: string;
  image?: string;
  title?: string;
  text?: string;
  createdAt?: any;
};

export default function FeedScreen() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, "posts"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const list: Post[] = snap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as any),
      }));
      setPosts(list);
    });

    return () => unsub();
  }, []);

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/postdetail/${item.id}`)}
          >
            {item.image && (
              <Image
                source={{ uri: item.image }}
                style={styles.image}
              />
            )}

            {item.title ? (
              <Text style={styles.title}>{item.title}</Text>
            ) : null}

            {item.text ? (
              <Text style={styles.text}>{item.text}</Text>
            ) : null}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },

  // 🔥 WEB + MOBİL UYUMLU KART
  card: {
    marginBottom: 28,
    maxWidth: 520,          // web’de ortalar
    width: "100%",
    alignSelf: "center",
  },

  // 🔥 ORANI KORUNAN RESİM
  image: {
    width: "100%",
    aspectRatio: 1,         // biçimsizlik bitti
    borderRadius: 8,
    backgroundColor: "#eee",
  },

  title: {
    fontSize: 15,
    fontWeight: "600",
    marginTop: 10,
    marginHorizontal: 8,
  },

  text: {
    fontSize: 14,
    color: "#555",
    marginTop: 4,
    marginHorizontal: 8,
  },
});