import { router } from "expo-router";
import { signInAnonymously } from "firebase/auth";
import { Button, Text, View } from "react-native";
import { auth } from "../firebaseConfig";

export default function Login() {
  const loginNow = async () => {
    await signInAnonymously(auth);
    router.replace("/(tabs)");
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Giriş Yap</Text>
      <Button title="Anonim Giriş" onPress={loginNow} />
    </View>
  );
}