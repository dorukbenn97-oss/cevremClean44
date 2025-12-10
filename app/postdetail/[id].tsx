import * as Location from "expo-location"; // ⭐ EKLENDİ
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  deleteDoc,
  doc,
  getDoc
} from "firebase/firestore";
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
import { auth, db } from "../../firebaseConfig";

/* ---------------------------------------------------------
   ⭐ ZAMAN FORMAT FONKSİYONU
--------------------------------------------------------- */
function timeAgo(timestamp: any) {
  if (!timestamp) return "şimdi";

  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);

  if (s < 60) return "şimdi";
  if (s < 3600) return `${Math.floor(s / 60)} dk önce`;
  if (s < 86400) return `${Math.floor(s / 3600)} saat önce`;
  return `${Math.floor(s / 86400)} gün önce`;
}

/* ---------------------------------------------------------
   ⭐ 6 SAAT KONTROLÜ
--------------------------------------------------------- */
function isExpired(timestamp: any) {
  if (!timestamp) return false;
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return Date.now() - d.getTime() > 6 * 60 * 60 * 1000; // 6 saat
}

export default function PostDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();

  const [post, setPost] = useState<any>(null);
  const [distance, setDistance] = useState<number | null>(null);

  /* ---------------------------------------------------------
     ⭐ MESAFE HESABI
  --------------------------------------------------------- */
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  /* ---------------------------------------------------------
     ⭐ VERİYİ FIRESTORE'DAN ÇEK
  --------------------------------------------------------- */
  useEffect(() => {
    if (!id) return;

    const load = async () => {
      const ref = doc(db, "posts", String(id));
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        router.back();
        return;
      }

      const data = snap.data();

      // 🔥 6 saat geçmişse gönderiyi sil
      if (isExpired(data.createdAt)) {
        await deleteDoc(ref);
        Alert.alert("Süre Doldu", "Bu gönderi 6 saat sonra otomatik silindi.");
        router.back();
        return;
      }

      setPost(data);

      // 🔥 Mesafe hesapla – EXPO-LOCATION ile
      if (data.lat && data.lng) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;

        const loc = await Location.getCurrentPositionAsync({});
        const dist = calculateDistance(
          loc.coords.latitude,
          loc.coords.longitude,
          data.lat,
          data.lng
        );

        setDistance(dist);
      }
    };

    load();
  }, [id]);

  /* ---------------------------------------------------------
     ⭐ POST SİLME
  --------------------------------------------------------- */
  const deletePost = async () => {
    if (!post) return;
    if (post.userId !== auth.currentUser?.uid) {
      Alert.alert("Hata", "Sadece kendi gönderini silebilirsin.");
      return;
    }

    Alert.alert("Emin misin?", "Bu gönderi silinecek.", [
      { text: "İptal", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          await deleteDoc(doc(db, "posts", String(id)));
          Alert.alert("Silindi", "Gönderi başarıyla silindi.");
          router.back();
        },
      },
    ]);
  };

  if (!post)
    return (
      <View style={styles.center}>
        <Text style={{ color: "white" }}>Yükleniyor...</Text>
      </View>
    );

  return (
    <ScrollView style={styles.container}>
      {/* GERİ */}
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>←</Text>
      </TouchableOpacity>

      {/* FOTO */}
      {post.image && (
        <Image source={{ uri: post.image }} style={styles.fullImage} resizeMode="cover" />
      )}

      {/* BAŞLIK */}
      {post.title ? <Text style={styles.title}>{post.title}</Text> : null}

      {/* AÇIKLAMA */}
      {post.text ? <Text style={styles.text}>{post.text}</Text> : null}

      {/* KONUM */}
      {post.location?.city && (
        <Text style={styles.location}>
          📍 {post.location.city} / {post.location.district}
        </Text>
      )}

      {/* MESAFE */}
      {distance !== null && (
        <Text style={styles.distance}>
          📏 {distance.toFixed(2)} km uzakta
        </Text>
      )}

      {/* ZAMAN */}
      {post.createdAt && (
        <Text style={styles.time}>🕒 {timeAgo(post.createdAt)}</Text>
      )}

      {/* SİLME BUTONU */}
      {post.userId === auth.currentUser?.uid && (
        <TouchableOpacity style={styles.deleteBtn} onPress={deletePost}>
          <Text style={styles.deleteText}>Gönderiyi Sil</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

/* ---------------------------------------------------------
   ⭐ STYLES
--------------------------------------------------------- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
    paddingTop: 40,
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  backBtn: { paddingHorizontal: 20, marginBottom: 10 },
  backText: { color: "white", fontSize: 28 },

  fullImage: { width: "100%", height: 420, borderRadius: 16 },

  title: {
    color: "white",
    fontSize: 26,
    fontWeight: "800",
    padding: 20,
    paddingBottom: 0,
  },

  text: {
    color: "#ddd",
    fontSize: 18,
    paddingHorizontal: 20,
    marginTop: 10,
  },

  location: {
    color: "#30D158",
    paddingHorizontal: 20,
    marginTop: 10,
    fontSize: 16,
  },

  distance: {
    color: "#0A84FF",
    paddingHorizontal: 20,
    marginTop: 6,
    fontSize: 16,
  },

  time: {
    color: "#aaa",
    paddingHorizontal: 20,
    marginTop: 6,
    fontSize: 14,
  },

  deleteBtn: {
    backgroundColor: "#ff3b30",
    padding: 14,
    marginTop: 20,
    borderRadius: 10,
    alignItems: "center",
    marginHorizontal: 20,
    marginBottom: 40,
  },
  deleteText: { color: "white", fontSize: 18, fontWeight: "700" },
});