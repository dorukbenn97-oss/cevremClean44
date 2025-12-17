import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function ChatIndex() {
  const router = useRouter();
  const [code, setCode] = useState("");

  const goChat = (c: string) => {
    if (!c.trim()) return;
    router.push(`/chat/${c.trim()}`);
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
      <Text style={{ fontSize: 24, fontWeight: "700", marginBottom: 24 }}>
        Özel Sohbet
      </Text>

      {/* KOD AL */}
      <TouchableOpacity
        onPress={() => {
          const newCode = generateCode();
          setCode(newCode);
          goChat(newCode);
        }}
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
        onPress={() => goChat(code)}
        style={{
          backgroundColor: "#007AFF",
          padding: 14,
          borderRadius: 10,
        }}
      >
        <Text style={{ color: "#fff", textAlign: "center", fontSize: 16 }}>
          Sohbete Gir
        </Text>
      </TouchableOpacity>
    </View>
  );
}