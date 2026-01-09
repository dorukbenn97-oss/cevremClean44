import { useRouter } from "expo-router";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Premium() {
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B0B0F" }}>
      <View style={{ flex: 1, padding: 24, justifyContent: "center" }}>
        
        <Text
          style={{
            fontSize: 28,
            fontWeight: "800",
            color: "#fff",
            textAlign: "center",
            marginBottom: 20,
          }}
        >
          ⭐ Premium ile Daha Rahat ✨
        </Text>

        <View
          style={{
            backgroundColor: "#111117",
            borderRadius: 16,
            padding: 20,
            borderWidth: 1,
            borderColor: "#2C2C35",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 16, marginBottom: 12 }}>
            • Aynı anda 5 gizli oda
          </Text>
          <Text style={{ color: "#fff", fontSize: 16, marginBottom: 12 }}>
            • her oda için maksimum 8 kişi
          </Text>
          <Text style={{ color: "#fff", fontSize: 16, marginBottom: 12 }}>
            • oda yönetim araçları
            
          </Text>

          
        </View>
        <TouchableOpacity
  onPress={() => {
    Alert.alert(
      "Premium",
      "Premium satın alma uygulama mağazası üzerinden aktif edilecektir"
    );
  }}
  style={{
    marginTop: 24,
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#1e90ff",
  }}
>
  <Text
    style={{
      color: "white",
      fontSize: 16,
      fontWeight: "600",
      textAlign: "center",
    }}
  >
    ⭐ Premium’a Geç
  </Text>
</TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            marginTop: 30,
            padding: 14,
            borderRadius: 12,
            backgroundColor: "#1C1C22",
          }}
        >
          <Text style={{ color: "#fff", textAlign: "center" }}>
            Geri Dön
          </Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}