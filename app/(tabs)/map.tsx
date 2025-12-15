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
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { auth, db } from "../../firebaseConfig";

/* ---------------- TYPES ---------------- */
type MapPost = {
  id: string;
  title?: string;
  image?: string | null;
  latitude: number;
  longitude: number;
  userId: string;
  createdAt?: number;
  postCode: string;
};

export default function MapScreen() {
  /* 🌐 WEB İZOLASYONU (SADECE BU EKLENDİ) */
  if (Platform.OS === "web") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>🗺️ Harita mobilde kullanılabilir</Text>
      </View>
    );
  }

  const router = useRouter();
  const currentUser = auth.currentUser?.uid;

  const haloAnim = useRef(new Animated.Value(1)).current;
  const mapRef = useRef<MapView>(null);

  // 🔥 CARD ANIMATION
  const cardOpacity = useRef(new Animated.Value(1)).current;
  const cardTranslateY = useRef(new Animated.Value(0)).current;

  const [userLoc, setUserLoc] = useState<any>(null);
  const [posts, setPosts] = useState<MapPost[]>([]);
  const [activePost, setActivePost] = useState<MapPost | null>(null);

  // 🔍 POST CODE SEARCH
  const [searchCode, setSearchCode] = useState("");

  /* ---------------- HALO ANIMATION ---------------- */
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(haloAnim, {
          toValue: 2.2,
          duration: 1100,
          useNativeDriver: true,
        }),
        Animated.timing(haloAnim, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  /* ---------------- LOCATION + POSTS ---------------- */
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const loc = await Location.getCurrentPositionAsync({});
      setUserLoc(loc.coords);
    })();

    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => {
        const data = d.data();
        const createdAt =
          data.createdAt?.toMillis
            ? data.createdAt.toMillis()
            : data.createdAt;

        return {
          id: d.id,
          title: data.title ?? "",
          image: data.image ?? null,
          latitude: data.lat,
          longitude: data.lng,
          userId: data.userId,
          createdAt,
          postCode: data.postCode,
        };
      });

      setPosts(list);

      if (list.length > 0) {
        const newest = list[0];
        if (
          typeof newest.createdAt === "number" &&
          Date.now() - newest.createdAt < 2 * 60 * 1000
        ) {
          mapRef.current?.animateToRegion(
            {
              latitude: newest.latitude,
              longitude: newest.longitude,
              latitudeDelta: 0.004,
              longitudeDelta: 0.004,
            },
            900
          );
        }
      }
    });

    return unsub;
  }, []);

  /* ---------------- POST CODE SEARCH ---------------- */
  const findPostByCode = () => {
    const found = posts.find(
      (p) => p.postCode?.toLowerCase() === searchCode.trim().toLowerCase()
    );

    if (!found) {
      Alert.alert("Bulunamadı", "Bu koda ait bir post yok.");
      return;
    }

    mapRef.current?.animateToRegion(
      {
        latitude: found.latitude,
        longitude: found.longitude,
        latitudeDelta: 0.003,
        longitudeDelta: 0.003,
      },
      900
    );

    setActivePost(found);
    setSearchCode("");
  };

  /* ---------------- CLOSE CARD (SMOOTH) ---------------- */
  const closeCard = () => {
    Animated.parallel([
      Animated.timing(cardOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(cardTranslateY, {
        toValue: 20,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setActivePost(null);
      cardOpacity.setValue(1);
      cardTranslateY.setValue(0);
    });
  };

  /* ---------------- MESSAGE REQUEST ---------------- */
  const sendMessageRequest = async () => {
    if (!currentUser || !activePost) return;
    if (currentUser === activePost.userId) {
      Alert.alert("Bilgi", "Kendine mesaj isteği gönderemezsin.");
      return;
    }

    await setDoc(
      doc(db, "messageRequests", activePost.userId, "incoming", currentUser),
      {
        from: currentUser,
        postId: activePost.id,
        timestamp: Date.now(),
        status: "pending",
      }
    );

    Alert.alert("Gönderildi", "Mesaj isteği gönderildi.");
  };

  if (!userLoc) {
    return (
      <View style={styles.loading}>
        <Text>📍 Konum alınıyor...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* 🔍 SEARCH BAR */}
      <View style={styles.searchBar}>
        <TextInput
          placeholder="Post kodu gir"
          value={searchCode}
          onChangeText={setSearchCode}
          style={styles.searchInput}
        />
        <TouchableOpacity onPress={findPostByCode}>
          <Text style={styles.searchBtn}>🔍</Text>
        </TouchableOpacity>
      </View>

      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        showsUserLocation
        initialRegion={{
          latitude: userLoc.latitude,
          longitude: userLoc.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        {posts.map((post) => {
          const isNew =
            typeof post.createdAt === "number" &&
            Date.now() - post.createdAt < 5 * 60 * 1000;

          return (
            <Marker
              key={post.id}
              coordinate={{ latitude: post.latitude, longitude: post.longitude }}
              onPress={() => setActivePost(post)}
              anchor={{ x: 0.5, y: 0.5 }}
              zIndex={isNew ? 10 : 1}
            >
              <View style={styles.markerWrap}>
                {isNew && (
                  <Animated.View
                    style={[
                      styles.halo,
                      { transform: [{ scale: haloAnim }] },
                    ]}
                  />
                )}

                <View
                  style={[
                    styles.pin,
                    isNew && styles.pinNew,
                    { backgroundColor: isNew ? "#ff3b30" : "#0a84ff" },
                  ]}
                />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* ---------------- CARD ---------------- */}
      {activePost && (
        <Animated.View
          style={[
            styles.cardContainer,
            {
              opacity: cardOpacity,
              transform: [{ translateY: cardTranslateY }],
            },
          ]}
        >
          <View style={styles.card}>
            <TouchableOpacity style={styles.closeBtn} onPress={closeCard}>
              <Text>✕</Text>
            </TouchableOpacity>

            {activePost.image && (
              <Image source={{ uri: activePost.image }} style={styles.cardImg} />
            )}

            <Text style={styles.cardTitle}>
              {activePost.title || "Gönderi"}
            </Text>

            <Text style={styles.cardCode}>
              🔑 Kod: {activePost.postCode}
            </Text>

            <TouchableOpacity
              onPress={() => router.push(`../postdetail/${activePost.id}`)}
            >
              <Text style={styles.detailText}>🔍 Detaya bak</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={sendMessageRequest}>
              <Text style={styles.messageBtn}>💌 Mesaj isteği gönder</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

/* ---------------- STYLES ---------------- */
const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },

  searchBar: {
    position: "absolute",
    top: 50,
    left: 16,
    right: 16,
    zIndex: 20,
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 12,
    alignItems: "center",
    elevation: 4,
  },

  searchInput: {
    flex: 1,
    height: 40,
  },

  searchBtn: {
    fontSize: 20,
  },

  markerWrap: {
    alignItems: "center",
    justifyContent: "center",
  },

  pin: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },

  pinNew: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },

  halo: {
    position: "absolute",
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(255,59,48,0.18)",
  },

  cardContainer: {
    position: "absolute",
    bottom: 110,
    alignSelf: "center",
  },

  card: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 14,
    width: 260,
  },

  closeBtn: {
    position: "absolute",
    top: 6,
    right: 6,
  },

  cardImg: {
    width: "100%",
    height: 140,
    borderRadius: 10,
    marginBottom: 6,
  },

  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
  },

  cardCode: {
    fontSize: 13,
    color: "#555",
    marginVertical: 4,
  },

  detailText: {
    textAlign: "center",
    fontWeight: "600",
    marginTop: 6,
  },

  messageBtn: {
    textAlign: "center",
    color: "#0a84ff",
    fontWeight: "700",
    marginTop: 8,
  },
});