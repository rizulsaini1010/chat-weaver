import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle, CheckCircle2, Download, FileAudio, Image as ImageIcon,
  Loader2, Mic, Play, Settings as SettingsIcon, Upload,
} from "lucide-react";

import { defaultSettings, usePersisted } from "@/lib/store";
import type { Settings } from "@/lib/script-types";
import { applyVoiceMap, scanScript } from "@/lib/script-analyze";
import { SettingsPanel } from "@/components/editor/SettingsPanel";
import { ELEVENLABS_VOICES, AI33PRO_VOICES } from "@/lib/voices";

export const Route = createFileRoute("/")({
  component: App,
  head: () => ({
    meta: [
      { title: "Cyno Script → Video" },
      { name: "description", content: "Paste a Cyno script, attach voices, SFX and images, render the iMessage video." },
    ],
  }),
});

const EXAMPLE = `# Example
iMessage: Alex
Alex>them: Yo whats up
Me>me: Not much, you?
Me>me: Check this out
me: 1.jpg
Alex>them: Damn thats wild [pop]
<break: 1s>
plugsay>Me: What do you think?
plug>Alex: Pretty cool ngl
`;

function App() {
  const [script, setScript] = usePersisted<string>(EXAMPLE, "cyno-script-v2");
  const [settings, setSettings] = usePersisted<Settings>(defaultSettings, "cyno-settings-v2");
  const [voiceMap, setVoiceMap] = usePersisted<Record<string, string>>({}, "cyno-voicemap-v2");
  const [imageFiles, setImageFiles] = useState<Record<string, string>>({});
  const [sfxFiles, setSfxFiles] = useState<Record<string, string>>({});

  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStage, setProgressStage] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const scan = useMemo(() => scanScript(script), [script]);

  // Trim stale entries when script changes
  useEffect(() => {
    setImageFiles((cur) => Object.fromEntries(Object.entries(cur).filter(([k]) => scan.images.includes(k))));
    setSfxFiles((cur) => Object.fromEntries(Object.entries(cur).filter(([k]) => scan.sfx.includes(k))));
  }, [scan.images, scan.sfx]);

  const voices = settings.ttsProvider === "elevenlabs"
    ? [...ELEVENLABS_VOICES, ...settings.customVoices]
    : [...AI33PRO_VOICES, ...settings.customVoices];

  const knownVoiceNames = new Set(voices.map((v) => v.name.toLowerCase()));

  const missingVoices = scan.speakers.filter(
    (s) => !isMinimaxSpeaker(s) && !voiceMap[s] && !knownVoiceNames.has(s.toLowerCase()) && !looksLikeId(s),
  );
  const missingImages = scan.images.filter((n) => !imageFiles[n]);
  const missingSfx = scan.sfx.filter((n) => !sfxFiles[n]);
  const apiKeyMissing =
    (settings.ttsProvider === "elevenlabs" && !settings.elevenlabsApiKey) ||
    (settings.ttsProvider === "ai33pro" && !settings.ai33proApiKey);

  const issueCount =
    missingVoices.length + missingImages.length + missingSfx.length + (apiKeyMissing ? 1 : 0);

  // ---------- Render ----------
  const startRender = () => {
    if (issueCount > 0) { setConfirmOpen(true); return; }
    void doRender();
  };

  const doRender = async () => {
    if (rendering) return;
    const url = (settings.backendUrl || "").replace(/\/$/, "");
    if (!url) { toast.error("Set the render backend URL in Settings"); return; }
    setRendering(true);
    setProgress(0);
    setProgressStage("Submitting…");
    const t = toast.loading("Rendering video — this can take a while…");
    try {
      const assets: Record<string, string> = {};
      for (const [name, data] of Object.entries(imageFiles)) assets[name] = data;
      for (const [name, data] of Object.entries(sfxFiles)) assets[name.includes(".") ? name : `${name}.mp3`] = data;

      const apiKey = settings.ttsProvider === "elevenlabs" ? settings.elevenlabsApiKey : settings.ai33proApiKey;
      const finalScript = applyVoiceMap(script, voiceMap);

      const submit = await fetch(`${url}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: finalScript,
          settings,
          assets,
          voiceMap,
          apiKey,
          ttsProvider: settings.ttsProvider,
        }),
      });
      if (!submit.ok) throw new Error((await submit.text()) || `HTTP ${submit.status}`);
      const { jobId } = (await submit.json()) as { jobId: string };
      if (!jobId) throw new Error("Backend did not return jobId");

      let done = false;
      while (!done) {
        await new Promise((r) => setTimeout(r, 1000));
        const pr = await fetch(`${url}/progress/${jobId}`);
        if (!pr.ok) throw new Error(`Progress HTTP ${pr.status}`);
        const data = (await pr.json()) as { progress: number; stage: string; status: string; error?: string };
        setProgress(Math.min(99, Math.round(data.progress)));
        setProgressStage(data.stage || data.status);
        if (data.status === "error") throw new Error(data.error || "render error");
        if (data.status === "done") done = true;
      }
      const res = await fetch(`${url}/result/${jobId}`);
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "cyno-output.mp4";
      a.click();
      URL.revokeObjectURL(a.href);
      setProgress(100);
      setProgressStage("Done");
      toast.success("Video ready", { id: t });
    } catch (e) {
      toast.error(`Render failed: ${(e as Error).message}`, { id: t });
    } finally {
      setRendering(false);
    }
  };

  const onUploadScript = async (f: File) => {
    const txt = await f.text();
    setScript(txt);
    toast.success(`Imported ${f.name}`);
  };

  const downloadScript = () => {
    const txt = applyVoiceMap(script, voiceMap);
    const blob = new Blob([txt], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "script.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster richColors position="top-right" />
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-gradient-to-br from-imessage-blue to-primary shadow" />
            <h1 className="text-base font-bold tracking-tight">Cyno Script → Video</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-accent/50">
              <Upload className="size-4" /> Upload script
              <input
                type="file" accept=".txt,.md" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadScript(f); }}
              />
            </label>
            <Button size="sm" variant="outline" onClick={downloadScript}>
              <Download className="size-4" /> .txt
            </Button>
            <Button size="sm" onClick={startRender} disabled={rendering}>
              {rendering ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              {rendering ? `Rendering ${progress}/100` : "Render video"}
            </Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button size="sm" variant="outline">
                  <SettingsIcon className="size-4" /> Settings
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-md overflow-y-auto">
                <SheetHeader><SheetTitle>Settings</SheetTitle></SheetHeader>
                <div className="mt-4"><SettingsPanel settings={settings} setSettings={setSettings} /></div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1400px] gap-4 px-4 py-6 lg:grid-cols-[1fr_420px]">
        {/* Script editor */}
        <section className="flex flex-col gap-4 min-w-0">
          <Card className="p-4">
            <Label className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">
              Script
            </Label>
            <Textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              className="min-h-[60vh] font-mono text-xs"
              spellCheck={false}
              placeholder="Paste your Cyno script here, or click Upload script…"
            />
            <p className="mt-2 text-[11px] text-muted-foreground">
              Detected: {scan.speakers.length} speaker{plural(scan.speakers.length)},{" "}
              {scan.images.length} image{plural(scan.images.length)},{" "}
              {scan.sfx.length} SFX cue{plural(scan.sfx.length)}.
            </p>
          </Card>

          {rendering ? (
            <Card className="p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">{progressStage || "Rendering…"}</span>
                <span className="text-muted-foreground tabular-nums">{progress}/100</span>
              </div>
              <Progress value={progress} />
            </Card>
          ) : null}
        </section>

        {/* Asset panel */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-auto pr-1">
          <StatusCard issueCount={issueCount} />

          {apiKeyMissing ? (
            <WarningCard
              text={`No ${settings.ttsProvider === "elevenlabs" ? "ElevenLabs" : "AI33Pro"} API key — open Settings to add one.`}
            />
          ) : null}

          {/* Speakers / voices */}
          <Card className="p-4">
            <SectionHeader icon={<Mic className="size-4" />} title="Speakers → Voice IDs" />
            {scan.speakers.length === 0 ? (
              <Empty text="No speakers detected in script." />
            ) : (
              <div className="flex flex-col gap-3">
                {scan.speakers.map((sp) => {
                  const presetMatch = voices.find((v) => v.name.toLowerCase() === sp.toLowerCase());
                  const current = voiceMap[sp] || (presetMatch?.id ?? "");
                  return (
                    <div key={sp} className="grid grid-cols-[110px_1fr] items-center gap-2">
                      <Label className="truncate text-xs font-medium" title={sp}>{sp}</Label>
                      <div className="flex gap-1">
                        <Select
                          value={voices.find((v) => v.id === current)?.id ?? "__custom"}
                          onValueChange={(v) => {
                            if (v === "__custom") return;
                            setVoiceMap({ ...voiceMap, [sp]: v });
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Preset" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__custom">— custom ID —</SelectItem>
                            {voices.map((v) => (
                              <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          className="h-8 text-xs font-mono"
                          placeholder="voice id"
                          value={voiceMap[sp] ?? ""}
                          onChange={(e) => setVoiceMap({ ...voiceMap, [sp]: e.target.value })}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Images */}
          <Card className="p-4">
            <SectionHeader icon={<ImageIcon className="size-4" />} title="Images" />
            {scan.images.length === 0 ? (
              <Empty text="No image references in script." />
            ) : (
              <ul className="flex flex-col gap-2">
                {scan.images.map((name) => (
                  <li key={name} className="flex items-center gap-2">
                    <span className="flex-1 truncate text-xs font-mono">{name}</span>
                    {imageFiles[name] ? (
                      <img src={imageFiles[name]} alt={name} className="size-10 rounded object-cover border" />
                    ) : (
                      <span className="text-[10px] text-warning-foreground">missing</span>
                    )}
                    <label className="inline-flex cursor-pointer items-center rounded border px-2 py-1 text-xs hover:bg-accent/40">
                      {imageFiles[name] ? "Replace" : "Upload"}
                      <input
                        type="file" accept="image/*" className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0]; if (!f) return;
                          const url = await toDataUrl(f);
                          setImageFiles((cur) => ({ ...cur, [name]: url }));
                        }}
                      />
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* SFX */}
          <Card className="p-4">
            <SectionHeader icon={<FileAudio className="size-4" />} title="SFX" />
            {scan.sfx.length === 0 ? (
              <Empty text="No SFX cues in script (use [name] at end of bubble)." />
            ) : (
              <ul className="flex flex-col gap-2">
                {scan.sfx.map((name) => (
                  <li key={name} className="flex items-center gap-2">
                    <span className="flex-1 truncate text-xs font-mono">{name}</span>
                    {sfxFiles[name] ? (
                      <audio src={sfxFiles[name]} controls className="h-8 w-32" />
                    ) : (
                      <span className="text-[10px] text-warning-foreground">missing</span>
                    )}
                    <label className="inline-flex cursor-pointer items-center rounded border px-2 py-1 text-xs hover:bg-accent/40">
                      {sfxFiles[name] ? "Replace" : "Upload"}
                      <input
                        type="file" accept="audio/*" className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0]; if (!f) return;
                          const url = await toDataUrl(f);
                          setSfxFiles((cur) => ({ ...cur, [name]: url }));
                        }}
                      />
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </main>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Render with warnings?</AlertDialogTitle>
            <AlertDialogDescription>
              {missingVoices.length ? <div>Missing voice IDs: {missingVoices.join(", ")}</div> : null}
              {missingImages.length ? <div>Missing images: {missingImages.join(", ")}</div> : null}
              {missingSfx.length ? <div>Missing SFX: {missingSfx.join(", ")}</div> : null}
              {apiKeyMissing ? <div>No TTS API key set.</div> : null}
              <div className="mt-2">The render will likely fail or skip those parts. Continue anyway?</div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Fix first</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmOpen(false); void doRender(); }}>
              Render anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-wide uppercase text-muted-foreground">
      {icon} {title}
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground">{text}</p>;
}
function StatusCard({ issueCount }: { issueCount: number }) {
  if (issueCount === 0) {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm flex items-center gap-2">
        <CheckCircle2 className="size-4 text-emerald-500" />
        Ready to render — all assets and voices are mapped.
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm flex items-center gap-2">
      <AlertTriangle className="size-4 text-warning-foreground" />
      {issueCount} item{issueCount > 1 ? "s" : ""} still need attention before rendering.
    </div>
  );
}
function WarningCard({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs flex items-center gap-2">
      <AlertTriangle className="size-4 text-warning-foreground" />
      {text}
    </div>
  );
}
function looksLikeId(s: string) { return /^[A-Za-z0-9_-]{12,}$/.test(s); }
function plural(n: number) { return n === 1 ? "" : "s"; }
function toDataUrl(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}
