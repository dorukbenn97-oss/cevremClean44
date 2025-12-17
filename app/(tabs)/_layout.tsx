import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* SADECE kod bazlı sohbet */}
      <Stack.Screen name="index" />
      <Stack.Screen name="chat/[chatId]" />
    </Stack>
  );
}