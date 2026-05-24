import { useMemo } from "react";
import type { Contact, Settings } from "@/lib/script-types";
import { AlertTriangle } from "lucide-react";

interface Props {
  contacts: Contact[];
  settings: Settings;
}

export function Warnings({ contacts, settings }: Props) {
  const issues = useMemo(() => {
    const w: { type: "image" | "voice" | "sfx" | "key"; msg: string }[] = [];
    const knownSfx = new Set(settings.sfxLibrary.map((s) => s.name.toLowerCase()));
    const knownVoices = new Set([
      ...settings.customVoices.map((v) => v.name.toLowerCase()),
      ...settings.customVoices.map((v) => v.id.toLowerCase()),
    ]);
    if (settings.defaultMeVoice)
      knownVoices.add(settings.defaultMeVoice.toLowerCase());
    if (settings.defaultThemVoice)
      knownVoices.add(settings.defaultThemVoice.toLowerCase());

    // API keys
    if (settings.ttsProvider === "elevenlabs" && !settings.elevenlabsApiKey)
      w.push({ type: "key", msg: "ElevenLabs API key is not set." });
    if (settings.ttsProvider === "ai33pro" && !settings.ai33proApiKey)
      w.push({ type: "key", msg: "AI33Pro API key is not set." });

    for (const c of contacts) {
      if (c.avatar && !/^https?:\/\//.test(c.avatar)) {
        // we treat any avatar string as required upload
        w.push({
          type: "image",
          msg: `Contact "${c.name}" references avatar "${c.avatar}" — file not uploaded.`,
        });
      }
      for (const b of c.bubbles) {
        if (b.kind === "image" && b.imageName) {
          w.push({
            type: "image",
            msg: `Image "${b.imageName}" referenced in "${c.name}" is not uploaded.`,
          });
        }
        if (b.sfx && !knownSfx.has(b.sfx.toLowerCase())) {
          w.push({
            type: "sfx",
            msg: `SFX "${b.sfx}" used in "${c.name}" not found in SFX library.`,
          });
        }
        if (
          (b.kind === "text" || b.kind === "audio") &&
          b.speaker &&
          !knownVoices.has(b.speaker.toLowerCase()) &&
          !isLikelyPresetName(b.speaker)
        ) {
          w.push({
            type: "voice",
            msg: `Speaker "${b.speaker}" has no voice ID mapped.`,
          });
        }
      }
    }
    // dedupe
    const seen = new Set<string>();
    return w.filter((i) => {
      const k = i.type + "|" + i.msg;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [contacts, settings]);

  if (!issues.length) return null;
  return (
    <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
      <div className="mb-2 flex items-center gap-2 font-semibold text-warning-foreground">
        <AlertTriangle className="size-4" /> {issues.length} warning
        {issues.length > 1 ? "s" : ""}
      </div>
      <ul className="ml-6 list-disc space-y-1 text-foreground/80">
        {issues.slice(0, 12).map((i, idx) => (
          <li key={idx}>{i.msg}</li>
        ))}
        {issues.length > 12 ? (
          <li className="text-muted-foreground">
            +{issues.length - 12} more…
          </li>
        ) : null}
      </ul>
    </div>
  );
}

const PRESETS = new Set([
  "roger","sarah","laura","charlie","george","callum","river","liam",
  "alice","matilda","will","jessica","eric","chris","brian","daniel",
  "lily","bill","santa","mrs claus","reindeer","elf","glitch",
  "aiden","mason","nova","luna",
]);
function isLikelyPresetName(s: string) {
  return PRESETS.has(s.toLowerCase());
}
