import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import {
  Download, FileCode, Loader2, MessageSquare, Play, Settings as SettingsIcon, Upload,
} from "lucide-react";

import {
  defaultSettings, loadState, saveState,
} from "@/lib/store";
import type { Contact, Settings } from "@/lib/script-types";
import { newContact, parseScript, serializeScript } from "@/lib/script-parser";
import { ContactList, ContactHeaderEditor } from "@/components/editor/ContactEditor";
import { BubbleEditor } from "@/components/editor/BubbleEditor";
import { SettingsPanel } from "@/components/editor/SettingsPanel";
import { Warnings } from "@/components/editor/Warnings";

export const Route = createFileRoute("/")({
  component: App,
  head: () => ({
    meta: [
      { title: "Cyno Script Editor — Visual iMessage chat builder" },
      { name: "description", content: "Visual editor for iMessage-style chat scripts with TTS, SFX, contacts, promos and reveal animations." },
    ],
  }),
});

function App() {
  const [contacts, setContacts] = useState<Contact[]>([newContact("John")]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [activeId, setActiveId] = useState<string>("");
  const [rawDirty, setRawDirty] = useState(false);
  const [rawText, setRawText] = useState("");
  const [rendering, setRendering] = useState(false);


  // load
  useEffect(() => {
    const s = loadState();
    if (s) {
      setContacts(s.contacts);
      setSettings({ ...defaultSettings, ...s.settings });
      setActiveId(s.contacts[0]?.id ?? "");
    } else {
      setActiveId(contacts[0]?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // persist
  useEffect(() => { saveState({ contacts, settings }); }, [contacts, settings]);

  // serialize when not dirty
  useEffect(() => {
    if (!rawDirty) setRawText(serializeScript(contacts, settings));
  }, [contacts, settings, rawDirty]);

  const active = useMemo(
    () => contacts.find((c) => c.id === activeId) ?? contacts[0],
    [contacts, activeId],
  );

  const updateActive = (c: Contact) =>
    setContacts(contacts.map((x) => (x.id === c.id ? c : x)));
  const deleteActive = () => {
    const left = contacts.filter((c) => c.id !== active?.id);
    setContacts(left.length ? left : [newContact("Contact")]);
    setActiveId(left[0]?.id ?? "");
    toast.success("Contact deleted");
  };

  const applyRaw = () => {
    const parsed = parseScript(rawText);
    setContacts(parsed.contacts);
    if (parsed.global.CR != null) setSettings({ ...settings, cornerRadius: parsed.global.CR });
    setActiveId(parsed.contacts[0]?.id ?? "");
    setRawDirty(false);
    toast.success("Script applied to visual editor");
  };

  const onUpload = async (f: File) => {
    const txt = await f.text();
    setRawText(txt);
    const parsed = parseScript(txt);
    setContacts(parsed.contacts);
    setActiveId(parsed.contacts[0]?.id ?? "");
    if (parsed.global.CR != null) setSettings({ ...settings, cornerRadius: parsed.global.CR });
    toast.success(`Imported ${f.name}`);
  };

  const download = () => {
    const txt = serializeScript(contacts, settings);
    const blob = new Blob([txt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "script.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const collectAssets = (): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const c of contacts) {
      if (c.avatar && c.avatar.startsWith("data:")) out[`${c.id}_avatar`] = c.avatar;
      for (const b of c.bubbles) {
        if (b.imageName && (b as unknown as { imageData?: string }).imageData?.startsWith("data:")) {
          out[b.imageName] = (b as unknown as { imageData: string }).imageData;
        }
      }
    }
    for (const s of settings.sfxLibrary) {
      if (s.dataUrl) out[`${s.name}.mp3`] = s.dataUrl;
    }
    return out;
  };

  const render = async () => {
    if (rendering) return;
    const url = (settings.backendUrl || "").replace(/\/$/, "");
    if (!url) { toast.error("Set the render backend URL in Settings"); return; }
    setRendering(true);
    const t = toast.loading("Rendering video — this can take a while…");
    try {
      const apiKey = settings.ttsProvider === "elevenlabs" ? settings.elevenlabsApiKey : settings.ai33proApiKey;
      const res = await fetch(`${url}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: serializeScript(contacts, settings),
          settings,
          assets: collectAssets(),
          apiKey,
          ttsProvider: settings.ttsProvider,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "cyno-output.mp4";
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("Video ready", { id: t });
    } catch (e) {
      toast.error(`Render failed: ${(e as Error).message}`, { id: t });
    } finally {
      setRendering(false);
    }
  };


  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster richColors position="top-right" />
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-gradient-to-br from-imessage-blue to-primary shadow" />
            <h1 className="text-base font-bold tracking-tight">Cyno Script Editor</h1>
          </div>
          <span className="hidden sm:inline text-xs text-muted-foreground">Visual iMessage chat builder</span>
          <div className="ml-auto flex items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-accent/50">
              <Upload className="size-4" /> Import script
              <input type="file" accept=".txt,.md" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); }}
              />
            </label>
            <Button size="sm" variant="outline" onClick={download}>
              <Download className="size-4" /> Download .txt
            </Button>
            <Button size="sm" onClick={render} disabled={rendering}>
              {rendering ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              {rendering ? "Rendering…" : "Render video"}
            </Button>

            <Sheet>
              <SheetTrigger asChild>
                <Button size="sm" variant="outline" className="lg:hidden">
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

      <main className="mx-auto grid max-w-[1600px] gap-4 px-4 py-6 lg:grid-cols-[260px_1fr_360px]">
        {/* Left: contacts */}
        <aside className="lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)] flex flex-col gap-3 overflow-auto">
          <ContactList contacts={contacts} setContacts={setContacts} activeId={active?.id ?? ""} setActiveId={setActiveId} />
        </aside>

        {/* Center: editor */}
        <section className="flex flex-col gap-4 min-w-0">
          <Warnings contacts={contacts} settings={settings} />
          <Tabs defaultValue="visual">
            <TabsList>
              <TabsTrigger value="visual"><MessageSquare className="size-4" /> Visual</TabsTrigger>
              <TabsTrigger value="raw" onClick={() => setRawText(serializeScript(contacts, settings))}>
                <FileCode className="size-4" /> Raw script
              </TabsTrigger>
            </TabsList>
            <TabsContent value="visual" className="space-y-4">
              {active ? (
                <>
                  <ContactHeaderEditor contact={active} setContact={updateActive} onDelete={deleteActive} />
                  <BubbleEditor contact={active} setContact={updateActive} settings={settings} />
                </>
              ) : null}
            </TabsContent>
            <TabsContent value="raw" className="space-y-3">
              <Textarea
                value={rawText}
                onChange={(e) => { setRawText(e.target.value); setRawDirty(true); }}
                className="min-h-[60vh] font-mono text-xs"
                spellCheck={false}
              />
              <div className="flex items-center gap-2">
                <Button onClick={applyRaw} disabled={!rawDirty}>Apply to visual editor</Button>
                {rawDirty ? (
                  <span className="text-xs text-muted-foreground">Unsaved changes in raw text.</span>
                ) : (
                  <span className="text-xs text-muted-foreground">Synced.</span>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </section>

        {/* Right: settings */}
        <aside className="hidden lg:flex lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] flex-col gap-3 overflow-auto pr-1">
          <SettingsPanel settings={settings} setSettings={setSettings} />
        </aside>
      </main>
    </div>
  );
}
