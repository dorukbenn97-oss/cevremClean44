import { Audio } from "expo-av";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type VoiceMessageProps = {
  chatId: string;
  audioUrl: string;     // 🔊 ses dosyası URL
  duration: number;     // ⏱️ saniye
  isMe?: boolean;       // 👤 mesaj bana mı ait
};

export default function VoiceMessage({
  chatId,
  audioUrl,
  duration,
  isMe = false,
}: VoiceMessageProps) {
  const soundRef = useRef<Audio.Sound | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  async function togglePlay() {
    try {
      if (!soundRef.current) {
        setLoading(true);

        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: true },
          (status) => {
            if (!status.isLoaded) return;

            setPosition((status.positionMillis || 0) / 1000);

            if (status.didJustFinish) {
              setIsPlaying(false);
              setPosition(0);
            }
          }
        );

        soundRef.current = sound;
        setIsPlaying(true);
        setLoading(false);
        return;
      }

      if (isPlaying) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
      } else {
        await soundRef.current.playAsync();
        setIsPlaying(true);
      }
    } catch (e) {
      setLoading(false);
    }
  }

  return (
    <View
      style={[
        styles.container,
        isMe ? styles.me : styles.other,
      ]}
    >
      <TouchableOpacity onPress={togglePlay} style={styles.play}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.icon}>
            {isPlaying ? "⏸️" : "▶️"}
          </Text>
        )}
      </TouchableOpacity>

      <View style={styles.info}>
        <View style={styles.bar}>
          <View
            style={[
              styles.progress,
              {
                width:
                  duration > 0
                    ? `${Math.min((position / duration) * 100, 100)}%`
                    : "0%",
              },
            ]}
          />
        </View>

        <Text style={styles.time}>
          {formatTime(position)} / {formatTime(duration)}
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