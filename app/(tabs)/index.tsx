import * as Location from "expo-location";
import { router } from "expo-router";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { auth, db } from "../../firebaseConfig";
import sendAppointment from "../../lib/sendAppointment";

type Post = {
  id: string;
  text: string;
  image?: string | null;
  createdAt?: any;
  userId?: string;
  location?: { city: string; district: string } | null;
  geo?: { lat: number; lng: number } | null;
};

// ⭐ MESAFE HESABI
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ⭐ MESAFEYİ METRE / KM YAZIYA ÇEVİR
function formatDistance(km: number) {
  if (km < 1) return `${Math.round(km * 1000)} metre yakınında`;
  return `${km.toFixed(1)} km yakınında`;
}

// ⭐ ZAMAN YAZISI
function timeAgo(timestamp: any) {
  if (!timestamp) return "şimdi";
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);

  if (s < 60) return "şimdi";
  if (s < 3600) return `${Math.floor(s / 60)} dk önce`;
  if (s < 86400) return `${Math.floor(s / 3600)} sa önce`;
  return `${Math.floor(s / 86400)} gün önce`;
}

// ⭐ AVATAR
function getAvatar(uid?: string) {
  if (!uid) return "https://i.pravatar.cc/100?img=1";
  let sum = 0;
  for (let i = 0; i < uid.length; i++) sum += uid.charCodeAt(i);
  return `https://i.pravatar.cc/150?img=${(sum % 70) + 1}`;
}

export default function IndexScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(
    null
  );

  const isDark = useColorScheme() === "dark";

  // 📍 KONUM + POSTLARI ÇEK
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({});
        setUserLoc({
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
        });
      }
    })();

    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Post[];

      list.sort((a, b) => {
        const t1 = a.createdAt?.toMillis?.() ?? 0;
        const t2 = b.createdAt?.toMillis?.() ?? 0;
        return t2 - t1;
      });

      setPosts(list);
    });

    return unsubscribe;
  }, []);

  // 📍 SADECE 3 KM YAKININI GÖSTER
  const visiblePosts = !userLoc
    ? posts
    : posts
        .map((p) => {
          if (!p.geo) return null;
          const km = getDistance(
            userLoc.lat,
            userLoc.lng,
            p.geo.lat,
            p.geo.lng
          );
          return { ...p, distanceKm: km };
        })
        .filter((p) => p && p.distanceKm! <= 3);

  const colors = {
    bg: isDark ? "#000" : "#fff",
    text: isDark ? "#fff" : "#222",
    muted: isDark ? "#aaa" : "#777",
    card: isDark ? "#111" : "#fff",
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]}>
      <Text style={[styles.title, { color: colors.text }]}>Çevrem</Text>

      <Text style={[styles.subTitle, { color: colors.muted }]}>
        Yakın çevrende {visiblePosts.length} paylaşım bulundu 📍
      </Text>

      {visiblePosts.map((post: any) => (
        <TouchableOpacity
          key={post.id}
          onPress={() => {
            // 👉 POSTA TIKLAYINCA DETAY SAYFASINA GİT
            router.push(`/postdetail?id=${post.id}`);
          }}
        >
          <View style={[styles.postCard, { backgroundColor: colors.card }]}>
            <View style={styles.postHeader}>
              <Image
                source={{ uri: getAvatar(post.userId) }}
                style={styles.avatar}
              />

              <View style={{ flex: 1 }}>
                <Text style={[styles.postUser, { color: colors.text }]}>
                  Anon
                </Text>

                <Text style={[styles.postTime, { color: colors.muted }]}>
                  {timeAgo(post.createdAt)}
                </Text>

                {post.distanceKm !== undefined && (
                  <Text style={{ color: colors.muted, fontSize: 13 }}>
                    📌 {formatDistance(post.distanceKm)}
                  </Text>
                )}

                {post.location && (
                  <Text style={{ color: colors.muted, fontSize: 13 }}>
                    📍 {post.location.city} / {post.location.district}
                  </Text>
                )}
              </View>
            </View>

            {post.text ? (
              <Text style={[styles.postText, { color: colors.text }]}>
                {post.text}
              </Text>
            ) : null}

            {post.image ? (
              <Image
                source={{ uri: post.image }}
                style={styles.postImage}
                resizeMode="cover"
              />
            ) : null}

            <TouchableOpacity
              style={styles.randevuBtn}
              onPress={async () => {
                if (!auth.currentUser) return;

                await sendAppointment(
                  post.userId ?? "",
                  "Sizinle tanışmak isterim 😊"
                );

                Alert.alert("✔", "Randevu isteği gönderildi 💚");
              }}
            >
              <Text style={styles.randevuBtnText}>RANDEVU</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 20 },
  title: { fontSize: 32, fontWeight: "800" },
  subTitle: { fontSize: 15, marginBottom: 20 },
  postCard: { padding: 22, borderRadius: 24, marginBottom: 26 },
  postHeader: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  avatar: { width: 46, height: 46, borderRadius: 23, marginRight: 12 },
  postUser: { fontSize: 16, fontWeight: "700" },
  postTime: { fontSize: 13 },
  postText: { marginTop: 6, fontSize: 20, fontWeight: "600" },
  postImage: {
    width: "100%",
    aspectRatio: 4 / 5,
    borderRadius: 18,
    marginTop: 14,
  },
  randevuBtn: {
    backgroundColor: "#00C851",
    paddingVertical: 12,
    borderRadius: 40,
    marginTop: 14,
    alignItems: "center",
  },
  randevuBtnText: { color: "white", fontSize: 18, fontWeight: "700" },
});