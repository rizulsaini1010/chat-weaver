import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Bubble, Contact, Settings } from "@/lib/script-types";
import { newBubble } from "@/lib/script-parser";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  GripVertical, Trash2, Plus, Type, Image as ImageIcon, Mic, Pause,
  CircleSlash, Megaphone,
} from "lucide-react";
import { ELEVENLABS_VOICES, AI33PRO_VOICES } from "@/lib/voices";

interface Props {
  contact: Contact;
  setContact: (c: Contact) => void;
  settings: Settings;
}

export function BubbleEditor({ contact, setContact, settings }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldI = contact.bubbles.findIndex((b) => b.id === active.id);
    const newI = contact.bubbles.findIndex((b) => b.id === over.id);
    setContact({ ...contact, bubbles: arrayMove(contact.bubbles, oldI, newI) });
  };

  const updateBubble = (id: string, patch: Partial<Bubble>) => {
    setContact({
      ...contact,
      bubbles: contact.bubbles.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    });
  };
  const remove = (id: string) =>
    setContact({ ...contact, bubbles: contact.bubbles.filter((b) => b.id !== id) });
  const add = (side: "me" | "them" = "me") =>
    setContact({ ...contact, bubbles: [...contact.bubbles, newBubble(side)] });

  return (
    <div className="flex flex-col gap-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={contact.bubbles.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {contact.bubbles.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No messages yet. Click “Add bubble” below.
              </p>
            ) : null}
            {contact.bubbles.map((b) => (
              <SortableBubble
                key={b.id}
                b={b}
                update={(p) => updateBubble(b.id, p)}
                remove={() => remove(b.id)}
                settings={settings}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => add("me")} size="sm"><Plus className="size-4" /> Me</Button>
        <Button onClick={() => add("them")} size="sm" variant="secondary"><Plus className="size-4" /> Them</Button>
      </div>
    </div>
  );
}

const KIND_ICONS = {
  text: Type, image: ImageIcon, audio: Mic, break: Pause, none: CircleSlash, promo: Megaphone,
} as const;

function SortableBubble({
  b, update, remove, settings,
}: {
  b: Bubble; update: (p: Partial<Bubble>) => void; remove: () => void; settings: Settings;
}) {
  const sortable = useSortable({ id: b.id });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };
  const voices = settings.ttsProvider === "elevenlabs"
    ? [...ELEVENLABS_VOICES, ...settings.customVoices]
    : [...AI33PRO_VOICES, ...settings.customVoices];

  return (
    <Card ref={sortable.setNodeRef} style={style} className="p-3">
      <div className="flex items-start gap-2">
        <button
          {...sortable.attributes} {...sortable.listeners}
          className="mt-1 cursor-grab touch-none text-muted-foreground hover:text-foreground"
        ><GripVertical className="size-4" /></button>

        <div className="flex-1 flex flex-col gap-2">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-md border bg-secondary/50 p-0.5">
              {(["me", "them"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => update({ side: s })}
                  className={`rounded px-2 py-0.5 text-xs font-medium transition ${
                    b.side === s ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground"
                  }`}
                >{s === "me" ? "Me" : "Them"}</button>
              ))}
            </div>

            <div className="flex rounded-md border bg-secondary/50 p-0.5">
              {(["text", "image", "audio", "break", "none", "promo"] as const).map((k) => {
                const Ic = KIND_ICONS[k];
                return (
                  <button
                    key={k}
                    onClick={() => update({ kind: k })}
                    title={k}
                    className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs transition ${
                      b.kind === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  ><Ic className="size-3.5" /><span className="hidden sm:inline">{k}</span></button>
                );
              })}
            </div>

            <Button variant="ghost" size="icon" className="ml-auto text-destructive" onClick={remove}>
              <Trash2 className="size-4" />
            </Button>
          </div>

          {/* Body per kind */}
          {b.kind === "text" || b.kind === "audio" ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <SpeakerSelect b={b} update={update} voices={voices} />
                <SfxSelect b={b} update={update} settings={settings} />
              </div>
              <Textarea
                value={b.text ?? ""}
                onChange={(e) => update({ text: e.target.value })}
                placeholder={b.kind === "audio" ? "Spoken only (no bubble)" : "Message text. Use {word} to blur."}
                rows={2}
              />
              <Input
                value={b.ttsOverride ?? ""}
                onChange={(e) => update({ ttsOverride: e.target.value })}
                placeholder="Optional TTS override (==)"
                className="h-8 text-xs"
              />
            </>
          ) : null}

          {b.kind === "image" ? (
            <div className="flex items-center gap-2">
              {b.imageData ? (
                <img src={b.imageData} alt="" className="size-12 rounded object-cover" />
              ) : null}
              <Input
                value={b.imageName ?? ""}
                onChange={(e) => update({ imageName: e.target.value })}
                placeholder="image filename e.g. photo.jpg"
              />
              <label className="cursor-pointer rounded border px-3 py-1.5 text-xs hover:bg-accent/40">
                Upload
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const r = new FileReader();
                    r.onload = () => update({ imageName: f.name, imageData: r.result as string });
                    r.readAsDataURL(f);
                  }}
                />
              </label>
            </div>
          ) : null}


          {b.kind === "break" ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Pause</span>
              <Input
                type="number" min={0.1} step={0.1}
                value={b.breakSeconds ?? 2}
                onChange={(e) => update({ breakSeconds: parseFloat(e.target.value) || 0 })}
                className="h-8 w-24"
              />
              <span className="text-xs text-muted-foreground">seconds</span>
            </div>
          ) : null}

          {b.kind === "none" ? (
            <p className="text-xs italic text-muted-foreground">No bubble, no TTS — pure spacer.</p>
          ) : null}

          {b.kind === "promo" ? (
            <PromoEditor b={b} update={update} voices={voices} />
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function SpeakerSelect({
  b, update, voices,
}: { b: Bubble; update: (p: Partial<Bubble>) => void; voices: { id: string; name: string }[] }) {
  return (
    <div className="flex gap-2">
      <Select
        value={b.speaker ?? "__custom"}
        onValueChange={(v) => update({ speaker: v === "__custom" ? (b.speaker ?? "") : v })}
      >
        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Speaker / voice" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__custom">Custom…</SelectItem>
          {voices.map((v) => <SelectItem key={v.id} value={v.name}>{v.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Input
        value={b.speaker ?? ""}
        onChange={(e) => update({ speaker: e.target.value })}
        placeholder="name or voice id"
        className="h-8 text-xs"
      />
    </div>
  );
}
function SfxSelect({
  b, update, settings,
}: { b: Bubble; update: (p: Partial<Bubble>) => void; settings: Settings }) {
  return (
    <Select
      value={b.sfx ?? "__none"}
      onValueChange={(v) => update({ sfx: v === "__none" ? undefined : v })}
    >
      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="SFX (none)" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__none">No SFX</SelectItem>
        {settings.sfxLibrary.map((s) => (
          <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function PromoEditor({
  b, update, voices,
}: { b: Bubble; update: (p: Partial<Bubble>) => void; voices: { id: string; name: string }[] }) {
  return (
    <div className="rounded-md border border-dashed bg-accent/20 p-2 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase text-muted-foreground">Promo</span>
        <div className="flex rounded-md border bg-background p-0.5">
          {(["plug", "rizz"] as const).map((k) => (
            <button key={k}
              onClick={() => update({ promoKind: k })}
              className={`rounded px-2 py-0.5 text-xs ${
                (b.promoKind ?? "plug") === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >{k === "plug" ? "Plug AI" : "Rizz"}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-2">
        <SpeakerInline label="Intro speaker" v={b.promoIntroSpeaker} onChange={(x) => update({ promoIntroSpeaker: x })} voices={voices} />
        <Input
          value={b.promoIntroText ?? ""}
          onChange={(e) => update({ promoIntroText: e.target.value })}
          placeholder="Intro TTS text"
          className="h-8"
        />
        <SpeakerInline label="Reply speaker" v={b.promoReplySpeaker} onChange={(x) => update({ promoReplySpeaker: x })} voices={voices} allowNone />
        <Input
          value={b.promoReplyText ?? ""}
          onChange={(e) => update({ promoReplyText: e.target.value })}
          placeholder="Reply TTS text"
          className="h-8"
        />
      </div>
    </div>
  );
}
function SpeakerInline({
  label, v, onChange, voices, allowNone,
}: {
  label: string; v?: string; onChange: (s: string) => void;
  voices: { id: string; name: string }[]; allowNone?: boolean;
}) {
  return (
    <Select value={v ?? (allowNone ? "none" : "__custom")} onValueChange={(x) => onChange(x)}>
      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={label} /></SelectTrigger>
      <SelectContent>
        {allowNone ? <SelectItem value="none">None (skip TTS)</SelectItem> : null}
        <SelectItem value="__custom">{label}</SelectItem>
        {voices.map((vo) => <SelectItem key={vo.id} value={vo.name}>{vo.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
