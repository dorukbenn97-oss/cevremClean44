import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../firebaseConfig";

/* 🔐 6 HANELİ GİZLİ KOD */
function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const EMPTY_HINT_KEY = "hasSeenEmptyHint";
const HIDDEN_CHATS_KEY = "hiddenChats";
const DELETED_CHATS_KEY = "deletedChats";
const UNREAD_CHATS_KEY = "unreadChats";

const FREE_MAX_ROOMS = 1;
const PREMIUM_MAX_ROOMS = 5;
const MAX_PARTICIPANTS = 8;

export default function Index() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);

  const [code, setCode] = useState("");
  const [myChats, setMyChats] = useState<string[]>([]);

  const [hiddenChats, setHiddenChats] = useState<string[]>([]);
  const [deletedChats, setDeletedChats] = useState<string[]>([]);
  const [unreadChats, setUnreadChats] = useState<string[]>([]);

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const pulseTop = useRef(new Animated.Value(1)).current;
  const pulseBottom = useRef(new Animated.Value(1)).current;

  /* 🔐 AUTH */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        await signInAnonymously(auth);
        return;
      }

      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        await setDoc(
          userRef,
          {
            isPremium: false,
            activeChatId: null,
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      setAuthReady(true);
    });

    return () => unsub();
  }, []);

  /* 🔥 ANİMASYON */
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseTop, {
          toValue: 1.1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseTop, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseBottom, {
          toValue: 1.05,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseBottom, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  /* 🔹 LOAD */
  useEffect(() => {
    (async () => {
      setMyChats(JSON.parse((await AsyncStorage.getItem("myChats")) || "[]"));
      setHiddenChats(JSON.parse((await AsyncStorage.getItem(HIDDEN_CHATS_KEY)) || "[]"));
      setDeletedChats(JSON.parse((await AsyncStorage.getItem(DELETED_CHATS_KEY)) || "[]"));
      setUnreadChats(JSON.parse((await AsyncStorage.getItem(UNREAD_CHATS_KEY)) || "[]"));
    })();
  }, []);

  /* 🔹 SAVE CHAT */
  const saveChatToList = async (chatCode: string) => {
    const updated = Array.from(new Set([chatCode, ...myChats]));
    setMyChats(updated);
    await AsyncStorage.setItem("myChats", JSON.stringify(updated));
  };

  /* 🔹 CREATE */
const createChatAndGo = async () => {
  const user = auth.currentUser;
  if (!user) return;

  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return;

  const data = snap.data();
  const isPremium = !!data.isPremium;

  const maxRooms = isPremium ? PREMIUM_MAX_ROOMS : FREE_MAX_ROOMS;
  const roomsUsed = data.roomsUsed || 0;

  // ✅ GERÇEK LİMİT KONTROLÜ
  if (roomsUsed >= maxRooms) {
    Alert.alert(
      "Limit",
      isPremium
        ? "Oda hakkın doldu."
        : "Ücretsiz kullanıcılar 1 oda açabilir.\nPremium ile 5 oda açabilirsin.",
      isPremium
        ? [{ text: "Tamam" }]
        : [
            { text: "İptal", style: "cancel" },
            {
              text: "⭐ Premium’a Geç",
              onPress: () => router.push("/premium"),
            },
          ]
    );
    return;
  }

  const newCode = generateCode();

  // 🔥 ODA OLUŞTUR
  await setDoc(doc(db, "chats", newCode), {
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000),
    ownerId: user.uid,
    participantsCount: 1,
  });

  // ✅ HAK DÜŞÜR (GERİ GELMEZ)
  await updateDoc(userRef, {
    roomsUsed: roomsUsed + 1,
  });

  await saveChatToList(newCode);
  router.push(`/chat/${newCode}`);
};

  /* 🔹 JOIN */
  const goChatIfExists = async () => {
    const c = code.trim().toUpperCase();
    if (!c) return;

    const chatRef = doc(db, "chats", c);
    const snap = await getDoc(chatRef);
    if (!snap.exists()) {
      Alert.alert("Geçersiz Kod", "Bu davet koduna ait bir oda yok.");
      return;
    }

    const data = snap.data();
    const count = data.participantsCount || 0;

    if (count >= MAX_PARTICIPANTS) {
      Alert.alert("Dolu Oda", "Bu oda dolu. (Maks. 8 kişi)");
      return;
    }

    await updateDoc(chatRef, {
      participantsCount: count + 1,
    });

    await saveChatToList(c);
    router.push(`/chat/${c}`);
  };

  const visibleChats = myChats.filter(
    (c) => !hiddenChats.includes(c) && !deletedChats.includes(c)
  );

  if (!authReady) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0B0B0F", justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "#fff" }}>Hazırlanıyor…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B0B0F" }}>
      <View style={{ flex: 1, padding: 24 }}>

        {/* HERO */}
        <View style={{ alignItems: "center", marginBottom: 30 }}>
          <Text style={{ fontSize: 50 }}>🕶️</Text>
          <Text style={{ fontSize: 26, fontWeight: "800", color: "#fff" }}>
            Gizli Odaların
          </Text>
          <Animated.Text style={{ color: "#8A8A8F", fontSize: 14, transform: [{ scale: pulseTop }] }}>
            Sadece davetlilerin girebildiği sohbetler
          </Animated.Text>
        </View>

        <TouchableOpacity onPress={createChatAndGo} style={{ backgroundColor: "#16161D", padding: 16, borderRadius: 14, marginBottom: 16 }}>
          <Text style={{ color: "#fff", textAlign: "center", fontSize: 17, fontWeight: "700" }}>
            🔐 Gizli Oda Oluştur
          </Text>
        </TouchableOpacity>

        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="Davet kodunu gir"
          placeholderTextColor="#666"
          autoCapitalize="characters"
          style={{ backgroundColor: "#0F0F14", color: "#fff", borderWidth: 1, borderColor: "#2C2C35", borderRadius: 12, padding: 14, marginBottom: 12 }}
        />

        <TouchableOpacity onPress={goChatIfExists} style={{ backgroundColor: "#007AFF", padding: 14, borderRadius: 12, marginBottom: 28 }}>
          <Text style={{ color: "#fff", textAlign: "center", fontSize: 16 }}>🎟️ Davet Kodu ile Gir</Text>
        </TouchableOpacity>

        {visibleChats.length > 0 && (
          <>
            <Animated.Text style={{ color: "#8A8A8F", fontSize: 12, marginBottom: 10, transform: [{ scale: pulseBottom }] }}>
              Sadece senin gördüklerin
            </Animated.Text>

            <FlatList
              data={visibleChats}
              keyExtractor={(i) => i}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => router.push(`/chat/${item}`)}
                  style={{
                    padding: 14,
                    borderWidth: 1,
                    borderColor: "#2C2C35",
                    borderRadius: 12,
                    marginBottom: 10,
                    backgroundColor: "#111117",
                  }}
                >
                  <Text style={{ fontSize: 16, color: "#fff" }}>🕶️ {item}</Text>
                </TouchableOpacity>
              )}
            />
          </>
        )}
      </View>

      <Text style={{ marginTop: 16, textAlign: "center", color: "#7A7A82", fontSize: 13 }}>
        Bağırmak yok. Fısıltı var.
      </Text>
    </SafeAreaView>
  );
}