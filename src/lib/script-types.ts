export type Side = "me" | "them";
export type BubbleKind =
  | "text"
  | "image"
  | "audio"
  | "break"
  | "none"
  | "promo";

export type PromoKind = "rizz" | "plug";

export interface Bubble {
  id: string;
  kind: BubbleKind;
  side: Side;
  speaker?: string; // speaker name or voice id label
  text?: string;
  ttsOverride?: string; // what TTS speaks if different
  imageName?: string; // filename ref
  breakSeconds?: number;
  sfx?: string; // sfx name or "" / none
  // promo
  promoKind?: PromoKind;
  promoIntroSpeaker?: string;
  promoIntroText?: string;
  promoReplySpeaker?: string; // "none" allowed
  promoReplyText?: string;
}

export interface Contact {
  id: string;
  name: string;
  avatar?: string; // file name
  unread?: number;
  posterEveryPage?: boolean;
  bubbles: Bubble[];
}

export interface VoicePreset {
  id: string;
  name: string;
  provider: "elevenlabs" | "ai33pro" | "custom";
}

export interface Settings {
  // Layout
  bottomReserveRatio: number;
  cornerRadius: number;
  bubbleFontSize: number;
  bgColor: string; // hex
  // Theme
  theme: "dark" | "light";
  useGreenBubbles: boolean;
  revealAnimation: boolean;
  posterEveryPage: boolean; // global default
  // TTS
  ttsProvider: "elevenlabs" | "ai33pro";
  elevenlabsApiKey: string;
  ai33proApiKey: string;
  stability: number;
  similarity: number;
  style: number;
  speed: number;
  // Silence
  silenceThresholdDb: number;
  silencePaddingMs: number;
  // Defaults
  defaultMeVoice: string;
  defaultThemVoice: string;
  // Custom voices added by user
  customVoices: VoicePreset[];
  // SFX library
  sfxLibrary: { name: string; dataUrl?: string }[];
}
