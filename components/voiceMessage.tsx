import { AVPlaybackStatus, Audio } from "expo-av";
import * as React from "react";

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
  createdAt?: any;
  readCount?: number;
};

// ✅ GLOBAL AUDIO DURATION CACHE
const durationCache = new Map<string, number>();

async function getAudioDuration(uri?: string) {
  if (!uri) return { duration: 0 };

  // cache varsa tekrar yükleme
  if (durationCache.has(uri)) {
    return { duration: durationCache.get(uri)! };
  }

  try {
    const { sound, status } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: false }
    );

    let duration = 0;

    if ("durationMillis" in status && status.durationMillis != null) {
      duration = status.durationMillis / 1000;
    }

    await sound.unloadAsync();

    durationCache.set(uri, duration);

    return { duration };
  } catch (e) {
    console.warn("Audio load failed:", e);
    return { duration: 0 };
  }
}

function VoiceMessage({
  chatId,
  messageId,
  deviceId,
  audioUrl,
  duration,
  isMe = false,
  senderId,
  onBlock,
  createdAt,
  readCount = 0,
}: VoiceMessageProps) {
  const markedReadRef = useRef(false);
  const lastPositionRef = useRef(0);
  const mountedRef = useRef(true);

  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [realDuration, setRealDuration] = useState(duration || 0);

  useEffect(() => {
    // 🔥 KRİTİK DÜZELTME: Eğer ses şu an çalıyorsa, URL değişse bile sıfırlama yapma!
    if (isPlaying) return; 

    if (!audioUrl || audioUrl === "loading") return;

    mountedRef.current = true;

    (async () => {
      try {
        const { duration: fetchedDur } = await getAudioDuration(audioUrl);
        if (mountedRef.current) {
          setRealDuration(fetchedDur);
        }
      } catch (e) {
        console.warn("Ses yükleme hatası:", e);
      }
    })();

    return () => {
      // Burası önemli: Sadece bileşen tamamen ekrandan giderse sesi durdur
      if (!mountedRef.current) {
        stopAudio();
      }
    };
  }, [audioUrl]); // URL değiştiğinde (loading -> gerçek link) burası tetiklenir ama isPlaying sayesinde durmaz

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  async function markAsReadOnce() {
    if (markedReadRef.current || isMe) return;

    markedReadRef.current = true;

    try {
      await updateDoc(doc(db, "chats", chatId, "messages", messageId), {
        readBy: arrayUnion(deviceId),
      });
    } catch {}
  }

  function handleLongPress() {
    if (isMe) {
      Alert.alert("Sesli mesaj", "Bu mesaj silinsin mi?", [
        { text: "İptal", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "chats", chatId, "messages", messageId));
            } catch {}
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
          try {
            await addDoc(collection(db, "reports"), {
              chatId,
              reportedUser: senderId,
              reporter: deviceId,
              messageId,
              type: "voice",
              createdAt: serverTimestamp(),
            });

            Alert.alert("Teşekkürler", "Bildiriminiz alındı.");
          } catch {}
        },
      },
    ]);
  }

  async function togglePlay() {
    if (!audioUrl) {
      console.warn("Audio URL yok, oynatma başlatılamıyor");
      return;
    }
 
    if (isPlaying) {
      setIsPlaying(false);
      stopAudio();
      return;
    }

    setIsPlaying(true);
    stopAudio();

    playAudio({
      uri: audioUrl,
      onStatus: (status: AVPlaybackStatus) => {
        if (!status.isLoaded || !mountedRef.current) return;

        const s = status as typeof status & {
          positionMillis?: number;
          didJustFinish?: boolean;
        };

        if (s.positionMillis != null) {
          const sec = s.positionMillis / 1000;

          // gereksiz render engeli
          if (Math.abs(sec - lastPositionRef.current) > 0.2) {
            lastPositionRef.current = sec;
            setPosition(sec);
          }
        }

        if (s.didJustFinish && mountedRef.current) {
          setIsPlaying(false);
          setPosition(0);
          lastPositionRef.current = 0;
        }
      },
      onStop: () => {
        if (mountedRef.current) setIsPlaying(false);
      },
    });

    markAsReadOnce();
  }

  const progress = realDuration > 0 ? position / realDuration : 0;

  return (
    <View
      style={[
        styles.container,
        isMe ? styles.me : styles.other,
        isPlaying && styles.playingGlow,
      ]}
    >
      <TouchableOpacity
        onPress={togglePlay}
        onLongPress={handleLongPress}
        activeOpacity={0.9}
        style={[styles.playButton, isPlaying && styles.playButtonActive]}
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

      <View style={styles.waveContainer}>
        {Array.from({ length: 32 }).map((_, i) => {
          const active = i / 32 < progress;

          return (
            <View
              key={i}
              style={[
                styles.waveBar,
                {
                  height: 5 + (i % 6) * 3,
                  opacity: active ? 1 : 0.25,
                },
              ]}
            />
          );
        })}
      </View>

      <Text style={styles.timeText}>
        {realDuration > 0
          ? isPlaying
            ? formatTime(Math.floor(position))
            : formatTime(realDuration)
          : ""}
      </Text>

      <View style={styles.metaContainer}>
        <Text style={styles.metaText}>
          {createdAt?.toDate
            ? createdAt.toDate().toLocaleTimeString("tr-TR", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : ""}
        </Text>

        {isMe && (
          <Text
            style={[
              styles.metaText,
              { color: readCount > 1 ? "#4FC3F7" : "#aaa" },
            ]}
          >
            {readCount > 1 ? "✓✓" : "✓"}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 26,
    maxWidth: "85%",
    marginVertical: 8,
    backgroundColor: "#111214",
  },

  me: {
    alignSelf: "flex-end",
    borderWidth: 1,
    borderColor: "rgba(0,122,255,0.6)",
  },

  other: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },

  playingGlow: {
    shadowColor: "#00A2FF",
    shadowOpacity: 0.9,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    elevation: 22,
  },

  playButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    marginRight: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0C0D10",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.06)",
    shadowColor: "#000",
    shadowOpacity: 0.6,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },

  playButtonActive: {
    backgroundColor: "#0F1C2A",
    borderColor: "#00A2FF",
    shadowColor: "#00A2FF",
    shadowOpacity: 1,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 0 },
    elevation: 28,
  },

  pauseBar: {
    width: 5,
    height: 20,
    backgroundColor: "#F0F6FF",
    borderRadius: 3,
    marginHorizontal: 4,
  },

  playTriangle: {
    width: 0,
    height: 0,
    borderTopWidth: 12,
    borderBottomWidth: 12,
    borderLeftWidth: 20,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: "#F0F6FF",
    marginLeft: 5,
  },

  waveContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    flex: 1,
    height: 24,
  },

  waveBar: {
    width: 3,
    backgroundColor: "#00A2FF",
    borderRadius: 3,
    marginRight: 3,
  },

  timeText: {
    marginLeft: 10,
    color: "#EAF4FF",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.4,
  },

  metaContainer: {
    position: "absolute",
    right: 12,
    bottom: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  metaText: {
    fontSize: 10,
    color: "#aaa",
  },
});
export default React.memo(VoiceMessage);