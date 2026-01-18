import { AVPlaybackStatus } from "expo-av";
import { arrayUnion, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
};

export default function VoiceMessage({
  chatId,
  messageId,
  deviceId,
  audioUrl,
  duration,
  isMe = false,
}: VoiceMessageProps) {
  const markedReadRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [realDuration, setRealDuration] = useState(duration);
  const [loading, setLoading] = useState(false);

  const lastPositionRef = useRef(0);

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

  // ❌❌❌ SİLME (UZUN BASMA)
  function handleDelete() {
    if (!isMe) return;

    Alert.alert(
      "Sesli mesaj silinsin mi?",
      "Bu işlem geri alınamaz",
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(
                doc(db, "chats", chatId, "messages", messageId)
              );
            } catch (e) {
              console.log("Ses silme hatası:", e);
            }
          },
        },
      ]
    );
  }

  async function togglePlay() {
    if (loading) return;

    if (isPlaying) {
      setLoading(true);
      await stopAudio();
      setIsPlaying(false);
      setLoading(false);
      return;
    }

    setLoading(true);

    await playAudio({
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
        setPosition(lastPositionRef.current);
      },
    });

    setIsPlaying(true);
    await markAsReadOnce();
    setLoading(false);
  }

  return (
    <View style={[styles.container, isMe ? styles.me : styles.other]}>
      <TouchableOpacity
        onPress={togglePlay}
        onLongPress={handleDelete}
        activeOpacity={0.8}
        style={styles.play}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.icon}>{isPlaying ? "⏸️" : "▶️"}</Text>
        )}
      </TouchableOpacity>

      <View style={styles.info}>
        <View style={styles.bar}>
          <View
            style={[
              styles.progress,
              {
                width:
                  realDuration > 0
                    ? `${Math.min((position / realDuration) * 100, 100)}%`
                    : "0%",
              },
            ]}
          />
        </View>

        <Text style={styles.time}>
          {formatTime(position)} / {formatTime(realDuration)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 16,
    maxWidth: "80%",
    marginVertical: 4,
  },
  me: {
    backgroundColor: "#007AFF",
    alignSelf: "flex-end",
  },
  other: {
    backgroundColor: "#444",
    alignSelf: "flex-start",
  },
  play: {
    marginRight: 10,
  },
  icon: {
    fontSize: 22,
    color: "#fff",
  },
  info: {
    flex: 1,
  },
  bar: {
    height: 4,
    backgroundColor: "#666",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 4,
  },
  progress: {
    height: 4,
    backgroundColor: "#fff",
  },
  time: {
    color: "#fff",
    fontSize: 12,
  },
});