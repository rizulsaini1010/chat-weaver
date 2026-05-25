import { useState } from "react";
import type { Settings } from "@/lib/script-types";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { ELEVENLABS_VOICES, AI33PRO_VOICES } from "@/lib/voices";

interface Props {
  settings: Settings;
  setSettings: (s: Settings) => void;
}

export function SettingsPanel({ settings, setSettings }: Props) {
  const update = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    setSettings({ ...settings, [k]: v });
  const voices =
    settings.ttsProvider === "elevenlabs"
      ? [...ELEVENLABS_VOICES, ...settings.customVoices]
      : [...AI33PRO_VOICES, ...settings.customVoices];

  return (
    <div className="flex flex-col gap-4">
      <Section title="Appearance">
        <Row label="Theme">
          <Select
            value={settings.theme}
            onValueChange={(v) => update("theme", v as "dark" | "light")}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="dark">Dark (iMessage)</SelectItem>
              <SelectItem value="light">Light (iMessage)</SelectItem>
            </SelectContent>
          </Select>
        </Row>



        <Slid label={`Bubble font size (${settings.bubbleFontSize}px)`} v={settings.bubbleFontSize} min={20} max={80} onChange={(n) => update("bubbleFontSize", n)} />
        <Slid label={`Bottom reserve (${settings.bottomReserveRatio.toFixed(2)})`} v={settings.bottomReserveRatio} min={0} max={0.6} step={0.01} onChange={(n) => update("bottomReserveRatio", n)} />
        <Row label="Reveal animation">
          <Switch checked={settings.revealAnimation} onCheckedChange={(c) => update("revealAnimation", c)} />
        </Row>
        <Row label="Poster mode">
          <Select
            value={settings.posterEveryPage ? "every" : "first"}
            onValueChange={(v) => update("posterEveryPage", v === "every")}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="first">First page only</SelectItem>
              <SelectItem value="every">Every page</SelectItem>
            </SelectContent>
          </Select>
        </Row>
      </Section>

      <Section title="TTS Provider">
        <Row label="Provider">
          <Select
            value={settings.ttsProvider}
            onValueChange={(v) => update("ttsProvider", v as "elevenlabs" | "ai33pro")}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
              <SelectItem value="ai33pro">AI33Pro</SelectItem>
            </SelectContent>
          </Select>
        </Row>
        {settings.ttsProvider === "elevenlabs" ? (
          <ApiKeyField
            label="ElevenLabs API key"
            value={settings.elevenlabsApiKey}
            onChange={(v) => update("elevenlabsApiKey", v)}
          />
        ) : (
          <ApiKeyField
            label="AI33Pro API key"
            value={settings.ai33proApiKey}
            onChange={(v) => update("ai33proApiKey", v)}
          />
        )}
        <Row label="Default voice (Me)">
          <Select
            value={settings.defaultMeVoice || "__none"}
            onValueChange={(v) => update("defaultMeVoice", v === "__none" ? "" : v)}
          >
            <SelectTrigger><SelectValue placeholder="Pick voice" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">— none —</SelectItem>
              {voices.map((v) => (
                <SelectItem key={v.id} value={v.name}>{v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>
        <Row label="Default voice (Them)">
          <Select
            value={settings.defaultThemVoice || "__none"}
            onValueChange={(v) => update("defaultThemVoice", v === "__none" ? "" : v)}
          >
            <SelectTrigger><SelectValue placeholder="Pick voice" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">— none —</SelectItem>
              {voices.map((v) => (
                <SelectItem key={v.id} value={v.name}>{v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>
        <Slid label={`Stability (${settings.stability.toFixed(2)})`} v={settings.stability} min={0} max={1} step={0.01} onChange={(n) => update("stability", n)} />
        <Slid label={`Similarity boost (${settings.similarity.toFixed(2)})`} v={settings.similarity} min={0} max={1} step={0.01} onChange={(n) => update("similarity", n)} />
        <Slid label={`Style (${settings.style.toFixed(2)})`} v={settings.style} min={0} max={1} step={0.01} onChange={(n) => update("style", n)} />
        <Slid label={`Speed (${settings.speed.toFixed(2)})`} v={settings.speed} min={0.7} max={1.2} step={0.01} onChange={(n) => update("speed", n)} />
      </Section>

      <Section title="Silence trimmer">
        <Slid label={`Threshold (${settings.silenceThresholdDb} dB)`} v={settings.silenceThresholdDb} min={-80} max={-10} step={1} onChange={(n) => update("silenceThresholdDb", n)} />
        <Slid label={`Padding (${settings.silencePaddingMs} ms)`} v={settings.silencePaddingMs} min={0} max={500} step={10} onChange={(n) => update("silencePaddingMs", n)} />
      </Section>

      <Section title="Render backend">
        <Row label="Server URL">
          <Input
            value={settings.backendUrl}
            onChange={(e) => update("backendUrl", e.target.value)}
            placeholder="http://localhost:8787"
            className="h-9"
          />
        </Row>
        <p className="text-[10px] text-muted-foreground">
          Run <code>cd cyno-server &amp;&amp; npm install &amp;&amp; npm start</code> on your machine, then click Render in the header.
        </p>
      </Section>

      <CustomVoicesPanel settings={settings} setSettings={setSettings} />
      <SfxPanel settings={settings} setSettings={setSettings} />

    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="mb-3 text-sm font-semibold tracking-wide uppercase text-muted-foreground">{title}</div>
      <div className="flex flex-col gap-3">{children}</div>
    </Card>
  );
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3">
      <Label className="text-xs">{label}</Label>
      <div className="min-w-[180px]">{children}</div>
    </div>
  );
}
function Slid({ label, v, min, max, step = 1, onChange }: { label: string; v: number; min: number; max: number; step?: number; onChange: (n: number) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Slider className="mt-2" value={[v]} min={min} max={max} step={step} onValueChange={(x) => onChange(x[0])} />
    </div>
  );
}
function ApiKeyField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1 flex gap-2">
        <Input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} placeholder="paste key" />
        <Button type="button" variant="outline" size="icon" onClick={() => setShow(!show)}>
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">Stored locally in this browser only.</p>
    </div>
  );
}

function CustomVoicesPanel({ settings, setSettings }: Props) {
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  return (
    <Section title="Custom voices">
      <div className="flex gap-2">
        <Input placeholder="Label" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Voice ID" value={id} onChange={(e) => setId(e.target.value)} />
        <Button
          size="icon"
          onClick={() => {
            if (!name || !id) return;
            setSettings({
              ...settings,
              customVoices: [
                ...settings.customVoices,
                { id, name, provider: "custom" },
              ],
            });
            setName(""); setId("");
          }}
        ><Plus className="size-4" /></Button>
      </div>
      {settings.customVoices.length > 0 ? (
        <ul className="divide-y rounded border">
          {settings.customVoices.map((v) => (
            <li key={v.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <div>
                <div className="font-medium">{v.name}</div>
                <div className="text-xs text-muted-foreground font-mono">{v.id}</div>
              </div>
              <Button
                size="icon" variant="ghost"
                onClick={() => setSettings({
                  ...settings,
                  customVoices: settings.customVoices.filter((x) => x.id !== v.id),
                })}
              ><Trash2 className="size-4" /></Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No custom voices yet.</p>
      )}
    </Section>
  );
}

function SfxPanel({ settings, setSettings }: Props) {
  return (
    <Section title="SFX library">
      {settings.sfxLibrary.length > 0 ? (
        <ul className="divide-y rounded border">
          {settings.sfxLibrary.map((s, i) => (
            <li key={i} className="flex items-center justify-between px-3 py-2 text-sm">
              <span className="truncate">{s.name}</span>
              <Button
                size="icon" variant="ghost"
                onClick={() =>
                  setSettings({
                    ...settings,
                    sfxLibrary: settings.sfxLibrary.filter((_, j) => j !== i),
                  })
                }
              ><Trash2 className="size-4" /></Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No SFX uploaded yet.</p>
      )}
      <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-dashed px-3 py-2 text-sm hover:bg-accent/40">
        <Plus className="size-4" /> Upload SFX (mp3/wav)
        <input
          type="file" accept="audio/*" multiple className="hidden"
          onChange={async (e) => {
            const files = Array.from(e.target.files ?? []);
            const newOnes = await Promise.all(files.map(async (f) => ({
              name: f.name.replace(/\.[^.]+$/, ""),
              dataUrl: await fileToDataUrl(f),
            })));
            setSettings({ ...settings, sfxLibrary: [...settings.sfxLibrary, ...newOnes] });
          }}
        />
      </label>
    </Section>
  );
}

function fileToDataUrl(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}
