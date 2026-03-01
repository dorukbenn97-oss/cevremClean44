import { useRouter } from "expo-router";
import { doc, increment, updateDoc } from "firebase/firestore";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../firebaseConfig";

export default function Premium() {
  const router = useRouter();

  /**
   * ➕ 5 ODA PAKETİ SATIN ALMA
   * Bu buton SADECE +5 oda ekler.
   * Premium (isPremium) ayrı bir sistemdir.
   */
  async function startPremiumPurchase() {
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert("Hata", "Kullanıcı bulunamadı.");
        return;
      }

      const userRef = doc(db, "users", user.uid);

      // ✅ SADECE +5 oda ekler
      await updateDoc(userRef, {
        roomQuota: increment(5),
      });

      Alert.alert(
        "Başarılı 🎉",
        "+5 Oda hakkı hesabına eklendi.",
        [{ text: "Tamam", onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert("Hata", "Satın alma işlemi başarısız.");
    }
  }

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
          ⭐ Oda Paketleri
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
            • +5 Ekstra Oda hakkı kazanırsın
          </Text>

          <Text style={{ color: "#fff", fontSize: 16, marginBottom: 12 }}>
            • Her oda için 8 kişiye kadar katılım
          </Text>

          <Text style={{ color: "#fff", fontSize: 16 }}>
            • Premium kullanıcıysan mevcut limitine eklenir
          </Text>
        </View>

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
            ➕ 5 Oda Satın Al
          </Text>
        </TouchableOpacity>

        <Text
          style={{
            color: "#8A8A8F",
            fontSize: 12,
            marginTop: 16,
            textAlign: "center",
          }}
        >
          Satın alma sonrası oda hakkı anında hesabına eklenir.
        </Text>

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