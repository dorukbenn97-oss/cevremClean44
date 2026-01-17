import { Audio, AVPlaybackStatus } from "expo-av";

let sound: Audio.Sound | null = null;
let isLoading = false;
let currentUri: string | null = null;
let onStopUI: (() => void) | null = null;

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
    await sound.unloadAsync();
    await new Promise((r) => setTimeout(r, 60));
  } catch {}

  if (onStopUI) onStopUI();

  sound = null;
  currentUri = null;
  onStopUI = null;
}

export async function playAudio({
  uri,
  onStatus,
  onStop,
}: {
  uri: string;
  onStatus?: (status: AVPlaybackStatus) => void;
  onStop: () => void;
}) {
  if (isLoading) return;
  isLoading = true;

  try {
    await ensureAudioMode();

    if (sound && currentUri === uri) {
      await stopAudio();
      return;
    }

    await stopAudio();

    const newSound = new Audio.Sound();

    await newSound.loadAsync(
      { uri },
      { shouldPlay: true }
    );

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