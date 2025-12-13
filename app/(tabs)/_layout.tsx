import { Tabs } from "expo-router";

export default function MainTabs() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      {/* Ana akış */}
      <Tabs.Screen
        name="index"
        options={{ title: "Anasayfa" }}
      />

      {/* Mesajlar (CHAT LİSTESİ) */}
      <Tabs.Screen
        name="chats"
        options={{
          title: "Mesajlar",
          tabBarLabel: "Mesajlar",
        }}
      />

      {/* Mesaj İstekleri */}
      <Tabs.Screen
        name="requests"
        options={{
          title: "Mesaj İstekleri",
          tabBarLabel: "İstekler",
        }}
      />

      {/* Post */}
      <Tabs.Screen
        name="post"
        options={{ title: "Paylaş" }}
      />

      {/* Harita */}
      <Tabs.Screen
        name="map"
        options={{ title: "Harita" }}
      />

      {/* Profil */}
      <Tabs.Screen
        name="profile"
        options={{ title: "Profil" }}
      />
    </Tabs>
  );
}