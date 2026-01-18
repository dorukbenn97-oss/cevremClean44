import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import * as Clipboard from "expo-clipboard";
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
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
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
  const [isRecordingUI, setIsRecordingUI] = useState(false);
  useEffect(() => {
  Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
  });
}, []);
  

// tekrar getStorage YOK
const auth = getAuth();
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
const [isRecording, setIsRecording] = useState(false);
  

async function startRecording() {
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

    setRecording(rec);
    setIsRecording(true);
  } catch (err) {
    console.log("record error", err);
  }
}

async function stopRecording() {
  try {
    if (!recording) return; // ✅ TS HATASI BURADA BİTİYOR

    setIsRecording(false);
    await recording.stopAndUnloadAsync();

    const uri = recording.getURI();
    if (!uri) return;
    if (!chatId || typeof chatId !== "string") return;

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

    // 🔊 KAYITTAN ÇIK → ÇALMA MODU
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });

    setRecording(null);
  } catch (e) {
    console.log("Ses gönderme hatası:", e);
  }
}
  const pulseTop = useRef(new Animated.Value(1)).current;

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
  const [ownerId, setOwnerId] = useState<string | null>(null);

  const [nick, setNick] = useState("");
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [ready, setReady] = useState(false);
  const [someoneTyping, setSomeoneTyping] = useState(false);
  const [nickModalVisible, setNickModalVisible] = useState(false);

  const [locked, setLocked] = useState(false);
  const [closed, setClosed] = useState(false);

  const [usersInRoom, setUsersInRoom] = useState<
    { id: string; nick: string }[]
  >([]);
  const [blockedIds, setBlockedIds] = useState<string[]>([]);

  const typingTimeout = useRef<any>(null);

  /* ✅ FIX: OWNER ARTIK AUTH UID */
  const isOwner =
    !!auth.currentUser && !!ownerId && ownerId === auth.currentUser.uid;

  /* DEVICE */
  useEffect(() => {
    getDeviceId().then(setDeviceId);
  }, []);

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

      if (data.locked) {
        const meInside = await getDoc(userDoc);
        if (!meInside.exists()) {
          Alert.alert("Oda Kilitli", "Bu oda kilitli olduğu için giriş yapılamaz.");
          router.replace("/");
          return;
        }
      }
      // 🔐 GERÇEK 8 KİŞİ LİMİTİ
const usersSnap = await getDocs(usersRef);

const now = Date.now();
const activeCount = usersSnap.docs.filter((d) => {
  const last = d.data().lastActive?.toMillis?.() || 0;
  return now - last < 30000;
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
          return now - last < 30000;
        })
        .map((d) => ({
          id: d.id,
          nick: d.data().nick || `Anon-${d.id.substring(0, 4)}`,
        }));
      setUsersInRoom(activeUsers);
    });

    const interval = setInterval(() => {
      if (nick)
        setDoc(
          userDoc,
          { nick, lastActive: serverTimestamp() },
          { merge: true }
        ).catch(() => {});
    }, 10000);

    return () => {
      deleteDoc(userDoc).catch(() => {});
      clearInterval(interval);
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
    if (msg.senderId !== deviceId) {
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
    if (!text.trim() || !chatId || !deviceId || closed) return;

    await addDoc(collection(db, "chats", chatId, "messages"), {
      text,
      senderId: deviceId,
      nick,
      createdAt: serverTimestamp(),
      readBy: [deviceId],
      deleted: false,
    });

    await deleteDoc(doc(db, "chats", chatId, "typing", deviceId));
    setText("");
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

// ✅ HAK SADECE BURADA DÜŞER
if (auth.currentUser?.uid) {
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
          <TouchableOpacity onPress={() => router.back()}>
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
  messageId={item.id}      // ✅ EKLENDİ
  deviceId={deviceId!}      // ✅ EKLENDİ
  audioUrl={item.audioUrl}
  duration={item.duration || 0}
  isMe={isMe}
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
{!closed && (
  <View
    style={{
      flexDirection: "row",
      alignItems: "center",
      padding: 10,
      borderTopWidth: 1,
      borderColor: "#1C1C22",
      backgroundColor: "#111117",
    }}
  >
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
          style={{
            flex: 1,
            backgroundColor: "#1C1C22",
            color: "#fff",
            borderRadius: 20,
            paddingHorizontal: 14,
            paddingVertical: 8,
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
        <TouchableOpacity onPress={stopRecording} style={{ marginRight: 12 }}>
          <Ionicons name="trash" size={22} color="#f55" />
        </TouchableOpacity>

        <Text style={{ color: "#fff", flex: 1 }}>Kayıt alınıyor…</Text>

        <TouchableOpacity onPress={stopRecording}>
          <Ionicons name="send" size={22} color="#2ecc71" />
        </TouchableOpacity>
      </View>
    )}
  </View>
)}
    </KeyboardAvoidingView>
  );
}