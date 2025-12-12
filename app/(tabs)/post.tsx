import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import React, { useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { auth, db } from "../../firebaseConfig";

export default function PostScreen() {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [4, 5],
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handleShare = async () => {
    try {
      if (!title.trim() && !text.trim() && !image) {
        Alert.alert("Uyarı", "Lütfen başlık, yazı veya fotoğraf ekleyin.");
        return;
      }

      // --- KONUM AL ---
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        return Alert.alert("Hata", "Konum izni verilmedi.");
      }

      const loc = await Location.getCurrentPositionAsync({});
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;

      if (!lat || !lng) {
        return Alert.alert("Hata", "Konum alınamadı.");
      }

      // --- FOTOĞRAF YÜKLE ---
      let downloadURL = null;
      if (image) {
        const storage = getStorage();
        const filename = `posts/${Date.now()}.jpg`;
        const storageRef = ref(storage, filename);

        const img = await fetch(image);
        const bytes = await img.blob();
        await uploadBytes(storageRef, bytes);
        downloadURL = await getDownloadURL(storageRef);
      }

      // --- FIRESTORE'A KAYDET ---
      await addDoc(collection(db, "posts"), {
        title: title.trim(),
        text: text.trim(),
        image: downloadURL,
        userId: auth.currentUser?.uid,
        createdAt: serverTimestamp(),
        lat,
        lng,
      });

      setTitle("");
      setText("");
      setImage(null);

      Alert.alert("✔", "Gönderi paylaşıldı!");
    } catch (err) {
      console.log("POST ERROR:", err);
      Alert.alert("Hata", "Gönderi paylaşılırken sorun oluştu.");
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Yeni Gönderi</Text>

      <TextInput
        placeholder="Başlık yaz..."
        style={styles.input}
        value={title}
        onChangeText={setTitle}
      />

      <TextInput
        placeholder="Açıklama..."
        style={[styles.input, { height: 100 }]}
        value={text}
        onChangeText={setText}
        multiline
      />

      {image && <Image source={{ uri: image }} style={styles.previewImage} />}

      <TouchableOpacity style={styles.photoBtn} onPress={pickImage}>
        <Text style={styles.photoBtnText}>Fotoğraf Seç</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
        <Text style={styles.shareBtnText}>Paylaş</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 20 },
  title: { fontSize: 32, fontWeight: "800", marginBottom: 20 },
  input: {
    backgroundColor: "#eee",
    padding: 14,
    borderRadius: 12,
    fontSize: 18,
    marginBottom: 20,
  },
  previewImage: {
    width: "100%",
    aspectRatio: 4 / 5,
    borderRadius: 16,
    marginBottom: 20,
  },
  photoBtn: {
    backgroundColor: "#333",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 20,
  },
  photoBtnText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  shareBtn: {
    backgroundColor: "green",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  shareBtnText: { color: "#fff", fontSize: 20, fontWeight: "700" },
});