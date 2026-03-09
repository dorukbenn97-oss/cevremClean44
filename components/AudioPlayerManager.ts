import { Audio, AVPlaybackStatus } from "expo-av";

let sound: Audio.Sound | null = null;
let isLoading = false;
let currentUri: string | null = null;
let onStopUI: (() => void) | null = null;

// ✅ RAM AUDIO CACHE
const soundCache = new Map<string, Audio.Sound>();

async function ensureAudioMode() {
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    allowsRecordingIOS: false,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
  });
}

export async function stopAudio() {
  if (!sound) return;

  try {
    await sound.stopAsync();
  } catch {}

  if (onStopUI) onStopUI();

  sound = null;
  currentUri = null;
  onStopUI = null;
}

async function getCachedSound(uri: string) {
  if (soundCache.has(uri)) {
    return soundCache.get(uri)!;
  }

  const newSound = new Audio.Sound();

  await newSound.loadAsync({ uri }, { shouldPlay: false });

  soundCache.set(uri, newSound);

  return newSound;
}

export async function playAudio({
  uri,
  startPosition = 0,
  onStatus,
  onStop,
}: {
  uri: string;
  startPosition?: number;
  onStatus?: (status: AVPlaybackStatus) => void;
  onStop: () => void;
}) {
  if (isLoading) return;

  isLoading = true;

  try {
    await ensureAudioMode();

    // aynı ses ise kapat
    if (sound && currentUri === uri) {
      await stopAudio();
      isLoading = false;
      return;
    }

    await stopAudio();

    // ✅ CACHE'TEN AL
    const newSound = await getCachedSound(uri);

    if (startPosition > 0) {
      await newSound.setPositionAsync(startPosition * 1000);
    }

    if (onStatus) {
      newSound.setOnPlaybackStatusUpdate(onStatus);
    }

    sound = newSound;
    currentUri = uri;
    onStopUI = onStop;

    await newSound.playAsync();
  } catch {
    await stopAudio();
  } finally {
    isLoading = false;
  }
}