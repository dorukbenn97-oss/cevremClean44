import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
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
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
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
  ScrollView,
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
  useEffect(() => {
  Audio.requestPermissionsAsync();
}, []);
  async function sendChatMessage({
  type,
  text,
  audioUrl,
  lat,
  lng,
  replyTo = null
}: {
  type: "text" | "voice" | "location";
  text?: string;
  audioUrl?: string;
  lat?: number;
  lng?: number;
  replyTo?: any | null;
}) {
  if (!chatId || !deviceId) return;
  

  try {
    const messageData: any = {
      type,
      senderId: deviceId,
      nick,
      createdAt: serverTimestamp(),
      readBy: [deviceId],
      deleted: false,
      replyTo: replyTo || null,
    };

    if (type === "text") messageData.text = text || "";
    if (type === "voice") messageData.audioUrl = audioUrl;
    if (type === "location") {
      messageData.lat = lat;
      messageData.lng = lng;
    }

    await addDoc(
      collection(db, "chats", chatId, "messages"),
      messageData
    );
  } catch (e) {
    console.log("Mesaj gönderme hatası:", e);
  }
}
  
  
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

  // 2️⃣ Modal kapat
  setLocationModalOpen(false);

  // 3️⃣ SONRA Firestore’a yaz
  await addDoc(
  collection(db, "chats", chatId!, "messages"),
  {
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
  }).catch(() => {});
  setReplyTo(null);
}

  
  const [isRecordingUI, setIsRecordingUI] = useState(false);
  // --- KAYIT SÜRESİ İÇİN EKLENEN KISIM ---
  const [recordingDuration, setRecordingDuration] = useState(0);
const recordingTimerRef = useRef<any>(null);
  const formatDuration = (millis: number) => { // : number ekledik
  const minutes = Math.floor(millis / 60000);
  const seconds = Math.floor((millis % 60000) / 1000);
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
};
  
  

// tekrar getStorage YOK
const auth = getAuth();
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
const [isRecording, setIsRecording] = useState(false);
const [isOnline, setIsOnline] = useState(true);
const [sending, setSending] = useState(false);
const resetAppState = () => {
  setRecording(null);
  setIsRecording(false);
  setSomeoneRecording(false);
  setText("");
  setReplyTo(null);
  setLocationModalOpen(false);
  setNickModalVisible(false);
  isStoppingRef.current = false;
};


useEffect(() => {
  
  if (Platform.OS === "web") {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);

    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }
}, []);
useEffect(() => {
  if (Platform.OS !== "web") {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected === true);
    });

    return () => unsubscribe();
  }
}, []);



const [locationModalOpen, setLocationModalOpen] = useState(false);
const [someoneRecording, setSomeoneRecording] = useState(false);

  

async function startRecording() {
  if (recording) return;
  if (!chatId || !deviceId) return;

  try {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    setRecordingDuration(0);

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const rec = new Audio.Recording();
    await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    await rec.startAsync();

    setRecording(rec);
    setIsRecording(true);
    setSomeoneRecording(true);

    const startTime = Date.now();
    
    recordingTimerRef.current = setInterval(() => {
      if (!isStoppingRef.current) {
        setRecordingDuration(Date.now() - startTime);
      } else {
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
      }
    }, 100);

  } catch (err) {
    console.log("record error", err);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
    setRecording(null);
  }
}
async function stopRecording(isMe: boolean) { 
  const finalDuration = recordingDuration;
  if (isStoppingRef.current || !chatId || !recording) return;

  if (recordingTimerRef.current) {
    clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
  }

  // 🚀 1. GÖRSEL TEPKİ
  setIsRecording(false);
  isStoppingRef.current = true;
  setRecordingDuration(0);

  try {
    const currentRecording = recording;
    const status = await currentRecording.stopAndUnloadAsync();
    const exactDuration = status?.durationMillis || finalDuration;
    const localUri = currentRecording.getURI();

    setRecording(null);

    // 🔓 UI kilidi hemen açılır
    isStoppingRef.current = false;

    if (!localUri) return;

    const fileName = `voices/${chatId}/${Date.now()}.m4a`;
    const storageRef = ref(storage, fileName);

    // 🚀 MESAJ ANINDA DÜŞER, kendi cihaz için anında ses
    const tempDocRef = await addDoc(
      collection(db, "chats", chatId as string, "messages"),
      {
        type: "voice",
        senderId: deviceId,
        nick: nick,
        createdAt: serverTimestamp(),
        audioUrl: isMe ? localUri : "loading", // 🔥 kendi cihazda anında çal, diğerinde loading
        duration: Math.floor(exactDuration / 1000),
        readBy: [deviceId],
        deleted: false,
      }
    );

    // 🚀 ARKA PLANDA UPLOAD
    const xhr = new XMLHttpRequest();
    xhr.responseType = "blob";

    xhr.onload = async function () {
      try {
        const blob = xhr.response;
        if (!blob) return;

        await uploadBytes(storageRef, blob);
        const downloadURL = await getDownloadURL(storageRef);

        // 🚀 UPLOAD BİTİNCE ses aktif, Firestore güncellenir
        await updateDoc(tempDocRef, {
          audioUrl: downloadURL,
        });

      } catch (err) {
        console.log("Background upload error:", err);
      }
    };

    xhr.onerror = () => { isStoppingRef.current = false; };
    xhr.open("GET", localUri, true);
    xhr.send();

  } catch (e) {
    console.log("Stop error:", e);
    isStoppingRef.current = false;
  }
}

async function cancelRecording() {
  setRecordingDuration(0); 
  try {
    if (!recording) return;

    if (chatId && deviceId) {
     deleteDoc(
  doc(db, "chats", chatId, "typing", deviceId)
).catch(() => {});
    }

    await recording.stopAndUnloadAsync();

    setRecording(null);
    setIsRecording(false);
    setSomeoneRecording(false);

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });

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
  const flatListRef = useRef<FlatList>(null);
  const [messages, setMessages] = useState<any[]>([]);
  

// 🔹 MESAJI SİL VE SCROLL’U KORU
const deleteMessageAndKeepPosition = (msgId: string) => {
  const index = messages.findIndex(m => m.id === msgId);
  if (index === -1) return;

  const MESSAGE_HEIGHT = 80; // Mesajın yaklaşık yüksekliği
  const offset = MESSAGE_HEIGHT * index;

  setMessages(prev => prev.filter(m => m.id !== msgId));

  flatListRef.current?.scrollToOffset({
    offset: offset,
    animated: false,
  });
};
  const [lastDoc, setLastDoc] = useState<any>(null);
  const lastReadRef = useRef(false);
  
const [loadingMore, setLoadingMore] = useState(false);
  const [ready, setReady] = useState(false);
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [someoneTyping, setSomeoneTyping] = useState(false);
  const [nickModalVisible, setNickModalVisible] = useState(false);

  const [locked, setLocked] = useState(false);
  const [closed, setClosed] = useState(false);

  const [usersInRoom, setUsersInRoom] = useState<
    { id: string; nick: string }[]
  >([]);
 

  

  /* ✅ FIX: OWNER ARTIK AUTH UID */
  const isOwner =
    !!auth.currentUser && !!ownerId && ownerId === auth.currentUser.uid;

  /* DEVICE */
  useEffect(() => {
    getDeviceId().then(setDeviceId);
  }, []);
 useEffect(() => {
  if (!chatId || !deviceId) return;

 const handleAppStateChange = async (state: string) => {
    if (state === "active") {
  await handleAppActive();
}

if (state === "background") {
  await handleAppBackground();
}
  };

  const sub = AppState.addEventListener("change", handleAppStateChange);

  return () => sub.remove();
}, [chatId, deviceId, recording]);

// 🔹 ayrı async fonksiyonlar
const handleAppActive = async () => {
  try {
    resetAppState(); // ← burayı ekledik

    await bumpActive();

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });
  } catch (e) {
    console.log("AppState active hatası:", e);
  }
};

const handleAppBackground = async () => {
  try {
    if (recording) {
      await recording.stopAndUnloadAsync();
    }
  } catch {}

  setRecording(null);
  setIsRecording(false);
  setSomeoneRecording(false);
  isStoppingRef.current = false;

  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });
  } catch {}
};
  /* CHAT META + GİRİŞ KONTROLÜ */
  useEffect(() => {
    if (!chatId || !deviceId) return;
    if (!isOnline) {
  Alert.alert(
    "İnternet Yok",
    "İnternet bağlantınız yok. Odaya giriş için internet gereklidir."
  );
  return;
}

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
    orderBy("createdAt", "desc"),
    limit(30)
  );

  return onSnapshot(q, async (snap) => {
    const list = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((m) => !(m as any).deleted);

    setMessages(list);

    if (snap.docs.length > 0) {
      setLastDoc(snap.docs[snap.docs.length - 1]);
    }


    // 🔹 OK GÜNCELLEME (1 tik → 2 tik + mavi)
    snap.docs.forEach(async (docSnap) => {
      const msgData = docSnap.data();
      if (!msgData.readBy?.includes(deviceId) && msgData.senderId !== deviceId) {
        // Mesajı biz görmüşsek, readBy array'ine ekle
        await updateDoc(doc(db, "chats", chatId!, "messages", docSnap.id), {
          readBy: arrayUnion(deviceId),
        }).catch(() => {});
      }
    });

    // 🔹 Son okunan mesaj zamanını güncelle
    if (!lastReadRef.current) {
      updateDoc(doc(db, "chats", chatId!), {
        [`lastRead.${deviceId}`]: serverTimestamp(),
      }).catch(() => {});
      lastReadRef.current = true;
    }
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
const isTypingRef = useRef(false);
const typingTimeout = useRef<any>(null);
  const handleTyping = async (v: string) => {
    
    if (!chatId || !deviceId || closed) return;
    if (!ready) return;
    setText(v);

    if (typingTimeout.current) clearTimeout(typingTimeout.current);

    if (!v) {
     await deleteDoc(
  doc(db, "chats", chatId, "typing", deviceId)
).catch(() => {});
      return;
    }

    if (!chatId || !deviceId) return;

if (!isTypingRef.current) {
  await setDoc(
  doc(db, "chats", chatId, "typing", deviceId),
  { typing: true }
).catch(() => {});
  isTypingRef.current = true;
}
   typingTimeout.current = setTimeout(async () => {
  await deleteDoc(
    doc(db, "chats", chatId, "typing", deviceId)
  ).catch(() => {});
  isTypingRef.current = false;
}, 2000);
  };
  const loadMore = async () => {
  if (!lastDoc || loadingMore) return;

  setLoadingMore(true);

 const moreQuery = query(
  collection(db, "chats", chatId!, "messages"),
  orderBy("createdAt", "desc"),
  startAfter(lastDoc?.data()?.createdAt ?? 0), 
  limit(30)
);

  const snap = await getDocs(moreQuery);

  const more = snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));

  if (snap.docs.length > 0) {
    setLastDoc(snap.docs[snap.docs.length - 1]);
  }

  setMessages((prev) => [...prev, ...more]);
  setLoadingMore(false);
};

const sendMessage = async () => {
  if (!text.trim() || !chatId || !deviceId || closed) return;

  const tempText = text;
  setText("");

 await addDoc(
  collection(db, "chats", chatId, "messages"),
  {
    text: tempText,
    senderId: deviceId,
    nick,
    createdAt: serverTimestamp(),
    readBy: [deviceId],
    deleted: false,
    replyTo: replyTo
      ? {
          id: replyTo.id,
          text: replyTo.text || "",
        }
      : null,
  }
).catch(() => {});

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
        try {
          // 1️⃣ Firestore güncellemesini bekle
          await updateDoc(

            doc(db, "chats", chatId!, "messages", msg.id),
            { deleted: true, text: "" }
          );

          // 2️⃣ UI güncellemesi + scroll pozisyonu
          const index = messages.findIndex(m => m.id === msg.id);
          if (index === -1) return;

          setMessages(prev => prev.filter(m => m.id !== msg.id));

          // inverted FlatList için doğru index
         if (messages.length > 1) {
  flatListRef.current?.scrollToIndex({
    index: index > 0 ? index - 1 : 0,
    animated: false,
  });
}
        } catch (e) {
          console.log("Mesaj silme hatası:", e);
        }

      },
    },
  ]);
};

  const toggleLock = async () => {
  if (!isOwner || closed) return;
  setLocked(!locked); 
  await updateDoc(doc(db, "chats", chatId!), { locked: !locked }).catch(() => {});
};

  const closeChatForever = async () => {
    if (!isOwner) return;

    Alert.alert("Sohbeti Kapat", "Bu sohbet kalıcı olarak kapatılacak.", [
      { text: "İptal", style: "cancel" },
      {
        text: "Kapat",
        style: "destructive",
        onPress: async () => {
  setClosed(true); // EKLENDİ → UI hemen kapalı göstersin
  setLocked(true); // EKLENDİ → kilit de aktif olsun
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

 

  return (
    <KeyboardAvoidingView
  style={{ flex: 1, backgroundColor: "#0B0B0F" }}
  behavior={Platform.OS === "ios" ? "padding" : "height"}
  keyboardVerticalOffset={Platform.OS === "android" ? 20 : 0}
>
{!isOnline && (
  <View style={{
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 999,
  }}>
    <Text style={{ color: "#fff", fontSize: 16 }}>Bağlanıyor...</Text>
  </View>
)}
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
  try {
  router.replace("/"); 
} catch (err) {
  console.warn
}
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
  onPress={() => {
    if (!chatId || !deviceId) {
      if (router.canGoBack()) router.back();
      else router.replace("/");
      return;
    }

    // 🔥 ÖNCE ÇIK
    if (router.canGoBack()) router.back();
    else router.replace("/");

    // 🔥 FIRESTORE ARKA PLAN
    deleteDoc(doc(db, "chats", chatId, "users", deviceId)).catch(() => {});
    updateDoc(doc(db, "chats", chatId), {
      participantsCount: increment(-1),
    }).catch(() => {});
  }}
>
  <Text style={{ fontSize: 18, color: "#fff" }}>✕</Text>
</TouchableOpacity>
        </View>
      </View>

      {/* MESSAGES */}
     <FlatList
  ref={flatListRef}
  data={messages}

  onEndReached={loadMore}
  onEndReachedThreshold={0.3}

  inverted

  maintainVisibleContentPosition={{
    minIndexForVisible: 1,
    autoscrollToTopThreshold: 0,
  }}

  keyExtractor={(i) => i.id}

  contentContainerStyle={{
    padding: 16,
    flexGrow: 1,
    justifyContent: "flex-end",
  }}

  // ✅ Büyük kullanıcı optimizasyonu
  initialNumToRender={12}
  maxToRenderPerBatch={12}
  windowSize={10}
  updateCellsBatchingPeriod={50}

  // Chat ekranlarında genelde false bırakılır (inverted olduğu için)
  removeClippedSubviews={false}

  renderItem={({ item }) => {
    const isMe = item.senderId === deviceId;
    const readCount = item.readBy?.length || 0;
  
  if (!isMe && blockedIds.includes(item.senderId)) return null;

  if (item.type === "location") {
    if (!isMe && !item.readBy?.includes(deviceId)) {
      
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
              height: 100,
              backgroundColor: "#14141B",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="location-sharp" size={38} color="#FF4D4D" />
            <Text
              style={{
                color: "#8A8F98",
                fontSize: 11,
                marginTop: 4,
              }}
            >
              Konum paylaşıldı
            </Text>
          </View>

          <View style={{ padding: 12 }}>
            <Text style={{ color: "#4FC3F7", fontWeight: "700", fontSize: 14 }}>
              Konumu görüntüle
            </Text>
          </View>
        </TouchableOpacity>

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
  readCount={readCount}
  createdAt={item.createdAt}
  onBlock={(sid) =>
    setBlockedIds((prev) =>
      prev.includes(sid) ? prev : [...prev, sid]
    )
  }
/>
{!isOnline && (
  <View style={{ padding: 8, backgroundColor: "#222", alignItems: "center" }}>
    <Text style={{ color: "#fff" }}>Bağlantı yok…</Text>
  </View>
)}

      
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
        color: "#7DD3FC",
        fontSize: 11,
        fontWeight: "800",
        marginBottom: 2,
        opacity: 1,
      }}
    >
      Yanıtlanan · {item.replyTo.nick}
    </Text>

    {/* YANITLANAN MESAJ */}
    <Text
      style={{
        color: "#FFFFFF",
        fontSize: 14,
        fontWeight: "500",
        opacity: 0.97,
      }}
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
      maxHeight: 300, // biraz daha uzun yaptım
    }}
  >
    <Text
      style={{
        color: "#4FC3F7",
        fontSize: 12,
        fontWeight: "700",
        marginBottom: 4,
      }}
    >
      Yanıtlanan: {replyTo.nick || "Kullanıcı"}
    </Text>

    <ScrollView
      style={{ flexGrow: 0 }}
      nestedScrollEnabled={true}
      contentContainerStyle={{ paddingBottom: 4 }}
    >
      <Text
        style={{
          color: "#fff",
          fontSize: 14,
          lineHeight: 20,
          flexWrap: "wrap",
          flexShrink: 1, // metnin taşmasını önler
        }}
      >
        {replyTo.text
          ? replyTo.text
          : replyTo.type === "voice"
          ? "🎤 Sesli mesaj"
          : replyTo.type === "location"
          ? "📍 Konum"
          : "Mesaj"}
      </Text>
    </ScrollView>

    <TouchableOpacity
      onPress={() => setReplyTo(null)}
      style={{ marginTop: 6 }}
    >
      <Text style={{ color: "#FF453A", fontSize: 12 }}>
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
          editable={isOnline}
        />

        <TouchableOpacity
          onPress={sendMessage}
          style={{
            backgroundColor: "#007AFF",
            padding: 12,
            borderRadius: 20,
            marginLeft: 6,
          }}
         disabled={!text.trim() || closed}
        >
          <Text style={{ color: "#fff", fontSize: 16 }}>➤</Text>
        </TouchableOpacity>
      </>
    )}
{/* 🎤 IŞILTILI TAM SİYAH KAYIT PANELİ */}
{isRecording && (
  <View style={{
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#000', // Tam siyah arka plan
    height: 95, 
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 99999,
    borderTopWidth: 1,
    borderColor: '#333', // Üstte ince belirgin bir hat
    elevation: 30,
    shadowColor: "#FFF", // Hafif beyaz ışıltı gölgesi
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  }}>
    
    {/* 🗑️ SİLME BUTONU (PARLAK KIRMIZI DOKUNUŞLU) */}
    <TouchableOpacity 
      onPress={cancelRecording} 
      style={{ 
        backgroundColor: 'rgba(255, 59, 48, 0.2)', 
        width: 46, 
        height: 46, 
        borderRadius: 23, 
        justifyContent: 'center', 
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 59, 48, 0.4)'
      }}
    >
      <Ionicons name="trash" size={24} color="#FF3B30" />
    </TouchableOpacity>

    {/* 🕒 SÜRE KAPSÜLÜ (SABİT VE ŞIK) */}
    <View style={{ 
      backgroundColor: '#1C1C1E', 
      paddingHorizontal: 15, 
      paddingVertical: 10, 
      borderRadius: 25, 
      marginLeft: 15,
      minWidth: 65,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#333'
    }}>
      <Text style={{ 
        color: '#FFF', 
        fontWeight: 'bold', 
        fontSize: 17,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        textShadowColor: 'rgba(255, 255, 255, 0.3)', // Rakamlara hafif ışıltı
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 5
      }}>
        {formatDuration(recordingDuration)}
      </Text>
    </View>

    {/* ⚪ AKAN IŞILTILI BEYAZ NOKTALAR */}
    <View style={{ flex: 1, height: 40, justifyContent: 'center', marginHorizontal: 15, overflow: 'hidden' }}>
      <Animated.View style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
        transform: [{ translateX: -(recordingDuration % 1000) / 10 }]
      }}>
        {[...Array(30)].map((_, i) => (
          <View 
            key={i} 
            style={{
              width: 5,
              height: 5,
              backgroundColor: i % 4 === 0 ? '#FFF' : 'rgba(255, 255, 255, 0.4)', // Bazı noktalar tam parlak
              borderRadius: 2.5,
              // Noktalara parlama efekti
              shadowColor: '#FFF',
              shadowRadius: i % 4 === 0 ? 4 : 0,
              shadowOpacity: i % 4 === 0 ? 0.8 : 0,
            }} 
          />
        ))}
      </Animated.View>
    </View>

    {/* ✅ GÖNDER BUTONU (PARLAK YEŞİL) */}
<TouchableOpacity 
  onPress={() => stopRecording(true)} // 🔹 kendi cihaz için anında çalacak
  style={{ 
    backgroundColor: '#34C759', 
    width: 50, 
    height: 50, 
    borderRadius: 25, 
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: "#34C759",
    shadowRadius: 15, // Gönder butonuna güçlü ışıltı
    shadowOpacity: 0.6,
    elevation: 10
  }}
>
  <Ionicons name="send" size={24} color="#fff" />
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