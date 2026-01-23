import { useRouter } from "expo-router";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Premium() {
  const router = useRouter();

  /**
   * ⭐ PREMIUM SATIN ALMA
   * Apple App Store üzerinden sunulacaktır.
   * Şu anda yalnızca bilgilendirme ekranıdır.
   */
  function startPremiumPurchase() {
    Alert.alert(
      "Premium",
      "Premium özellikler yakında App Store üzerinden sunulacaktır."
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0B0B0F" }}>
      <View style={{ flex: 1, padding: 24, justifyContent: "center" }}>
        
        {/* BAŞLIK */}
        <Text
          style={{
            fontSize: 28,
            fontWeight: "800",
            color: "#fff",
            textAlign: "center",
            marginBottom: 20,
          }}
        >
          ⭐ Premium ile Daha Rahat
        </Text>

        {/* ÖZELLİKLER */}
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
            • Aynı anda 5 gizli oda açabilme
          </Text>

          <Text style={{ color: "#fff", fontSize: 16, marginBottom: 12 }}>
            • Her oda için 8 kişiye kadar katılım
          </Text>

          <Text style={{ color: "#fff", fontSize: 16 }}>
            • Oda yönetimi üzerinde daha fazla kontrol
          </Text>
        </View>

        {/* PREMIUM BUTONU */}
        <TouchableOpacity
          onPress={startPremiumPurchase}
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

        {/* KISA BİLGİ */}
        <Text
          style={{
            color: "#8A8A8F",
            fontSize: 12,
            marginTop: 16,
            textAlign: "center",
          }}
        >
          Premium özellikler ilerleyen sürümlerde aktif edilecektir.
        </Text>

        {/* GERİ DÖN */}
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