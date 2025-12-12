import * as Location from "expo-location";
import { useRouter } from "expo-router";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";

import React, { useEffect, useState } from "react";
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { auth, db } from "../../firebaseConfig";

/* ---------------- TYPES ---------------- */
type Post = {
  id: string;
  text?: string;
  image: string | null;
  latitude: number;
  longitude: number;
  userId: string;
  createdAt: number;
};

/* ---------------- MESAFE HESABI ---------------- */
function getDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
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

/* ---------------- TTL ---------------- */
const TTL_6_HOURS = 6 * 60 * 60 * 1000;

export default function MapScreen() {
  const router = useRouter();
  const currentUser = auth.currentUser?.uid ?? "";

  const [userLoc, setUserLoc] = useState<{ latitude: number; longitude: number } | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  /* ---------------- WEB GUARD ---------------- */
  if (Platform.OS === "web") {
    return (
      <View style={styles.web}>
        <Text style={styles.webTitle}>📍 Harita Görünümü</Text>
        <Text style={styles.webText}>
          Harita özelliği sadece mobil uygulamada kullanılabilir.
        </Text>
        <Text style={styles.webText}>
          Web sürümü demo ve inceleme amaçlıdır.
        </Text>
      </View>
    );
  }

  /* ---------------- MOBIL MAP IMPORT ---------------- */
  const MapView = require("react-native-maps").default;
  const { Marker, PROVIDER_GOOGLE } = require("react-native-maps");

  /* ---------------- KONUM AL ---------------- */
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const loc = await Location.getCurrentPositionAsync({});
      setUserLoc({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    })();
  }, []);

  /* ---------------- POST ÇEK ---------------- */
  useEffect(() => {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(q, (snap) => {
      const now = Date.now();

      const list = snap.docs
  .map((d) => {
    const data = d.data();

    if (!data.lat || !data.lng || !data.userId || !data.createdAt) return null;

    const createdMs: number = data.createdAt.toMillis?.() ?? 0;
    if (now - createdMs > TTL_6_HOURS) return null;

    return {
      id: d.id,
      text: data.text ?? "",
      image: data.image ?? null,
      latitude: data.lat,
      longitude: data.lng,
      userId: data.userId,
      createdAt: createdMs,
    };
  })
  .filter(Boolean) as Post[];
      setPosts(list);
    });

    return unsub;
  }, []);

  /* ---------------- MESAJ İSTEĞİ ---------------- */
  const sendMessageRequest = async (post: Post) => {
    if (!currentUser) return;
    if (currentUser === post.userId)
      return alert("Kendine mesaj isteği gönderemezsin.");

    const ref = doc(db, "messageRequests", post.userId, "incoming", currentUser);

    await setDoc(ref, {
      from: currentUser,
      postId: post.id,
      timestamp: Date.now(),
      status: "pending",
    });

    alert("Mesaj isteği gönderildi 💌");
  };

  if (!userLoc) {
    return (
      <View style={styles.loading}>
        <Text style={{ fontSize: 18 }}>📍 Konum alınıyor...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        showsUserLocation
        pitchEnabled={false}
        rotateEnabled={false}
        initialRegion={{
          latitude: userLoc.latitude,
          longitude: userLoc.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        onPress={() => setSelectedPost(null)}
      >
        {posts.map((post) => (
          <Marker
            key={post.id}
            coordinate={{
              latitude: post.latitude,
              longitude: post.longitude,
            }}
            onPress={() => setSelectedPost(post)}
          >
            <Image source={{ uri: post.image ?? "" }} style={styles.pinImage} />
          </Marker>
        ))}
      </MapView>

      {selectedPost && (
        <View style={styles.card}>
          <Image source={{ uri: selectedPost.image ?? "" }} style={styles.cardImage} />

          <Text style={styles.cardDistance}>
            📍{" "}
            {getDistance(
              userLoc.latitude,
              userLoc.longitude,
              selectedPost.latitude,
              selectedPost.longitude
            ).toFixed(2)}{" "}
            km
          </Text>

          <TouchableOpacity
            style={styles.cardBtn}
            onPress={() => sendMessageRequest(selectedPost)}
          >
            <Text style={styles.cardBtnTxt}>💌 Mesaj İsteği Gönder</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.cardBtn, { backgroundColor: "#333" }]}
            onPress={() => router.push(`/postdetail/${selectedPost.id}`)}
          >
            <Text style={styles.cardBtnTxt}>Gönderiyi Aç</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

/* ---------------- STYLES ---------------- */
const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },

  web: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  webTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 10,
  },
  webText: {
    fontSize: 16,
    color: "#555",
    textAlign: "center",
  },

  pinImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: "#fff",
  },

  card: {
    position: "absolute",
    bottom: 100,
    width: 280,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#fff",
    alignSelf: "center",
    elevation: 7,
  },

  cardImage: {
    width: "100%",
    height: 160,
    borderRadius: 14,
    marginBottom: 12,
  },

  cardDistance: {
    fontSize: 15,
    color: "#555",
    marginBottom: 10,
  },

  cardBtn: {
    backgroundColor: "#0a84ff",
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 8,
  },

  cardBtnTxt: {
    textAlign: "center",
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});