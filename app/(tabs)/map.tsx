import * as Location from "expo-location";
import { useRouter } from "expo-router";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc
} from "firebase/firestore";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, Region } from "react-native-maps";
import { auth, db } from "../../firebaseConfig";

type PostFromDb = {
  id: string;
  text?: string;
  image?: string | null;
  lat?: number;
  lng?: number;
  userId?: string;
};

type MapPost = {
  id: string;
  text?: string;
  image?: string | null;
  latitude: number;
  longitude: number;
  userId: string;
};

type UserLoc = {
  latitude: number;
  longitude: number;
};

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function MapScreen() {
  const router = useRouter();
  const currentUser = auth.currentUser?.uid;

  const [userLoc, setUserLoc] = useState<UserLoc | null>(null);
  const [posts, setPosts] = useState<MapPost[]>([]);
  const [activePost, setActivePost] = useState<MapPost | null>(null);

  const fadeAnim = useRef(new Animated.Value(1)).current;

  // ------------------ KONUM + POSTLAR ------------------
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

    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs
        .map((d): MapPost | null => {
          const data = d.data() as PostFromDb;
          if (!data.lat || !data.lng || !data.userId) return null;

          return {
            id: d.id,
            text: data.text ?? "",
            image: data.image ?? null,
            latitude: data.lat,
            longitude: data.lng,
            userId: data.userId,
          };
        })
        .filter((p): p is MapPost => p !== null);

      setPosts(list);
      setActivePost(list[0]);
    });

    return unsub;
  }, []);

  // ------------------ EN YAKIN POST ------------------
  const onRegionChange = (region: Region) => {
    if (posts.length === 0) return;

    let closest = posts[0];
    let minDist = Number.MAX_VALUE;

    posts.forEach((p) => {
      const dist = getDistance(region.latitude, region.longitude, p.latitude, p.longitude);
      if (dist < minDist) {
        minDist = dist;
        closest = p;
      }
    });

    if (activePost && closest.id === activePost.id) return;

    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();

    setActivePost(closest);
  };

  // ------------------ MESAJ İSTEĞİ GÖNDERME ------------------
  const sendMessageRequest = async () => {
    if (!currentUser || !activePost?.userId) return;

    if (currentUser === activePost.userId) {
      Alert.alert("Bilgi", "Kendine mesaj isteği gönderemezsin.");
      return;
    }

    const reqRef = doc(
      db,
      "messageRequests",
      activePost.userId,
      "incoming",
      currentUser
    );

    await setDoc(reqRef, {
      from: currentUser,
      postId: activePost.id,
      timestamp: Date.now(),
      status: "pending",
    });

    Alert.alert("Gönderildi", "Mesaj isteği karşı tarafa gönderildi.");
  };

  // ------------------ CHAT READY LİSTENER 🔥 (İKİ TARAF İÇİN) ------------------
  useEffect(() => {
    if (!currentUser) return;

    const unsub = onSnapshot(collection(db, "chats"), (snap) => {
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        const chatId = docSnap.id;

        // Kullanıcı bu chat’in içindeyse VE chat hazırsa → sohbeti aç
        if (data.users?.includes(currentUser) && data.ready === true) {
          router.push(`/chat/${chatId}`);
        }
      });
    });

    return unsub;
  }, [currentUser]);

  // ------------------ UI ------------------
  if (!userLoc || !activePost) {
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
        showsUserLocation={true}
        initialRegion={{
          latitude: userLoc.latitude,
          longitude: userLoc.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        onRegionChangeComplete={onRegionChange}
      >
        {posts.map((post) => {
          const isActive = activePost?.id === post.id;

          return (
            <Marker
              key={post.id}
              coordinate={{ latitude: post.latitude, longitude: post.longitude }}
              pinColor={isActive ? "red" : "gray"}
            />
          );
        })}
      </MapView>

      <Animated.View style={[styles.cardContainer, { opacity: fadeAnim }]}>
        <TouchableOpacity onPress={sendMessageRequest} style={styles.card}>
          {activePost.image && (
            <Image source={{ uri: activePost.image }} style={styles.cardImg} />
          )}

          <Text style={styles.cardText}>
            {activePost.text?.length ? activePost.text.slice(0, 50) : "Gönderi"}
          </Text>

          <Text style={styles.cardDistance}>
            📍 {getDistance(
              userLoc.latitude,
              userLoc.longitude,
              activePost.latitude,
              activePost.longitude
            ).toFixed(2)} km yakınında
          </Text>

          <Text style={styles.messageBtn}>💌 Mesaj İsteği Gönder</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ------------------ STYLES ------------------
const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  cardContainer: { position: "absolute", bottom: 110, alignSelf: "center" },
  card: {
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 12,
    width: 250,
    elevation: 5,
  },
  cardImg: { width: "100%", height: 140, borderRadius: 8, marginBottom: 6 },
  cardText: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
  cardDistance: { fontSize: 13, color: "#555" },
  messageBtn: {
    marginTop: 8,
    fontWeight: "600",
    textAlign: "center",
    color: "#0084ff",
  },
});