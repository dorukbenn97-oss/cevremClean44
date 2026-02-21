import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import * as Clipboard from "expo-clipboard";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getAuth } from "firebase/auth";
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import VoiceMessage from "../../components/voiceMessage";
import { db, storage } from "../../firebaseConfig";

/* 🆔 DEVICE ID */
async function getDeviceId(): Promise<string> {
  if (Platform.OS === "web") {
    let id = localStorage.getItem("deviceId");
    if (!id) {
      id = Math.random().toString(36).substring(2, 10);
      localStorage.setItem("deviceId", id);
    }
    return id;
  }
  let id = await AsyncStorage.getItem("deviceId");
  if (!id) {
    id = Math.random().toString(36).substring(2, 10);
    await AsyncStorage.setItem("deviceId", id);
  }
  return id;
}

/* 🕒 TIME */
function formatTime(ts: any) {
  if (!ts?.seconds) return "";
  const d = new Date(ts.seconds * 1000);
  return d.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* STORAGE */
async function getStoredNick(key: string): Promise<string | null> {
  if (Platform.OS === "web") return localStorage.getItem(key);
  return await AsyncStorage.getItem(key);
}
async function setStoredNick(key: string, value: string) {
  if (Platform.OS === "web") localStorage.setItem(key, value);
  else await AsyncStorage.setItem(key, value);
}

export default function ChatRoom() {
  
  
  // ✅ AKTİFLİK GÜNCELLE (pasif düşmeyi engeller)
async function bumpActive() {
  try {
    if (!chatId || !deviceId) return;

    await setDoc(
      doc(db, "chats", chatId, "users", deviceId),
      {
        nick: nick || "Anon",
        lastActive: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (e) {}
}

  async function requestLocation() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    alert("Konum izni verilmedi");
    return;
  }

  // 1️⃣ ÖNCE konumu al
  const loc = await Location.getCurrentPositionAsync({});

  // 2️⃣ SONRA Firestore’a yaz
  await addDoc(collection(db, "chats", chatId!, "messages"), {
    type: "location",
    lat: loc.coords.latitude,
    lng: loc.coords.longitude,
    senderId: deviceId,
    nick: nick,
    readBy: [deviceId],
    createdAt: serverTimestamp(),
    deleted: false,
    replyTo: replyTo
  ? {
      id: replyTo.id,
      text: replyTo.text || "",
      type: replyTo.type || "text",
      nick: replyTo.nick || "",
    }
  : null,
  });
  setReplyTo(null);

  // 3️⃣ Modal kapat
  setLocationModalOpen(false);
}

  
  const [isRecordingUI, setIsRecordingUI] = useState(false);
  
  

// tekrar getStorage YOK
const auth = getAuth();
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
const [isRecording, setIsRecording] = useState(false);

const [locationModalOpen, setLocationModalOpen] = useState(false);
const [someoneRecording, setSomeoneRecording] = useState(false);

  

async function startRecording() {
  if (recording) return;
 
  if (!chatId || !deviceId) return;
  await setDoc(
  doc(db, "chats", chatId, "typing", deviceId),
  {
    type: "voice",
    updatedAt: serverTimestamp(),
  }
);
  try {
    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) return;

   await Audio.setAudioModeAsync({
  allowsRecordingIOS: true,
  playsInSilentModeIOS: true,
  
});

    const rec = new Audio.Recording();
    await rec.prepareToRecordAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    await rec.startAsync();
    setSomeoneRecording(true);
    setRecording(rec);
    setIsRecording(true);
  } catch (err) {
    console.log("record error", err);
  }
}

async function stopRecording() {
  if (isStoppingRef.current) return;
  isStoppingRef.current = true;
  try {

    if (chatId && deviceId) {
      await deleteDoc(doc(db, "chats", chatId, "typing", deviceId));
      
    }

    if (!recording) {
  isStoppingRef.current = false;
  return;
}

    setIsRecording(false);
    await recording.stopAndUnloadAsync();
    setSomeoneRecording(false);


const uri = recording.getURI();
setMessages((prev) => [
  {
    id: "temp-" + Date.now(),
    type: "voice",
    localUri: uri,
    senderId: deviceId,
    nick: nick,
    uploading: true,
  },
  ...prev,
]);
if (!uri) {
  isStoppingRef.current = false;
  return;
}
if (!chatId || typeof chatId !== "string") {
  isStoppingRef.current = false;
  return;
}



   

    const response = await fetch(uri);
    const blob = await response.blob();

    const fileName = `voices/${chatId}/${Date.now()}.m4a`;
    const storageRef = ref(storage, fileName);

    await uploadBytes(storageRef, blob);
    const downloadURL = await getDownloadURL(storageRef);

    await addDoc(collection(db, "chats", chatId, "messages"), {
  type: "voice",
  audioUrl: downloadURL,
  senderId: deviceId,
  readBy: [deviceId],      // ✅ okundu fix
  nick: nick,              // ✅ düzeltildi
  createdAt: serverTimestamp(),
 
});
setMessages((prev) =>
  prev.filter((m) => !m.id?.startsWith("temp-"))
);
setReplyTo(null);
setSomeoneRecording(false);

    // 🔊 KAYITTAN ÇIK → ÇALMA MODU
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });

    setRecording(null);
 } catch (e) {
    console.log("Ses gönderme hatası:", e);
  } finally {
    isStoppingRef.current = false;
  }
}
async function cancelRecording() {
  try {
    if (!recording) return;
    if (chatId && deviceId) {
  await deleteDoc(doc(db, "chats", chatId, "typing", deviceId));
}

    await recording.stopAndUnloadAsync();
    setRecording(null);
    setIsRecording(false);
  } catch (e) {
    console.log("Kayıt iptal hatası:", e);
  }
}
  const pulseTop = useRef(new Animated.Value(1)).current;
  const isStoppingRef = useRef(false);

useEffect(() => {
  Animated.loop(
    Animated.sequence([
      Animated.timing(pulseTop, {
        toValue: 1.08,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.timing(pulseTop, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
    ])
  ).start();
}, []);
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const chatId = Array.isArray(params.code) ? params.code[0] : params.code;
  const [deviceId, setDeviceId] = useState<string | null>(null);
  // 🔥 ODAYA GİRER GİRMEZ AKTİF YAP
useEffect(() => {
  if (!chatId || !deviceId) return;
  bumpActive();
}, [chatId, deviceId]);


  const [blockedIds, setBlockedIds] = useState<string[]>([]);
 
  useEffect(() => {
  if (!chatId || !deviceId) return;

  const typingRef = collection(db, "chats", chatId, "typing");

  const unsub = onSnapshot(typingRef, (snap) => {
    const otherRecording = snap.docs.some(
  (d) =>
    d.id !== deviceId &&
    d.data()?.type === "voice" &&
    !blockedIds.includes(d.id)
);
setSomeoneRecording(otherRecording);
  });

  return () => unsub();
}, [chatId, deviceId, blockedIds]);
  
  const [ownerId, setOwnerId] = useState<string | null>(null);

  const [nick, setNick] = useState("");
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [ready, setReady] = useState(false);
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [someoneTyping, setSomeoneTyping] = useState(false);
  const [nickModalVisible, setNickModalVisible] = useState(false);

  const [locked, setLocked] = useState(false);
  const [closed, setClosed] = useState(false);

  const [usersInRoom, setUsersInRoom] = useState<
    { id: string; nick: string }[]
  >([]);
  

  const typingTimeout = useRef<any>(null);

  /* ✅ FIX: OWNER ARTIK AUTH UID */
  const isOwner =
    !!auth.currentUser && !!ownerId && ownerId === auth.currentUser.uid;

  /* DEVICE */
  useEffect(() => {
    getDeviceId().then(setDeviceId);
  }, []);
 useEffect(() => {
  if (!chatId || !deviceId) return;

  const sub = AppState.addEventListener("change", async (state) => {
    if (state === "active") {
      // 🔥 Firestore aktiflik
      try {
        await bumpActive();

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
      } catch (e) {
        console.log("AppState active hatası:", e);
      }
    }

    if (state === "background") {
      // ❌ Arka planda kayıt varsa temizle
      if (recording) {
        try {
          await recording.stopAndUnloadAsync();
        } catch {}
        setRecording(null);
        setIsRecording(false);
        setSomeoneRecording(false);
      }
    }
  });

  return () => sub.remove();
}, [chatId, deviceId, recording]);
  /* CHAT META + GİRİŞ KONTROLÜ */
  useEffect(() => {
    if (!chatId || !deviceId) return;

    const ref = doc(db, "chats", chatId);
    const usersRef = collection(db, "chats", chatId, "users");
    const userDoc = doc(usersRef, deviceId);
    

    (async () => {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        Alert.alert("Geçersiz Kod");
        router.replace("/");
        return;
      }
      const data = snap.data();
      

      if (data.closed) {
        Alert.alert("Sohbet kapalı", "Bu sohbet kalıcı olarak kapatıldı");
        router.replace("/");
        return;
      }

      if (data.locked && auth.currentUser?.uid !== data.ownerId) {
  Alert.alert("Oda Kilitli", "Bu oda kilitli.");
  router.replace("/");
  return;
}
      // 🔐 GERÇEK 8 KİŞİ LİMİTİ
const usersSnap = await getDocs(usersRef);

const now = Date.now();
const activeCount = usersSnap.docs.filter((d) => {
  const last = d.data().lastActive?.toMillis?.() || 0;
  return true;
}).length;

if (activeCount >= 8) {
  const meInside = await getDoc(userDoc);
  if (!meInside.exists()) {
    Alert.alert(
      "Oda Dolu",
      "Bu oda en fazla 8 kişiliktir."
    );
    router.replace("/");
    return;
  }
}
    })();

    return onSnapshot(ref, async (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();

      // 🔑 ownerId artık UID olarak okunur (YAZILMAZ!)
      setOwnerId(data.ownerId || null);
      setLocked(!!data.locked);
      setClosed(!!data.closed);
      setReady(true);
    });
  }, [chatId, deviceId]);

  /* USERS IN ROOM */
  useEffect(() => {
    if (!ready || !chatId || !deviceId) return;

    const usersRef = collection(db, "chats", chatId, "users");
    const userDoc = doc(usersRef, deviceId);

    (async () => {
      const savedNick = await getStoredNick(`nick-${chatId}-${deviceId}`);
      if (!savedNick) setNickModalVisible(true);
      else setNick(savedNick);
    })();

    const unsub = onSnapshot(usersRef, (snap) => {
      const now = Date.now();
      const activeUsers = snap.docs
        .filter((d) => {
          const last = d.data().lastActive?.toMillis?.() || 0;
          return true;
        })
        .map((d) => ({
          id: d.id,
          nick: d.data().nick || `Anon-${d.id.substring(0, 4)}`,
        }));
      setUsersInRoom(activeUsers);
    });

    

    return () => {
      
      
      
      unsub();
    };
  }, [ready, chatId, deviceId, nick]);

  /* MESSAGES */
  useEffect(() => {
    if (!ready || !chatId || !deviceId) return;

    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "desc")
    );

    return onSnapshot(q, (snap) => {
  const list = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((m) => !(m as any).deleted);

 snap.docs.forEach((msgDoc) => {
  const msg = msgDoc.data();
  if (
    msg.senderId !== deviceId &&
    !msg.readBy?.includes(deviceId)
  ) {
    updateDoc(msgDoc.ref, {
      readBy: arrayUnion(deviceId),
    });
  }
});

  setMessages(list);
});


  }, [ready, chatId, deviceId]);

  /* TYPING */
  useEffect(() => {
    if (!ready || !chatId || !deviceId || closed) return;
    return onSnapshot(collection(db, "chats", chatId, "typing"), (snap) => {
      setSomeoneTyping(
        snap.docs.some(
          (d) => d.id !== deviceId && !blockedIds.includes(d.id)
        )
      );
    });
  }, [ready, chatId, deviceId, closed, blockedIds]);

  const handleTyping = async (v: string) => {
    
    if (!chatId || !deviceId || closed) return;
    setText(v);

    if (typingTimeout.current) clearTimeout(typingTimeout.current);

    if (!v) {
      await deleteDoc(doc(db, "chats", chatId, "typing", deviceId));
      return;
    }

    await setDoc(doc(db, "chats", chatId, "typing", deviceId), {
      typing: true,
    });

    typingTimeout.current = setTimeout(async () => {
      await deleteDoc(doc(db, "chats", chatId, "typing", deviceId));
    }, 2000);
  };

  const sendMessage = async () => {
    await bumpActive();
    if (!text.trim() || !chatId || !deviceId || closed) return;

    await addDoc(collection(db, "chats", chatId, "messages"), {
  text,
  senderId: deviceId,
  nick,
  createdAt: serverTimestamp(),
  readBy: [deviceId],
  deleted: false,

  replyTo: replyTo
    ? {
        id: replyTo.id,
        text: replyTo.text || "",
        type: replyTo.type || "text",
        nick: replyTo.nick || "",
      }
    : null,
});

    await deleteDoc(doc(db, "chats", chatId, "typing", deviceId));
    setText("");
    setReplyTo(null);
  };

  const deleteMessageForEveryone = async (msg: any) => {
    if (msg.senderId !== deviceId) return;

    Alert.alert("Mesajı Sil", "Bu mesaj herkes için silinecek.", [
      { text: "İptal", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          await updateDoc(
            doc(db, "chats", chatId!, "messages", msg.id),
            {
              deleted: true,
              text: "",
            }
          );
        },
      },
    ]);
  };

  const toggleLock = async () => {
    if (!isOwner || closed) return;
    await updateDoc(doc(db, "chats", chatId!), { locked: !locked });
  };

  const closeChatForever = async () => {
    if (!isOwner) return;

    Alert.alert("Sohbeti Kapat", "Bu sohbet kalıcı olarak kapatılacak.", [
      { text: "İptal", style: "cancel" },
      {
        text: "Kapat",
        style: "destructive",
        onPress: async () => {
          await updateDoc(doc(db, "chats", chatId!), {
            closed: true,
            locked: true,
          });
          router.replace("/");
        },
      },
    ]);
  };

  /* 🚩 REPORT */
  const reportUser = async (msg: any) => {
    await addDoc(collection(db, "reports"), {
      chatId,
      reportedUser: msg.senderId,
      reportedNick: msg.nick,
      message: msg.text,
      reporter: deviceId,
      createdAt: serverTimestamp(),
    });
    Alert.alert("Teşekkürler", "Bildiriminiz için teşekkür ederiz.");
  };

  if (!ready) return null;

  return (
    <KeyboardAvoidingView
  style={{ flex: 1, backgroundColor: "#0B0B0F" }}
  behavior={Platform.OS === "ios" ? "padding" : "height"}
  keyboardVerticalOffset={Platform.OS === "android" ? 20 : 0}
>
      {/* NICK MODAL */}
      <Modal visible={nickModalVisible} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "#00000099",
          }}
        >
          <View
            style={{
              backgroundColor: "#111",
              padding: 20,
              borderRadius: 10,
              width: "80%",
            }}
          >
            <TouchableOpacity
  onPress={async () => {
    // ❌ nick kaydı OLMASIN
    setNick("");

    // ❌ modal kapansın
    setNickModalVisible(false);

    // 🔙 odadan tamamen çık
    router.back();
  }}
  style={{
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 10,
  }}
>
  <Text style={{ color: "#fff", fontSize: 18 }}>✕</Text>
</TouchableOpacity>
           
            <Text style={{ color: "#fff", marginBottom: 10 }}>
              Nick giriniz:
            </Text>
            <TextInput
              style={{
                backgroundColor: "#222",
                color: "#fff",
                padding: 10,
                borderRadius: 8,
              }}
              placeholder="Nick"
              placeholderTextColor="#888"
              value={nick}
              onChangeText={setNick}
            />
            <TouchableOpacity
  onPress={async () => {
    if (!nick.trim()) return;

   // Nick kaydet
await setStoredNick(
  `nick-${chatId}-${deviceId}`,
  nick.trim()
);

// ✅ ODA ARTIK GERÇEK → LİSTEYE EKLE
const stored = JSON.parse(
  (await AsyncStorage.getItem("myChats")) || "[]"
);
const updated = Array.from(new Set([chatId, ...stored]));
await AsyncStorage.setItem("myChats", JSON.stringify(updated));

// ✅ HAK SADECE ODA SAHİBİ İSE DÜŞER
if (auth.currentUser?.uid === ownerId) {
  const userRef = doc(db, "users", auth.currentUser.uid);
  await updateDoc(userRef, {
    roomsUsed: increment(1),
  }).catch(() => {});
}

setNickModalVisible(false);
  }}
  style={{
    marginTop: 10,
    backgroundColor: "#007AFF",
    padding: 10,
    borderRadius: 8,
  }}
>
  <Text style={{ color: "#fff", textAlign: "center" }}>
    Kaydet
  </Text>
</TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* HEADER */}
      <View
        style={{
          padding: 14,
          borderBottomWidth: 1,
          borderColor: "#1C1C22",
          backgroundColor: "#111117",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <View>
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff" }}>
            Sohbet {closed ? "🛑" : locked ? "🔒" : ""}
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Text style={{ color: "#4FC3F7" }}>Kod: {chatId}</Text>
            <TouchableOpacity
              onPress={() => Clipboard.setStringAsync(chatId || "")}
            >
              <Text style={{ color: "#4FC3F7" }}>📋 Kopyala</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ color: "#4FC3F7", marginTop: 4 }}>
           Katılımcılar: {usersInRoom.length}
          </Text>
          
          <Animated.View

  style={{
    marginTop: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#4FC3F7",
    backgroundColor: "rgba(79,195,247,0.08)",
    shadowColor: "#4FC3F7",
    shadowOpacity: 0.8,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    transform: [{ scale: pulseTop }],
  }}
>
  <Text
    style={{
      color: "#4FC3F7",
      fontSize: 12,
      fontWeight: "700",
    }}
  >
    Maks. 8 kişi
  </Text>
</Animated.View>
        </View>

        <View style={{ flexDirection: "row", gap: 14 }}>
          {isOwner && !closed && (
            <>
              <TouchableOpacity onPress={toggleLock}>
                <Text style={{ color: "#4FC3F7" }}>
                  {locked ? "Kilidi Aç" : "Kilitle"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={closeChatForever}>
                <Text style={{ color: "#FF453A" }}>Kapat</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity
  onPress={async () => {
    if (!chatId || !deviceId) {
      router.back();
      return;
    }

    await deleteDoc(doc(db, "chats", chatId, "users", deviceId)).catch(() => {});
    await updateDoc(doc(db, "chats", chatId), {
      participantsCount: increment(-1),
    }).catch(() => {});

    router.back();
  }}
>
            <Text style={{ fontSize: 18, color: "#fff" }}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* MESSAGES */}
      <FlatList
  data={messages}
  inverted
  keyExtractor={(i) => i.id}
  contentContainerStyle={{ padding: 16, flexGrow: 1, justifyContent: "flex-end" }}
  removeClippedSubviews={false}
  renderItem={({ item }) => {
    
          const isMe = item.senderId === deviceId;
          const readCount = item.readBy?.length || 0;
         
          if (!isMe && blockedIds.includes(item.senderId)) return null;
if (item.type === "location") {
  if (!isMe && !item.readBy?.includes(deviceId)) {
  updateDoc(
    doc(db, "chats", chatId!, "messages", item.id),
    { readBy: arrayUnion(deviceId) }
  ).catch(() => {});
}
  if (item.deleted) return null;
  const url = `https://www.google.com/maps?q=${item.lat},${item.lng}`;

  return (
    <View style={{ alignSelf: isMe ? "flex-end" : "flex-start", marginBottom: 12 }}>
      {!!item.nick && (
  <Text
    style={{
      color: "#4FC3F7",
      fontWeight: "700",
      marginBottom: 4,
      alignSelf: isMe ? "flex-end" : "flex-start",
    }}
  >
    {item.nick}
  </Text>
)}
     <TouchableOpacity
  onPress={() => Linking.openURL(url)}
  onLongPress={() => {
    // 🧍‍♂️ KENDİ KONUMU
    if (isMe) {
      Alert.alert(
        "Konumu Sil",
        "Bu konumu herkes için silmek istiyor musun?",
        [
          { text: "İptal", style: "cancel" },
          {
            text: "Sil",
            style: "destructive",
            onPress: async () => {
              await updateDoc(
                doc(db, "chats", chatId!, "messages", item.id),
                { deleted: true }
              );
            },
          },
        ]
      );
      return;
    }

    // 👤 BAŞKASININ KONUMU
    Alert.alert("Seçenekler", "", [
      { text: "İptal", style: "cancel" },
      {
        text: "Şikayet Et",
        style: "destructive",
        onPress: async () => {
          await addDoc(collection(db, "reports"), {
            chatId,
            messageId: item.id,
            type: "location",
            reportedBy: deviceId,
            createdAt: serverTimestamp(),
          });
          Alert.alert("Teşekkürler", "Konum bildirildi.");
        },
      },
      {
        text: "Engelle",
        onPress: () => {
          setBlockedIds((prev) =>
            prev.includes(item.senderId) ? prev : [...prev, item.senderId]
          );
        },
      },
    ]);
  }}
  style={{
    backgroundColor: "#0F0F14",
    borderRadius: 16,
    overflow: "hidden",
    maxWidth: "70%",
    borderWidth: 1,
    borderColor: "#1E1E26",
  }}
>
 <View
  style={{
    height: 100, // ⬅️ 120 → 100 (kart kısaldı)
    backgroundColor: "#14141B",
    alignItems: "center",
    justifyContent: "center",
  }}
>
  <Ionicons name="location-sharp" size={38} color="#FF4D4D" />
  <Text
    style={{
      color: "#8A8F98",
      fontSize: 11, // ⬅️ daha küçük
      marginTop: 4,
    }}
  >
    Konum paylaşıldı
  </Text>
</View>

  {/* ALT BİLGİ */}
  <View style={{ padding: 12 }}>
  <Text style={{ color: "#4FC3F7", fontWeight: "700", fontSize: 14 }}>
    Konumu görüntüle
  </Text>
</View>
</TouchableOpacity>
      

      {/* ⏱️ SAAT + OKUNDU */}
      <View
        style={{
          flexDirection: "row",
          gap: 6,
          marginTop: 4,
          alignSelf: isMe ? "flex-end" : "flex-start",
        }}
      >
        <Text style={{ fontSize: 11, color: "#888" }}>
          {formatTime(item.createdAt)}
        </Text>

        {isMe && (
          <Text
            style={{
              fontSize: 11,
              color: readCount > 1 ? "#4FC3F7" : "#666",
            }}
          >
            {readCount > 1 ? "✓✓" : "✓"}
          </Text>
        )}
      </View>
    </View>
  );
}
          if (item.type === "voice") {
  return (
    <View style={{ alignSelf: isMe ? "flex-end" : "flex-start", marginBottom: 12 }}>
      {!!item.nick && (
        <Text style={{ color: "#4FC3F7", fontWeight: "700", marginBottom: 4 }}>
          {item.nick}
        </Text>
      )}

     <VoiceMessage
  chatId={chatId!}
  messageId={item.id}
  deviceId={deviceId!}
  audioUrl={item.audioUrl}
  duration={item.duration || 0}
  isMe={isMe}
  senderId={item.senderId}
  onBlock={(sid) =>
    setBlockedIds((prev) =>
      prev.includes(sid) ? prev : [...prev, sid]
    )
  }
/>

      <View style={{ flexDirection: "row", gap: 6, alignSelf: isMe ? "flex-end" : "flex-start", marginTop: 2 }}>
        <Text style={{ fontSize: 11, color: "#888" }}>
          {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) : ""}
        </Text>

        {isMe && (
          <Text style={{ fontSize: 11, color: readCount > 1 ? "#4FC3F7" : "#888" }}>
            {readCount > 1 ? "✓✓" : "✓"}
          </Text>
        )}
      </View>
    </View>
  );
}

return (
  <View
    style={{
      alignSelf: isMe ? "flex-end" : "flex-start",
      marginBottom: 12,
    }}
  >
              <TouchableOpacity
                onPress={() => {
                  if (item.senderId !== deviceId) return;
                  Alert.prompt(
                    "Nick Değiştir",
                    "Yeni nick giriniz:",
                    [
                      { text: "İptal", style: "cancel" },
                      {
                        text: "Kaydet",
                        onPress: async (newNick: string | undefined) => {
                          if (!newNick?.trim()) return;
                          setNick(newNick.trim());
                          await setStoredNick(
                            `nick-${chatId}-${deviceId}`,
                            newNick.trim()
                          );
                        },
                      },
                    ],
                    "plain-text",
                    item.nick
                  );
                }}
                onLongPress={() => {
                  if (item.senderId === deviceId) return;
                 Alert.alert("Seçenekler", "", [
  {
    text: "Yanıtla",
    onPress: () => setReplyTo(item),
  },
  {
    text: "Engelle",
    onPress: () =>
      setBlockedIds((prev) =>
        prev.includes(item.senderId)
          ? prev
          : [...prev, item.senderId]
      ),
  },
  { text: "Şikayet Et", onPress: () => reportUser(item) },
  { text: "İptal", style: "cancel" },
]);
                }}
              >
                <Text
                  style={{
                    color: "#4FC3F7",
                    fontWeight: "700",
                    marginBottom: 4,
                  }}
                >
                  {item.nick}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onLongPress={() => {
                  if (isMe) deleteMessageForEveryone(item);
                }}
                style={{
                  backgroundColor: isMe ? "#007AFF" : "#1C1C22",
                  padding: 12,
                  borderRadius: 16,
                  maxWidth: "80%",
                }}
              >
                
<Text style={{ color: "#fff" }}>
  {item.text || "Bu mesaj silindi"}
</Text>
{item.replyTo && (
  <View
    style={{
      backgroundColor: isMe
        ? "rgba(255,255,255,0.24)"
        : "rgba(255,255,255,0.18)",
      borderRadius: 10,
      paddingVertical: 7,
      paddingHorizontal: 9,
      marginBottom: 6,
      borderLeftWidth: 4,
      borderLeftColor: "#4FC3F7",
    }}
  >
    {/* YANITLANDI BAŞLIĞI – NET & KALİTELİ */}
    <Text
      style={{
        color: "#7DD3FC",        // 🔵 Daha parlak mavi
        fontSize: 11,
        fontWeight: "800",       // 🔥 Daha net
        marginBottom: 2,
        opacity: 1,              // ❗ Solukluk yok
      }}
      numberOfLines={1}
    >
      Yanıtlanan · {item.replyTo.nick}
    </Text>

    {/* YANITLANAN MESAJ */}
    <Text
      style={{
        color: "#FFFFFF",
        fontSize: 14,
        fontWeight: "500",
        opacity: 0.97,           // Hafif ama net
      }}
      numberOfLines={2}
      ellipsizeMode="tail"
    >
      {item.replyTo.text}
    </Text>
  </View>
)}
              </TouchableOpacity>

              <View
                style={{
                  flexDirection: "row",
                  gap: 6,
                  alignSelf: isMe ? "flex-end" : "flex-start",
                  marginTop: 2,
                }}
              >
                <Text style={{ fontSize: 11, color: "#888" }}>
                  {formatTime(item.createdAt)}
                </Text>
                {isMe && (
                  <Text
                    style={{
                      fontSize: 12,
                      color: readCount > 1 ? "#4FC3F7" : "#666",
                    }}
                  >
                    {readCount > 1 ? "✓✓" : "✓"}
                  </Text>
                )}
              </View>
            </View>
          );
        }}
        
      />
      {/* INPUT BAR */}
      

{someoneTyping && !someoneRecording && (
  <View style={{ paddingHorizontal: 14, marginBottom: 8 }}>
    <Text style={{ color: "#aaa", fontSize: 12 }}>
      yazıyor...
    </Text>
  </View>
)}
{/* REPLY PREVIEW */}
{replyTo && (
  <View
    style={{
      backgroundColor: "#1C1C22",
      padding: 8,
      borderLeftWidth: 3,
      borderLeftColor: "#4FC3F7",
      marginBottom: 6,
      borderRadius: 6,
      maxHeight: 70,
      overflow: "hidden",
    }}
  >
    <Text style={{ color: "#4FC3F7", fontSize: 12 }}>
      Yanıtlanan: {replyTo.nick || "Kullanıcı"}
    </Text>

    <Text style={{ color: "#aaa", fontSize: 12 }}>
      {replyTo.text
        ? replyTo.text
        : replyTo.type === "voice"
        ? "🎤 Sesli mesaj"
        : replyTo.type === "location"
        ? "📍 Konum"
        : "Mesaj"}
    </Text>

    <TouchableOpacity onPress={() => setReplyTo(null)}>
      <Text style={{ color: "#FF453A", fontSize: 12, marginTop: 4 }}>
        Yanıtı iptal et
      </Text>
    </TouchableOpacity>
  </View>
)}

{/* INPUT BAR */}
{!closed && (
  <View
    style={{
      flexDirection: "row",
      alignItems: "center",
      padding: 10,
      minHeight: 56,
      maxHeight: 120,
      borderTopWidth: 1,
      borderColor: "#1C1C22",
      backgroundColor: "#111117",
    }}
  >
    {/* 📍 KONUM */}
    <TouchableOpacity
      onPress={() => setLocationModalOpen(true)}
      style={{ marginRight: 10 }}
    >
      <Ionicons name="location-outline" size={24} color="#aaa" />
    </TouchableOpacity>

    {/* 🎙️ KAYIT YOKKEN */}
    {!isRecording && (
      <>
        <TouchableOpacity
          onPress={startRecording}
          style={{ marginRight: 10 }}
        >
          <Ionicons name="mic" size={24} color="#aaa" />
        </TouchableOpacity>

        <TextInput
          value={text}
          onChangeText={handleTyping}
          placeholder="Mesaj yaz..."
          placeholderTextColor="#666"
          multiline
          textAlignVertical="top"
          style={{
            flex: 1,
            backgroundColor: "#1C1C22",
            color: "#fff",
            fontSize: 15,
            borderRadius: 20,
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}
        />

        <TouchableOpacity
          onPress={sendMessage}
          style={{
            backgroundColor: "#007AFF",
            padding: 12,
            borderRadius: 20,
            marginLeft: 6,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 16 }}>➤</Text>
        </TouchableOpacity>
      </>
    )}

    {/* 🎧 KAYIT VARKEN (WHATSAPP BAR) */}
    {isRecording && (
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "#1C1C22",
          borderRadius: 20,
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}
      >
        <TouchableOpacity
          onPress={cancelRecording}
          style={{ marginRight: 12 }}
        >
          <Ionicons name="trash" size={22} color="#f55" />
        </TouchableOpacity>

        <Text style={{ color: "#fff", flex: 1 }}>
          Kayıt alınıyor…
        </Text>

        <TouchableOpacity onPress={stopRecording}>
          <Ionicons name="send" size={22} color="#2ecc71" />
        </TouchableOpacity>
      </View>
    )}
  </View>
)}

{/* 📍 KONUM MODAL */}
{locationModalOpen && (
  <Modal
    transparent
    animationType="slide"
    onRequestClose={() => setLocationModalOpen(false)}
  >
    <View
      style={{
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.6)",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <View
        style={{
          backgroundColor: "#111",
          padding: 20,
          borderRadius: 12,
          width: "80%",
        }}
      >
        <TouchableOpacity
          onPress={requestLocation}
          style={{
            padding: 12,
            backgroundColor: "#1C1C22",
            borderRadius: 8,
            marginBottom: 12,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#fff" }}>
            📍 Konumu gönder
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setLocationModalOpen(false)}
          style={{
            padding: 10,
            backgroundColor: "#1C1C22",
            borderRadius: 8,
          }}
        >
          <Text style={{ color: "#fff", textAlign: "center" }}>
            Kapat
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
)}
  
  </KeyboardAvoidingView>
);
}