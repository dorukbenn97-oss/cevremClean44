import { useRouter } from "expo-router";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../../firebaseConfig";

type MessageRequest = {
  from: string;
  postId: string;
  timestamp: number;
  id: string; // senderId
};

export default function RequestsScreen() {
  const router = useRouter();
  const currentUser = auth.currentUser?.uid;

  const [requests, setRequests] = useState<MessageRequest[]>([]);

  /* ---------------- INCOMING REQUESTS ---------------- */
  useEffect(() => {
    if (!currentUser) return;

    const q = collection(db, "messageRequests", currentUser, "incoming");

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({
        ...(d.data() as Omit<MessageRequest, "id">),
        id: d.id,
      }));

      setRequests(list);
    });

    return unsub;
  }, [currentUser]);

  /* ---------------- REJECT ---------------- */
  const rejectRequest = async (senderId: string) => {
    if (!currentUser) return;

    await deleteDoc(
      doc(db, "messageRequests", currentUser, "incoming", senderId)
    );
  };

  /* ---------------- ACCEPT ---------------- */
  const acceptRequest = async (senderId: string) => {
    if (!currentUser) return;

    const chatId = [currentUser, senderId].sort().join("_");

    // 1️⃣ CHAT ANA DOKÜMANI (KALICI)
    await setDoc(
      doc(db, "chats", chatId),
      {
        users: [currentUser, senderId],
        lastMessage: "Chat başlatıldı",
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );

    // 2️⃣ İLK SİSTEM MESAJI (varsa tekrar yazmaz)
    await setDoc(
      doc(db, "chats", chatId, "messages", "init"),
      {
        system: true,
        text: "Chat başlatıldı",
        senderId: "system",
        timestamp: serverTimestamp(),
      },
      { merge: true }
    );

    // 3️⃣ İSTEĞİ SİL
    await deleteDoc(
      doc(db, "messageRequests", currentUser, "incoming", senderId)
    );

    // 4️⃣ CHAT AÇ (⚠️ otherUserId ÇOK ÖNEMLİ)
    router.push(`/chat/${chatId}?otherUserId=${senderId}`);
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
                💬 Yeni mesaj isteği{"\n"}
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

/* ---------------- STYLES ---------------- */
const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "white" },
  title: { fontSize: 26, fontWeight: "700", marginBottom: 20 },
  empty: {
    fontSize: 16,
    color: "#888",
    marginTop: 20,
    textAlign: "center",
  },
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