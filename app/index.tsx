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
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../firebaseConfig";

/* 🔐 6 HANELİ GİZLİ KOD */
function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}


const DELETED_CHATS_KEY = "deletedChats";

const FREE_MAX_ROOMS = 1;
const PREMIUM_MAX_ROOMS = 5;
const MAX_PARTICIPANTS = 8;

export default function Index() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);

  const [code, setCode] = useState("");
  const [myChats, setMyChats] = useState<string[]>([]);
 
  const [deletedChats, setDeletedChats] = useState<string[]>([]);

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  /* ✨ ANİMASYON */
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
          { isPremium: false, roomsUsed: 0, createdAt: serverTimestamp() },
          { merge: true }
        );
      }

      setAuthReady(true);
    });

    return () => unsub();
  }, []);

  /* ✨ PULSE */
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseTop, { toValue: 1.1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseTop, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseBottom, { toValue: 1.06, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseBottom, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  /* 🔹 LOAD */
  useEffect(() => {
    (async () => {
      setMyChats(JSON.parse((await AsyncStorage.getItem("myChats")) || "[]"));
      
      setDeletedChats(JSON.parse((await AsyncStorage.getItem(DELETED_CHATS_KEY)) || "[]"));
    })();
  }, []);

  /* 💾 SAVE CHAT */
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

    if (roomsUsed >= maxRooms) {
  Alert.alert(
  "Aktif Odan Var",
  "Şu anda 1 aktif odan var.\nÜcretsiz kullanıcılar aynı anda yalnızca 1 oda açabilir.\n\nPremium ile aynı anda 5 oda açabilirsin.",
  [
    { text: "Vazgeç", style: "cancel" },
    { text: "⭐ Premium’a Geç", onPress: () => router.push("/premium") },
  ]
);
  return;
}

    const newCode = generateCode();

    await setDoc(doc(db, "chats", newCode), {
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000),
      ownerId: user.uid,
      participantsCount: 1,
    });

    
   
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

    const count = snap.data().participantsCount || 0;
    if (count >= MAX_PARTICIPANTS) {
      Alert.alert("Dolu Oda", "Bu oda dolu. (Maks. 8 kişi)");
      return;
    }

    await updateDoc(chatRef, { participantsCount: count + 1 });
    await saveChatToList(c);
    router.push(`/chat/${c}`);
  };

  /* 🟦 SEÇİM */
  const toggleSelect = (code: string) => {
    setSelected((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  

  const deleteSelected = async () => {
    const updated = Array.from(new Set([...deletedChats, ...selected]));
    setDeletedChats(updated);
    await AsyncStorage.setItem(DELETED_CHATS_KEY, JSON.stringify(updated));
    setSelected([]);
    setSelectMode(false);
  };

 const visibleChats = myChats.filter(
  (c) => !deletedChats.includes(c)
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
          <Animated.Text
            style={{
              fontSize: 52,
              textShadowColor: "#4FC3F7",
              textShadowRadius: 18,
              transform: [{ scale: pulseTop }],
            }}
          >
            🕶️
          </Animated.Text>
          <Text style={{ fontSize: 26, fontWeight: "800", color: "#fff" }}>
            Gizli Odaların
          </Text>
          <Animated.Text
            style={{
              color: "#8A8A8F",
              fontSize: 14,
              transform: [{ scale: pulseTop }],
            }}
          >
            Sadece davetlilerin girebildiği sohbetler
          </Animated.Text>
        </View>

        {/* CREATE */}
        <TouchableOpacity
          onPress={createChatAndGo}
          style={{
            backgroundColor: "#16161D",
            padding: 16,
            borderRadius: 16,
            marginBottom: 16,
            shadowColor: "#4FC3F7",
            shadowOpacity: 0.6,
            shadowRadius: 14,
          }}
        >
          <Text style={{ color: "#fff", textAlign: "center", fontSize: 17, fontWeight: "700" }}>
            🔐 Gizli Oda Oluştur
          </Text>
        </TouchableOpacity>
        <Text
  style={{
    color: "#8A8A8F",
    fontSize: 13,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 20,
  }}
>
  ⏳ Oluşturulan odalar 24 saat sonra otomatik silinir
</Text>

        <TextInput
          value={code}
          onChangeText={setCode}
          placeholder="Davet kodunu gir"
          placeholderTextColor="#666"
          autoCapitalize="characters"
          style={{
            backgroundColor: "#0F0F14",
            color: "#fff",
            borderWidth: 1,
            borderColor: "#2C2C35",
            borderRadius: 12,
            padding: 14,
            marginBottom: 12,
          }}
        />

        <TouchableOpacity
          onPress={goChatIfExists}
          style={{
            backgroundColor: "#007AFF",
            padding: 14,
            borderRadius: 14,
            marginBottom: 20,
            shadowColor: "#007AFF",
            shadowOpacity: 0.7,
            shadowRadius: 16,
          }}
        >
          <Text style={{ color: "#fff", textAlign: "center" }}>
            🎟️ Davet Kodu ile Gir
          </Text>
        </TouchableOpacity>

        {visibleChats.length > 0 && (
  <Text
    style={{
      color: "#8A8A8F",
      fontSize: 12,
      marginBottom: 10,
      textAlign: "left",
    }}
  >
    Sadece senin gördüklerin
  </Text>
)}

        {selectMode && (
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
          <TouchableOpacity
  onPress={() => {
    setSelectMode(false);
    setSelected([]);
  }}
  style={{
    position: "absolute",
    right: 0,
    top: -18,
    zIndex: 10,
  }}
>
  <Text style={{ color: "#fff", fontSize: 18 }}>✕</Text>
</TouchableOpacity>
            
            <TouchableOpacity
              onPress={deleteSelected}
              style={{
                flex: 1,
                padding: 12,
                backgroundColor: "#FF453A",
                borderRadius: 10,
              }}
            >
              <Text style={{ color: "#fff", textAlign: "center" }}>🗑️ Sil</Text>
            </TouchableOpacity>
          </View>
        )}

        <FlatList
          data={visibleChats}
          keyExtractor={(i) => i}
          renderItem={({ item }) => {
            const isSelected = selected.includes(item);
            return (
              <TouchableOpacity
                onPress={() => (selectMode ? toggleSelect(item) : router.push(`/chat/${item}`))}
                onLongPress={() => {
                  setSelectMode(true);
                  toggleSelect(item);
                }}
                style={{
                  padding: 14,
                  borderWidth: 1,
                  borderColor: isSelected ? "#4FC3F7" : "#2C2C35",
                  borderRadius: 14,
                  marginBottom: 10,
                  backgroundColor: "#111117",
                  shadowColor: isSelected ? "#4FC3F7" : "#000",
                  shadowOpacity: isSelected ? 0.8 : 0.2,
                  shadowRadius: isSelected ? 12 : 4,
                }}
              >
                <Text style={{ color: "#fff" }}>🕶️ {item}</Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <Text style={{ textAlign: "center", color: "#7A7A82", fontSize: 13 }}>
        Bağırmak yok. Fısıltı var.
      </Text>
    </SafeAreaView>
  );
}