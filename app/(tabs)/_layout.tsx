import { Tabs } from "expo-router";

export default function MainTabs() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      

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

      

      {/* Profil */}
      <Tabs.Screen
        name="profile"
        options={{ title: "Profil" }}
      />
    </Tabs>
  );
}