import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

export default function Settings() {
  const router = useRouter();

  return (
    <>
      {/* ÜST BAR: geri butonu + başlık */}
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <View style={{ flex: 1, backgroundColor: "#fff" }}>
        {/* HEADER */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: "#eee",
          }}
        >
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={28} color="#000" />
          </TouchableOpacity>

          <Text
            style={{
              fontSize: 20,
              fontWeight: "bold",
              marginLeft: 8,
            }}
          >
            Ayarlar
          </Text>
        </View>

        {/* CONTENT */}
        <ScrollView style={{ padding: 16 }}>
          <Text style={{ fontWeight: "bold", marginTop: 12 }}>
            Premium Bilgilendirme
          </Text>
          <Text>
            Premium paket tüketilebilirdir. Premium satın alındığında 5 oda
            oluşturma hakkı tanımlar. Bu haklar kullanıldığında sona erer.
            Haklar bittiğinde isteğe bağlı olarak tekrar satın alınabilir.
            Abonelik veya otomatik yenileme bulunmamaktadır.
          </Text>

          <Text style={{ fontWeight: "bold", marginTop: 16 }}>
            Gizlilik ve Anonimlik
          </Text>
          <Text>
            Uygulama anonim kullanım esasına dayanır. Ad, soyad, telefon
            numarası veya e-posta adresi talep edilmez.
          </Text>

          <Text style={{ fontWeight: "bold", marginTop: 16 }}>
            Güvenlik
          </Text>
          <Text>
            Kullanıcılar mesajları şikayet edebilir ve diğer kullanıcıları
            engelleyebilir.
          </Text>

          <Text style={{ fontWeight: "bold", marginTop: 16 }}>
            İletişim
          </Text>
          <Text>dorukbenn97@gmail.com</Text>
        </ScrollView>
      </View>
    </>
  );
}