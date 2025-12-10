import { Tabs } from "expo-router";

export default function MainTabs() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      
      <Tabs.Screen name="index" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="post" />
      <Tabs.Screen name="map" />

      {/* ⭐ Mesaj istekleri */}
      <Tabs.Screen
        name="requests"
        options={{
          title: "Mesaj İstekleri",
          tabBarLabel: "İstekler",
        }}
      />
    </Tabs>
  );
}