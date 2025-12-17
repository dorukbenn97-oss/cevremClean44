import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../firebaseConfig";

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function Index() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [myChats, setMyChats] = useState<string[]>([]);

  /* 🔹 CHAT LİSTESİNİ YÜKLE */
  useEffect(() => {
    AsyncStorage.getItem("myChats").then((res) => {
      if (res) setMyChats(JSON.parse(res));
    });
  }, []);

  /* 🔹 CHAT LİSTEYE EKLE */
  const saveChatToList = async (chatCode: string) => {
    const updated = Array.from(new Set([chatCode, ...myChats]));
    setMyChats(updated);
    await AsyncStorage.setItem("myChats", JSON.stringify(updated));
  };

  /* 🔹 KOD AL */
  const createChatAndGo = async () => {
    const newCode = generateCode();

    await setDoc(doc(db, "chats", newCode), {
      createdAt: serverTimestamp(),
    });

    await saveChatToList(newCode);
    router.push(`/chat/${newCode}`);
  };

  /* 🔹 KOD İLE GİR */
  const goChatIfExists = async () => {
    const c = code.trim().toUpperCase();
    if (!c) return;

    const snap = await getDoc(doc(db, "chats", c));
    if (!snap.exists()) {
      Alert.alert("Geçersiz Kod", "Bu koda ait bir sohbet yok.");
      return;
    }

    await saveChatToList(c);
    router.push(`/chat/${c}`);
  };

  return (
    <View style={{ flex: 1, padding: 24 }}>
      <Text style={{ fontSize: 24, fontWeight: "700", marginBottom: 20 }}>
        Özel Sohbet
      </Text>

      {/* KOD AL */}
      <TouchableOpacity
        onPress={createChatAndGo}
        style={{
          backgroundColor: "#000",
          padding: 14,
          borderRadius: 10,
          marginBottom: 20,
        }}
      >
        <Text style={{ color: "#fff", textAlign: "center", fontSize: 16 }}>
          Kod Al
        </Text>
      </TouchableOpacity>

      <Text style={{ textAlign: "center", marginBottom: 10 }}>
        veya kod ile gir
      </Text>

      {/* KOD İLE GİR */}
      <TextInput
        value={code}
        onChangeText={setCode}
        placeholder="Sohbet kodu gir"
        autoCapitalize="characters"
        style={{
          borderWidth: 1,
          borderColor: "#ccc",
          borderRadius: 10,
          padding: 12,
          marginBottom: 12,
        }}
      />

      <TouchableOpacity
        onPress={goChatIfExists}
        style={{
          backgroundColor: "#007AFF",
          padding: 14,
          borderRadius: 10,
          marginBottom: 24,
        }}
      >
        <Text style={{ color: "#fff", textAlign: "center", fontSize: 16 }}>
          Sohbete Gir
        </Text>
      </TouchableOpacity>

      {/* 🔥 SADECE KOD GÖSTEREN CHAT LİSTESİ */}
      {myChats.length > 0 && (
        <>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              marginBottom: 12,
            }}
          >
            Sohbetlerim
          </Text>

          <FlatList
            data={myChats}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => router.push(`/chat/${item}`)}
                style={{
                  padding: 14,
                  borderWidth: 1,
                  borderColor: "#ddd",
                  borderRadius: 10,
                  marginBottom: 10,
                }}
              >
                <Text style={{ fontSize: 16 }}>🔒 {item}</Text>
              </TouchableOpacity>
            )}
          />
        </>
      )}
    </View>
  );
}