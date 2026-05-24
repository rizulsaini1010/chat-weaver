import type { Bubble, Contact, Settings } from "./script-types";

const uid = () => Math.random().toString(36).slice(2, 10);

export interface ParsedScript {
  contacts: Contact[];
  global: { UM?: string; CR?: number };
}

export function parseScript(raw: string): ParsedScript {
  const lines = raw.split(/\r?\n/);
  const contacts: Contact[] = [];
  let current: Contact | null = null;
  const global: { UM?: string; CR?: number } = {};

  const ensureContact = () => {
    if (!current) {
      current = { id: uid(), name: "Contact", bubbles: [] };
      contacts.push(current);
    }
    return current;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    // Globals
    let m = line.match(/^UM:\s*(.+)$/i);
    if (m) {
      global.UM = m[1].trim();
      continue;
    }
    m = line.match(/^CR:\s*(\d+)$/i);
    if (m) {
      global.CR = parseInt(m[1], 10);
      continue;
    }

    // iMessage: Name [: avatar]
    m = line.match(/^iMessage:\s*([^:]+?)(?:\s*:\s*(.+))?$/i);
    if (m) {
      const name = m[1].trim();
      const avatar = m[2]?.trim();
      const existing = contacts.find((c) => c.name === name);
      if (existing) {
        current = existing;
        if (avatar) existing.avatar = avatar;
      } else {
        current = { id: uid(), name, avatar, bubbles: [] };
        contacts.push(current);
      }
      continue;
    }

    // <break: 2s>
    m = line.match(/^<break:\s*(\d+(?:\.\d+)?)s?>$/i);
    if (m) {
      ensureContact().bubbles.push({
        id: uid(),
        kind: "break",
        side: "me",
        breakSeconds: parseFloat(m[1]),
      });
      continue;
    }

    // plugsay>Speaker: text  / rizzsay>Speaker: text  → start promo
    m = line.match(/^(plugsay|rizzsay)>([^:]+):\s*(.*)$/i);
    if (m) {
      ensureContact().bubbles.push({
        id: uid(),
        kind: "promo",
        side: "me",
        promoKind: m[1].toLowerCase().startsWith("plug") ? "plug" : "rizz",
        promoIntroSpeaker: m[2].trim(),
        promoIntroText: m[3].trim(),
      });
      continue;
    }
    // plug>Speaker: text or rizz>Speaker: text (or rizzy) → reply attaches to last promo
    m = line.match(/^(plug|rizz|rizzy)>([^:]+):\s*(.*)$/i);
    if (m) {
      const c = ensureContact();
      const last = [...c.bubbles].reverse().find((b) => b.kind === "promo");
      if (last) {
        last.promoReplySpeaker = m[2].trim();
        last.promoReplyText = m[3].trim();
      } else {
        c.bubbles.push({
          id: uid(),
          kind: "promo",
          side: "me",
          promoKind: m[1].toLowerCase().startsWith("plug") ? "plug" : "rizz",
          promoReplySpeaker: m[2].trim(),
          promoReplyText: m[3].trim(),
        });
      }
      continue;
    }

    // Speaker>side: text   or   side: filename
    m = line.match(/^([^>:]+)>(me|them|audio):\s*(.*)$/i);
    if (m) {
      const speaker = m[1].trim();
      const sideKey = m[2].toLowerCase();
      let text = m[3];
      // tts override "==" splits bubble vs spoken
      let ttsOverride: string | undefined;
      const ov = text.split("==");
      if (ov.length === 2) {
        text = ov[0].trim();
        ttsOverride = ov[1].trim();
      }
      // sfx tag [name] at end
      let sfx: string | undefined;
      const sfxMatch = text.match(/\[([^\]]+)\]\s*$/);
      if (sfxMatch) {
        sfx = sfxMatch[1].trim();
        text = text.replace(/\[[^\]]+\]\s*$/, "").trim();
      }
      if (sideKey === "audio") {
        ensureContact().bubbles.push({
          id: uid(),
          kind: "audio",
          side: "me",
          speaker,
          text,
          ttsOverride,
          sfx,
        });
      } else {
        ensureContact().bubbles.push({
          id: uid(),
          kind: "text",
          side: sideKey as "me" | "them",
          speaker,
          text,
          ttsOverride,
          sfx,
        });
      }
      continue;
    }

    // image: side: filename.ext
    m = line.match(/^(me|them):\s*(\S+\.(?:png|jpe?g|gif|webp))$/i);
    if (m) {
      ensureContact().bubbles.push({
        id: uid(),
        kind: "image",
        side: m[1].toLowerCase() as "me" | "them",
        imageName: m[2],
      });
      continue;
    }
  }

  if (!contacts.length) contacts.push({ id: uid(), name: "Contact", bubbles: [] });
  return { contacts, global };
}

export function serializeScript(
  contacts: Contact[],
  settings: Settings,
): string {
  const out: string[] = [];
  out.push("# iMessage Script");
  out.push("");
  out.push("# Global settings");
  out.push(`UM: ${0}+`);
  out.push(`CR: ${settings.cornerRadius}`);
  out.push("");
  for (const c of contacts) {
    out.push(`iMessage: ${c.name}${c.avatar ? `: ${c.avatar}` : ""}`);
    if (c.unread != null) out.push(`# unread: ${c.unread}`);
    for (const b of c.bubbles) {
      switch (b.kind) {
        case "break":
          out.push(`<break: ${b.breakSeconds ?? 2}s>`);
          break;
        case "image":
          out.push(`${b.side}: ${b.imageName ?? "image.jpg"}`);
          break;
        case "audio": {
          let t = b.text ?? "";
          if (b.ttsOverride) t = `${t} == ${b.ttsOverride}`;
          if (b.sfx) t = `${t} [${b.sfx}]`;
          out.push(`${b.speaker ?? "Speaker"}>audio: ${t}`);
          break;
        }
        case "text": {
          let t = b.text ?? "";
          if (b.ttsOverride) t = `${t} == ${b.ttsOverride}`;
          if (b.sfx) t = `${t} [${b.sfx}]`;
          out.push(`${b.speaker ?? "Speaker"}>${b.side}: ${t}`);
          break;
        }
        case "none":
          out.push(`# none bubble (skipped TTS)`);
          break;
        case "promo": {
          const tag = b.promoKind === "rizz" ? "rizz" : "plug";
          if (b.promoIntroText)
            out.push(
              `${tag}say>${b.promoIntroSpeaker ?? "Speaker"}: ${b.promoIntroText}`,
            );
          if (b.promoReplyText && b.promoReplySpeaker !== "none")
            out.push(
              `${tag === "rizz" ? "rizzy" : "plug"}>${b.promoReplySpeaker ?? "Speaker"}: ${b.promoReplyText}`,
            );
          break;
        }
      }
    }
    out.push("");
  }
  return out.join("\n");
}

export function newBubble(side: "me" | "them" = "me"): Bubble {
  return { id: uid(), kind: "text", side, text: "" };
}
export function newContact(name = "New Contact"): Contact {
  return { id: uid(), name, bubbles: [] };
}
