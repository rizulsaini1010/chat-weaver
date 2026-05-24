import { useEffect, useState } from "react";
import type { Contact, Settings } from "./script-types";

const KEY = "cyno-editor-v1";

export const defaultSettings: Settings = {
  bottomReserveRatio: 0.3,
  cornerRadius: 54,
  bubbleFontSize: 40,
  bgColor: "#00ff00",
  theme: "dark",
  useGreenBubbles: false,
  revealAnimation: true,
  posterEveryPage: false,
  ttsProvider: "elevenlabs",
  elevenlabsApiKey: "",
  ai33proApiKey: "",
  stability: 0.5,
  similarity: 0.75,
  style: 0.5,
  speed: 1,
  silenceThresholdDb: -40,
  silencePaddingMs: 120,
  defaultMeVoice: "",
  defaultThemVoice: "",
  customVoices: [],
  sfxLibrary: [],
  backendUrl: "http://localhost:8787",

};




interface State {
  contacts: Contact[];
  settings: Settings;
}

export function loadState(): State | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as State;
  } catch {
    return null;
  }
}

export function saveState(s: State) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}

export function usePersisted<T>(initial: T, key: string): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {}
  }, [key, v]);
  return [v, setV];
}
