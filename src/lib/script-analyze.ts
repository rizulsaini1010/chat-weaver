// Scan a raw script and extract speakers, sfx tags, image filenames, and contact avatars.

export interface ScriptScan {
  speakers: string[];
  sfx: string[];
  images: string[];
  contactAvatars: string[];
}

const IMG_EXT = /\.(png|jpe?g|gif|webp)$/i;

export function scanScript(raw: string): ScriptScan {
  const speakers = new Set<string>();
  const sfx = new Set<string>();
  const images = new Set<string>();
  const contactAvatars = new Set<string>();

  const addSpeaker = (s: string) => {
    const v = s.trim();
    if (v && v.toLowerCase() !== "none") speakers.add(v);
  };

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    // iMessage: NAME [: avatarFile.ext]
    let m = line.match(/^iMessage[:\s]+([^:]+?)(?:\s*:\s*(\S+))?$/i);
    if (m) {
      if (m[2] && IMG_EXT.test(m[2])) {
        contactAvatars.add(m[2]);
        images.add(m[2]);
      }
      continue;
    }

    // image line: side: filename.ext
    m = line.match(/^(me|them):\s*(\S+)$/i);
    if (m && IMG_EXT.test(m[2])) {
      images.add(m[2]);
      continue;
    }

    // promo intro / reply
    m = line.match(/^(plugsay|rizzsay|plug|rizz|rizzy)>([^:]+):\s*(.*)$/i);
    if (m) {
      addSpeaker(m[2]);
      collectSfx(m[3], sfx);
      continue;
    }

    // Speaker>me|them|audio: text
    m = line.match(/^([^>:]+)>(me|them|audio):\s*(.*)$/i);
    if (m) {
      addSpeaker(m[1]);
      collectSfx(m[3], sfx);
      continue;
    }
  }

  return {
    speakers: [...speakers].sort(),
    sfx: [...sfx].sort(),
    images: [...images].sort(),
    contactAvatars: [...contactAvatars].sort(),
  };
}

function collectSfx(text: string, into: Set<string>) {
  const re = /\[([^\]]+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const v = m[1].trim();
    if (v) into.add(v);
  }
}

const isMx = (n: string) => {
  const v = n.trim().toLowerCase();
  return v.startsWith("mx_") || v.startsWith("mx:");
};

// Rewrite the script so each known speaker name is replaced by its voice id.
// For MiniMax speakers (mx_Name), rewrite "mx_Name" -> "mx:<voiceId>" so the
// backend's getMinimaxVoiceId() picks up the user-supplied numeric clone ID.
export function applyVoiceMap(raw: string, voiceMap: Record<string, string>): string {
  const resolveMx = (name: string): string | null => {
    const id = voiceMap[name];
    if (id && id.trim()) return `mx:${id.trim()}`;
    // If user typed mx:<id> directly, leave it
    if (name.toLowerCase().startsWith("mx:")) return name;
    return null;
  };

  return raw
    .split(/\r?\n/)
    .map((rawLine) => {
      const line = rawLine;
      let m = line.match(/^(\s*)(plugsay|rizzsay|plug|rizz|rizzy)>([^:]+):(.*)$/i);
      if (m) {
        const name = m[3].trim();
        if (isMx(name)) {
          const rewrite = resolveMx(name);
          return rewrite ? `${m[1]}${m[2]}>${rewrite}:${m[4]}` : line;
        }
        const id = voiceMap[name];
        return id ? `${m[1]}${m[2]}>${id}:${m[4]}` : line;
      }
      m = line.match(/^(\s*)([^>:#]+)>(me|them|audio):(.*)$/i);
      if (m) {
        const name = m[2].trim();
        if (isMx(name)) {
          const rewrite = resolveMx(name);
          return rewrite ? `${m[1]}${rewrite}>${m[3]}:${m[4]}` : line;
        }
        const id = voiceMap[name];
        return id ? `${m[1]}${id}>${m[3]}:${m[4]}` : line;
      }
      return line;
    })
    .join("\n");
}
