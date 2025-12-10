import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { db } from "../firebaseConfig";

/* ⭐ ZAMAN FORMAT FONKSİYONU */
function timeAgo(timestamp: any) {
  if (!timestamp) return "şimdi";

  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);

  if (s < 60) return "şimdi";
  if (s < 3600) return `${Math.floor(s / 60)} dk önce`;
  if (s < 86400) return `${Math.floor(s / 3600)} sa önce`;
  return `${Math.floor(s / 86400)} gün önce`;
}

export default function PostDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [post, setPost] = useState<any>(null);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      const ref = doc(db, "posts", String(id));
      const snap = await getDoc(ref);
      if (snap.exists()) setPost(snap.data());
    };

    load();
  }, [id]);

  if (!post)
    return (
      <View style={styles.center}>
        <Text style={{ color: "white" }}>Yükleniyor...</Text>
      </View>
    );

  return (
    <ScrollView style={styles.container}>

      {/* Geri butonu */}
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>←</Text>
      </TouchableOpacity>

      {/* Fotoğraf */}
      {post.image && (
        <Image
          source={{ uri: post.image }}
          style={styles.fullImage}
          resizeMode="cover"
        />
      )}

      {/* Metin */}
      {post.text && (
        <Text style={styles.text}>{post.text}</Text>
      )}

      {/* Zaman */}
      {post.createdAt && (
        <Text style={styles.time}>🕒 {timeAgo(post.createdAt)}</Text>
      )}

      {/* Konum */}
      {post.location && (
        <Text style={styles.location}>
          📍 {post.location.city} / {post.location.district}
        </Text>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
    paddingTop: 40,
  },

  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  backBtn: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  backText: {
    color: "white",
    fontSize: 28,
  },

  fullImage: {
    width: "100%",
    height: 420,
    borderRadius: 16,
  },

  text: {
    color: "white",
    fontSize: 20,
    padding: 20,
  },

  time: {
    color: "#aaa",
    paddingHorizontal: 20,
    fontSize: 14,
  },

  location: {
    color: "#30D158",
    paddingHorizontal: 20,
    marginTop: 6,
    fontSize: 16,
  },
});