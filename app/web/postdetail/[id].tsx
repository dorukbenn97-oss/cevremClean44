import { deleteDoc, doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { auth, db } from "../../../firebaseConfig";

/* ---------------- TIME FORMAT ---------------- */
function timeAgo(timestamp: any) {
  if (!timestamp) return "şimdi";
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);

  if (s < 60) return "şimdi";
  if (s < 3600) return `${Math.floor(s / 60)} dk önce`;
  if (s < 86400) return `${Math.floor(s / 3600)} saat önce`;
  return `${Math.floor(s / 86400)} gün önce`;
}

export default function WebPostDetail() {
  const [post, setPost] = useState<any>(null);

  // ✅ WEB PARAM OKUMA
  const id = new URLSearchParams(window.location.search).get("id");

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      const ref = doc(db, "posts", id);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        Alert.alert("Bulunamadı");
        return;
      }

      setPost({ id: snap.id, ...snap.data() });
    };

    load();
  }, [id]);

  const deletePost = async () => {
    if (!post) return;
    if (post.userId !== auth.currentUser?.uid) {
      Alert.alert("Sadece kendi gönderini silebilirsin");
      return;
    }

    await deleteDoc(doc(db, "posts", post.id));
    Alert.alert("Silindi");
    window.history.back();
  };

  if (!post)
    return (
      <View style={styles.center}>
        <Text>Yükleniyor...</Text>
      </View>
    );

  return (
    <ScrollView style={styles.container}>
      {post.image && (
        <Image source={{ uri: post.image }} style={styles.image} />
      )}

      {post.title && <Text style={styles.title}>{post.title}</Text>}
      {post.text && <Text style={styles.text}>{post.text}</Text>}

      {post.createdAt && (
        <Text style={styles.time}>{timeAgo(post.createdAt)}</Text>
      )}

      {post.userId === auth.currentUser?.uid && (
        <TouchableOpacity style={styles.deleteBtn} onPress={deletePost}>
          <Text style={{ color: "white" }}>Gönderiyi Sil</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

/* ---------------- STYLES ---------------- */
const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  image: { width: "100%", height: 400, borderRadius: 12 },
  title: { fontSize: 24, fontWeight: "800", marginTop: 16 },
  text: { fontSize: 16, marginTop: 10 },
  time: { marginTop: 10, color: "#777" },
  deleteBtn: {
    backgroundColor: "red",
    marginTop: 20,
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
});