import { AVPlaybackStatus } from "expo-av";
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../firebaseConfig";
import { playAudio, stopAudio } from "./AudioPlayerManager";

type VoiceMessageProps = {
  chatId: string;
  messageId: string;
  deviceId: string;
  audioUrl: string;
  duration: number;
  isMe?: boolean;
  senderId: string;
  onBlock: (senderId: string) => void;
};

export default function VoiceMessage({
  chatId,
  messageId,
  deviceId,
  audioUrl,
  duration,
  isMe = false,
  senderId,
  onBlock,
}: VoiceMessageProps) {
  const markedReadRef = useRef(false);
  const lastPositionRef = useRef(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [realDuration, setRealDuration] = useState(duration || 0);

  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  async function markAsReadOnce() {
    if (markedReadRef.current || isMe) return;
    markedReadRef.current = true;

    await updateDoc(doc(db, "chats", chatId, "messages", messageId), {
      readBy: arrayUnion(deviceId),
    });
  }

  function handleLongPress() {
    if (isMe) {
      Alert.alert("Sesli mesaj", "Bu mesaj silinsin mi?", [
        { text: "İptal", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: async () => {
            await deleteDoc(
              doc(db, "chats", chatId, "messages", messageId)
            );
          },
        },
      ]);
      return;
    }

    Alert.alert("Seçenekler", "", [
      { text: "Engelle", onPress: () => onBlock(senderId) },
      { text: "İptal", style: "cancel" },
      {
        text: "Şikayet Et",
        style: "destructive",
        onPress: async () => {
          await addDoc(collection(db, "reports"), {
            chatId,
            reportedUser: senderId,
            reporter: deviceId,
            messageId,
            type: "voice",
            createdAt: serverTimestamp(),
          });
          Alert.alert("Teşekkürler", "Bildiriminiz alındı.");
        },
      },
    ]);
  }

  function togglePlay() {
    // ⛔ DUR
    if (isPlaying) {
      setIsPlaying(false);
      stopAudio(); // anında kes
      return;
    }

    // ▶️ ANINDA UI
    setIsPlaying(true);
    stopAudio(); // başka ses varsa anında kes

    playAudio({
      uri: audioUrl,
      onStatus: (status: AVPlaybackStatus) => {
        if (!status.isLoaded) return;

        if (status.positionMillis != null) {
          const sec = status.positionMillis / 1000;
          setPosition(sec);
          lastPositionRef.current = sec;
        }

        if (status.durationMillis && realDuration === 0) {
          setRealDuration(status.durationMillis / 1000);
        }

        if (status.didJustFinish) {
          setIsPlaying(false);
          setPosition(0);
          lastPositionRef.current = 0;
        }
      },
      onStop: () => {
        setIsPlaying(false);
      },
    });

    markAsReadOnce();
  }

  return (
    <View style={[styles.container, isMe ? styles.me : styles.other]}>
      <TouchableOpacity
        onPress={togglePlay}
        onLongPress={handleLongPress}
        activeOpacity={0.8}
        style={styles.playShape}
      >
        {isPlaying ? (
          <>
            <View style={styles.pauseBar} />
            <View style={styles.pauseBar} />
          </>
        ) : (
          <View style={styles.playTriangle} />
        )}
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.waveWrapper}>
          <View
            style={[
              styles.waveProgress,
              {
                width:
                  realDuration > 0
                    ? `${Math.min(
                        (position / realDuration) * 100,
                        100
                      )}%`
                    : "0%",
              },
            ]}
          />
        </View>

        <View style={styles.meta}>
          <Text style={styles.timeText}>
            {realDuration > 0 ? formatTime(position) : "Sesli mesaj"}
          </Text>
          <Text style={styles.durationText}>
            {realDuration > 0 ? formatTime(realDuration) : ""}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 18,
    maxWidth: "85%",
    marginVertical: 6,
  },

  me: {
    backgroundColor: "#0A84FF",
    alignSelf: "flex-end",
  },

  other: {
    backgroundColor: "#2C2C2E",
    alignSelf: "flex-start",
  },

  content: {
    flex: 1,
  },

  waveWrapper: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 6,
  },

  waveProgress: {
    height: 6,
    backgroundColor: "#fff",
    borderRadius: 3,
  },

  meta: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  timeText: {
    color: "#fff",
    fontSize: 12,
    opacity: 0.9,
  },

  durationText: {
    color: "#fff",
    fontSize: 12,
    opacity: 0.6,
  },

  playShape: {
    width: 20,
    height: 20,
    marginRight: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  pauseBar: {
    width: 4,
    height: 14,
    backgroundColor: "#fff",
    borderRadius: 2,
    marginHorizontal: 2,
  },

  playTriangle: {
    width: 0,
    height: 0,
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderLeftWidth: 12,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: "#fff",
    marginLeft: 2,
  },
});