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

export default function Index() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [myChats, setMyChats] = useState<string[]>([]);

  /* 🔥 PULSE ANİMASYONU */
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.04,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

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
      Alert.alert("Geçersiz Kod", "Bu davet koduna ait bir oda yok.");
      return;
    }

    await saveChatToList(c);
    router.push(`/chat/${c}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#0B0B0F", padding: 24 }}>
      {/* 🎭 HERO */}
      <View style={{ alignItems: "center", marginBottom: 30 }}>
        <Animated.Text
          style={{
            fontSize: 50,
            transform: [{ scale: pulse }],
            marginBottom: 12,
          }}
        >
          🕶️
        </Animated.Text>

        <Text
          style={{
            fontSize: 24,
            fontWeight: "800",
            color: "#fff",
            textAlign: "center",
          }}
        >
          Sadece İkinizin Bildiği
        </Text>

        <Text
          style={{
            marginTop: 6,
            color: "#8A8A8F",
            textAlign: "center",
            fontSize: 14,
          }}
        >
          Davet yoksa giriş yok
        </Text>
      </View>

      {/* 🔥 AKTİF HİS */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          marginBottom: 22,
        }}
      >
        <Animated.View
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: "#FF3B30",
            marginRight: 8,
            transform: [{ scale: pulse }],
          }}
        />
        <Text style={{ color: "#9A9A9F", fontSize: 13 }}>
          Şu an aktif gizli odalar var
        </Text>
      </View>

      {/* 🔐 KOD AL */}
      <TouchableOpacity
        onPress={createChatAndGo}
        style={{
          backgroundColor: "#16161D",
          padding: 16,
          borderRadius: 14,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: "#2C2C35",
        }}
      >
        <Text
          style={{
            color: "#fff",
            textAlign: "center",
            fontSize: 17,
            fontWeight: "700",
          }}
        >
          🔐 Gizli Oda Oluştur
        </Text>
      </TouchableOpacity>

      {/* 🎟️ KOD İLE GİR */}
      <TextInput
        value={code}
        onChangeText={setCode}
        placeholder="Davet kodu"
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
          borderRadius: 12,
          marginBottom: 28,
        }}
      >
        <Text style={{ color: "#fff", textAlign: "center", fontSize: 16 }}>
          🎟️ Kod ile Gir
        </Text>
      </TouchableOpacity>

      {/* 🔒 SOHBETLERİM */}
      {myChats.length > 0 && (
        <>
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: "#fff",
              marginBottom: 12,
            }}
          >
            Gizli Odaların
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
                  borderColor: "#2C2C35",
                  borderRadius: 12,
                  marginBottom: 10,
                  backgroundColor: "#111117",
                }}
              >
                <Text style={{ fontSize: 16, color: "#fff" }}>
                  🕶️ {item}
                </Text>
              </TouchableOpacity>
            )}
          />
        </>
      )}
    </View>
  );
}