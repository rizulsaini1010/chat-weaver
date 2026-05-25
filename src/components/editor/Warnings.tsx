import { useMemo } from "react";
import type { Contact, Settings } from "@/lib/script-types";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { ELEVENLABS_VOICES, AI33PRO_VOICES } from "@/lib/voices";

interface Props {
  contacts: Contact[];
  settings: Settings;
}

export interface ScriptIssue {
  type: "image" | "voice" | "sfx" | "key" | "avatar";
  msg: string;
}

export function computeIssues(contacts: Contact[], settings: Settings): ScriptIssue[] {
  const w: ScriptIssue[] = [];
  const knownSfx = new Set(settings.sfxLibrary.map((s) => s.name.toLowerCase()));
  const preset =
    settings.ttsProvider === "elevenlabs" ? ELEVENLABS_VOICES : AI33PRO_VOICES;
  const knownVoices = new Set<string>([
    ...preset.map((v) => v.name.toLowerCase()),
    ...settings.customVoices.map((v) => v.name.toLowerCase()),
    ...settings.customVoices.map((v) => v.id.toLowerCase()),
  ]);
  if (settings.defaultMeVoice) knownVoices.add(settings.defaultMeVoice.toLowerCase());
  if (settings.defaultThemVoice) knownVoices.add(settings.defaultThemVoice.toLowerCase());

  if (settings.ttsProvider === "elevenlabs" && !settings.elevenlabsApiKey)
    w.push({ type: "key", msg: "ElevenLabs API key is not set." });
  if (settings.ttsProvider === "ai33pro" && !settings.ai33proApiKey)
    w.push({ type: "key", msg: "AI33Pro API key is not set." });

  for (const c of contacts) {
    if (c.avatar && !c.avatarData && !/^https?:\/\//.test(c.avatar)) {
      w.push({
        type: "avatar",
        msg: `Contact "${c.name}" avatar "${c.avatar}" — file not uploaded.`,
      });
    }
    for (const b of c.bubbles) {
      if (b.kind === "image") {
        if (!b.imageName) {
          w.push({ type: "image", msg: `Image bubble in "${c.name}" has no filename.` });
        } else if (!b.imageData) {
          w.push({
            type: "image",
            msg: `Image "${b.imageName}" in "${c.name}" not uploaded.`,
          });
        }
      }
      if (b.sfx && !knownSfx.has(b.sfx.toLowerCase())) {
        w.push({
          type: "sfx",
          msg: `SFX "${b.sfx}" used in "${c.name}" not uploaded — upload it in Settings → SFX library.`,
        });
      }
      if (
        (b.kind === "text" || b.kind === "audio") &&
        b.speaker &&
        !knownVoices.has(b.speaker.toLowerCase()) &&
        !looksLikeVoiceId(b.speaker)
      ) {
        w.push({
          type: "voice",
          msg: `Speaker "${b.speaker}" has no voice ID — add a custom voice in Settings.`,
        });
      }
      if (b.kind === "promo") {
        for (const sp of [b.promoIntroSpeaker, b.promoReplySpeaker]) {
          if (sp && sp !== "none" && !knownVoices.has(sp.toLowerCase()) && !looksLikeVoiceId(sp)) {
            w.push({ type: "voice", msg: `Promo speaker "${sp}" has no voice ID.` });
          }
        }
      }
    }
  }
  const seen = new Set<string>();
  return w.filter((i) => {
    const k = i.type + "|" + i.msg;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function Warnings({ contacts, settings }: Props) {
  const issues = useMemo(() => computeIssues(contacts, settings), [contacts, settings]);
  if (!issues.length) {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm flex items-center gap-2">
        <CheckCircle2 className="size-4 text-emerald-500" />
        <span>All assets, voices and SFX are mapped — ready to render.</span>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
      <div className="mb-2 flex items-center gap-2 font-semibold text-warning-foreground">
        <AlertTriangle className="size-4" /> {issues.length} warning
        {issues.length > 1 ? "s" : ""} — fix before rendering
      </div>
      <ul className="ml-6 list-disc space-y-1 text-foreground/80">
        {issues.slice(0, 20).map((i, idx) => (
          <li key={idx}>{i.msg}</li>
        ))}
        {issues.length > 20 ? (
          <li className="text-muted-foreground">+{issues.length - 20} more…</li>
        ) : null}
      </ul>
    </div>
  );
}

function looksLikeVoiceId(s: string) {
  // ElevenLabs IDs are ~20 char alnum, ai33 ids contain dashes
  return /^[A-Za-z0-9_-]{12,}$/.test(s);
}
