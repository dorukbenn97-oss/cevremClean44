import { useRouter } from "expo-router";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { auth, db } from "../../firebaseConfig";

type MessageRequest = {
  from: string;
  postId: string;
  timestamp: number;
  id: string;
};

export default function RequestsScreen() {
  const router = useRouter();
  const currentUser = auth.currentUser?.uid;

  const [requests, setRequests] = useState<MessageRequest[]>([]);

  // 🔥 GELEN MESAJ İSTEKLERİNİ DİNLE
  useEffect(() => {
    if (!currentUser) return;

    const q = collection(db, "messageRequests", currentUser, "incoming");

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => {
        const data = d.data() as Omit<MessageRequest, "id">;
        return { ...data, id: d.id };
      });

      setRequests(list);
    });

    return unsub;
  }, [currentUser]);

  // ❌ REDDET
  const rejectRequest = async (senderId: string) => {
    await deleteDoc(doc(db, "messageRequests", currentUser!, "incoming", senderId));
  };

  // ⭐ KABUL ET → CHAT İKİ TARAFTA DA AÇILACAK
  const acceptRequest = async (senderId: string) => {
    if (!currentUser) return;

    const chatId = [currentUser, senderId].sort().join("_");

    // 1) CHAT OLUŞTUR / GÜNCELLE
    await setDoc(
      doc(db, "chats", chatId),
      {
        users: [currentUser, senderId],
        createdAt: Date.now(),
        ready: true   // 🔥 HER İKİ TARAFA DA CHATİN HAZIR OLDUĞUNU SÖYLER
      },
      { merge: true }
    );

    // 2) İLK MESAJ
    await setDoc(doc(db, "chats", chatId, "messages", "init"), {
      system: true,
      text: "Chat başlatıldı",
      timestamp: Date.now(),
    });

    // 3) İSTEĞİ SİL
    await deleteDoc(
      doc(db, "messageRequests", currentUser, "incoming", senderId)
    );

    // 4) KABUL EDEN TARAF İÇİN CHAT AÇ
    router.push(`/chat/${chatId}`);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mesaj İstekleri</Text>

      {requests.length === 0 ? (
        <Text style={styles.empty}>Hiç mesaj isteğin yok.</Text>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.requestBox}>
              <Text style={styles.requestText}>
                💬 Yeni mesaj isteği geldi!{"\n"}
                Gönderen: {item.id}
              </Text>

              <View style={styles.buttons}>
                <TouchableOpacity
                  onPress={() => rejectRequest(item.id)}
                  style={[styles.btn, { backgroundColor: "#e74c3c" }]}
                >
                  <Text style={styles.btnText}>Reddet</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => acceptRequest(item.id)}
                  style={[styles.btn, { backgroundColor: "#2ecc71" }]}
                >
                  <Text style={styles.btnText}>Kabul Et</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "white" },
  title: { fontSize: 26, fontWeight: "700", marginBottom: 20 },
  empty: { fontSize: 16, color: "#888", marginTop: 20, textAlign: "center" },
  requestBox: {
    padding: 15,
    borderRadius: 12,
    backgroundColor: "#f1f1f1",
    marginBottom: 15,
  },
  requestText: { fontSize: 15, marginBottom: 10 },
  buttons: { flexDirection: "row", justifyContent: "space-between" },
  btn: { padding: 10, borderRadius: 8, width: "48%" },
  btnText: { color: "white", textAlign: "center", fontWeight: "700" },
});