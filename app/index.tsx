import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
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
import { db } from "../firebaseConfig";

/* 🔐 6 HANELİ GİZLİ KOD */
function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const EMPTY_HINT_KEY = "hasSeenEmptyHint";
const HIDDEN_CHATS_KEY = "hiddenChats";
const DELETED_CHATS_KEY = "deletedChats";
const UNREAD_CHATS_KEY = "unreadChats";

export default function Index() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [myChats, setMyChats] = useState<string[]>([]);
  const [showEmptyHint, setShowEmptyHint] = useState(false);

  const [hiddenChats, setHiddenChats] = useState<string[]>([]);
  const [deletedChats, setDeletedChats] = useState<string[]>([]);
  const [unreadChats, setUnreadChats] = useState<string[]>([]);

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  /* 🔥 PULSE */
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.04, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  /* 🔹 LOAD */
  useEffect(() => {
    (async () => {
      const chats = JSON.parse((await AsyncStorage.getItem("myChats")) || "[]");
      setMyChats(chats);

      setHiddenChats(JSON.parse((await AsyncStorage.getItem(HIDDEN_CHATS_KEY)) || "[]"));
      setDeletedChats(JSON.parse((await AsyncStorage.getItem(DELETED_CHATS_KEY)) || "[]"));
      setUnreadChats(JSON.parse((await AsyncStorage.getItem(UNREAD_CHATS_KEY)) || "[]"));

      const seen = await AsyncStorage.getItem(EMPTY_HINT_KEY);
      if (!seen && chats.length === 0) setShowEmptyHint(true);
    })();
  }, []);

  /* 🔹 SAVE CHAT */
  const saveChatToList = async (chatCode: string) => {
    const updated = Array.from(new Set([chatCode, ...myChats]));
    setMyChats(updated);
    await AsyncStorage.setItem("myChats", JSON.stringify(updated));

    setHiddenChats(hiddenChats.filter((c) => c !== chatCode));
    setDeletedChats(deletedChats.filter((c) => c !== chatCode));
    setUnreadChats(unreadChats.filter((c) => c !== chatCode));

    await AsyncStorage.multiSet([
      [HIDDEN_CHATS_KEY, JSON.stringify(hiddenChats.filter((c) => c !== chatCode))],
      [DELETED_CHATS_KEY, JSON.stringify(deletedChats.filter((c) => c !== chatCode))],
      [UNREAD_CHATS_KEY, JSON.stringify(unreadChats.filter((c) => c !== chatCode))],
    ]);
  };

  /* 🔹 BULK ACTIONS */
  const bulkHide = async () => {
    const updated = Array.from(new Set([...hiddenChats, ...selected]));
    setHiddenChats(updated);
    await AsyncStorage.setItem(HIDDEN_CHATS_KEY, JSON.stringify(updated));
    exitSelect();
  };

  const bulkDelete = async () => {
    const updated = Array.from(new Set([...deletedChats, ...selected]));
    setDeletedChats(updated);
    await AsyncStorage.setItem(DELETED_CHATS_KEY, JSON.stringify(updated));
    exitSelect();
  };

  const exitSelect = () => {
    setSelectMode(false);
    setSelected([]);
  };

  /* 🔹 CREATE */
  const createChatAndGo = async () => {
    const newCode = generateCode();
    await setDoc(doc(db, "chats", newCode), { createdAt: serverTimestamp() });
    await saveChatToList(newCode);
    router.push(`/chat/${newCode}`);
  };

  /* 🔹 JOIN */
  const goChatIfExists = async () => {
    const c = code.trim().toUpperCase();
    if (!c) return;

    const snap = await getDoc(doc(db, "chats", c));
    if (!snap.exists()) {
      Alert.alert("Geçersiz Kod", "Bu davet koduna ait bir oda yok.");
      return;
    }

    await saveChatToList(c);
    router.push(`/chat/${c}`);
  };

  const visibleChats = myChats.filter(
    (c) => !hiddenChats.includes(c) && !deletedChats.includes(c)
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#0B0B0F", padding: 24 }}>
      {/* HERO */}
      <View style={{ alignItems: "center", marginBottom: 30 }}>
        <Animated.Text style={{ fontSize: 50, transform: [{ scale: pulse }] }}>🕶️</Animated.Text>
        <Text style={{ fontSize: 26, fontWeight: "800", color: "#fff" }}>Gizli Odaların</Text>
        <Text style={{ color: "#8A8A8F", fontSize: 14 }}>
          Sadece davetlilerin girebildiği sohbetler
        </Text>
      </View>

      {/* TOP BAR (SEÇİM MODU) */}
      {selectMode && (
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
          <Text style={{ color: "#fff" }}>{selected.length} seçildi</Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Text onPress={bulkHide} style={{ color: "#8A8A8F" }}>👁 Gizle</Text>
            <Text onPress={bulkDelete} style={{ color: "#ff4d4d" }}>🗑 Sil</Text>
            <Text onPress={exitSelect} style={{ color: "#8A8A8F" }}>✖</Text>
          </View>
        </View>
      )}

      {/* CREATE */}
      <TouchableOpacity onPress={createChatAndGo} style={{
        backgroundColor: "#16161D", padding: 16, borderRadius: 14, marginBottom: 16,
        borderWidth: 1, borderColor: "#2C2C35",
      }}>
        <Text style={{ color: "#fff", textAlign: "center", fontSize: 17, fontWeight: "700" }}>
          🔐 Gizli Oda Oluştur
        </Text>
      </TouchableOpacity>

      {/* JOIN */}
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

      <TouchableOpacity onPress={goChatIfExists} style={{
        backgroundColor: "#007AFF", padding: 14, borderRadius: 12, marginBottom: 28,
      }}>
        <Text style={{ color: "#fff", textAlign: "center", fontSize: 16 }}>
          🎟️ Davet Kodu ile Gir
        </Text>
      </TouchableOpacity>

      {/* LIST */}
      {visibleChats.length > 0 && (
        <>
          <Text style={{ fontSize: 18, fontWeight: "700", color: "#fff" }}>Gizli Odaların</Text>
          <Text style={{ color: "#8A8A8F", fontSize: 12, marginBottom: 10 }}>
            Sadece senin gördüklerin
          </Text>

          <FlatList
            data={visibleChats}
            keyExtractor={(i) => i}
            renderItem={({ item }) => {
              const isSelected = selected.includes(item);
              const isUnread = unreadChats.includes(item);

              return (
                <TouchableOpacity
                  onLongPress={() => {
                    setSelectMode(true);
                    setSelected([item]);
                  }}
                  onPress={() => {
                    if (selectMode) {
                      setSelected((prev) =>
                        prev.includes(item)
                          ? prev.filter((c) => c !== item)
                          : [...prev, item]
                      );
                    } else {
                      router.push(`/chat/${item}`);
                    }
                  }}
                  style={{
                    padding: 14,
                    borderWidth: 1,
                    borderColor: isSelected ? "#007AFF" : "#2C2C35",
                    borderRadius: 12,
                    marginBottom: 10,
                    backgroundColor: "#111117",
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 16, color: "#fff" }}>🕶️ {item}</Text>
                  {isUnread && <View style={{
                    width: 8, height: 8, borderRadius: 4, backgroundColor: "#007AFF"
                  }} />}
                </TouchableOpacity>
              );
            }}
          />
        </>
      )}

      <Text style={{ marginTop: 16, textAlign: "center", color: "#5F5F66", fontSize: 12 }}>
        Bağırmak yok. Fısıltı var.
      </Text>
    </View>
  );
}