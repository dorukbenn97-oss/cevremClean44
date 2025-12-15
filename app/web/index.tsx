import { Link } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

export default function WebHome() {
  const [code, setCode] = useState("");

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Çevrem Web</Text>

      <Text style={styles.subtitle}>
        Post kodu ile gönderi bul
      </Text>

      <TextInput
        placeholder="Post Kodu (örn: A3F9)"
        value={code}
        onChangeText={setCode}
        style={styles.input}
        autoCapitalize="characters"
      />

      {code.length >= 3 && (
        <Link href={`/web/postdetail/${code}`} style={styles.button}>
          Gönderiyi Aç
        </Link>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0f0f0f",
  },
  title: {
    fontSize: 36,
    fontWeight: "800",
    color: "white",
    marginBottom: 10,
  },
  subtitle: {
    color: "#aaa",
    marginBottom: 20,
  },
  input: {
    backgroundColor: "#222",
    color: "white",
    padding: 14,
    borderRadius: 10,
    width: 260,
    textAlign: "center",
    fontSize: 18,
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#30d158",
    color: "black",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    fontSize: 18,
    fontWeight: "700",
  },
});