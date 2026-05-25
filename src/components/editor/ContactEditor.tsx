import { useState } from "react";
import type { Contact } from "@/lib/script-types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, UserCircle2 } from "lucide-react";
import { newContact } from "@/lib/script-parser";

interface Props {
  contacts: Contact[];
  setContacts: (cs: Contact[]) => void;
  activeId: string;
  setActiveId: (id: string) => void;
}

export function ContactList({ contacts, setContacts, activeId, setActiveId }: Props) {
  return (
    <Card className="p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Contacts</h3>
        <Button
          size="sm" variant="ghost"
          onClick={() => {
            const c = newContact(`Contact ${contacts.length + 1}`);
            setContacts([...contacts, c]);
            setActiveId(c.id);
          }}
        ><Plus className="size-4" /></Button>
      </div>
      <ul className="flex flex-col gap-1">
        {contacts.map((c) => (
          <li key={c.id}>
            <button
              onClick={() => setActiveId(c.id)}
              className={`w-full text-left flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition ${
                c.id === activeId ? "bg-primary text-primary-foreground" : "hover:bg-accent/50"
              }`}
            >
              <UserCircle2 className="size-4 opacity-70" />
              <span className="flex-1 truncate">{c.name}</span>
              <span className="text-[10px] opacity-60">{c.bubbles.length}</span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function ContactHeaderEditor({
  contact, setContact, onDelete,
}: { contact: Contact; setContact: (c: Contact) => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Contact</h3>
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="text-destructive">
              <Trash2 className="size-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete contact?</AlertDialogTitle>
              <AlertDialogDescription>
                This will delete the entire conversation for “{contact.name}”. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Name</label>
          <Input value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Unread count</label>
          <Input
            type="number" min={0}
            value={contact.unread ?? 0}
            onChange={(e) => setContact({ ...contact, unread: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div className="sm:col-span-2 flex items-center gap-3">
          <div className="size-12 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
            {contact.avatarData ? (
              <img src={contact.avatarData} alt="" className="size-12 object-cover" />
            ) : contact.avatar ? (
              <span className="text-[10px] p-1 text-muted-foreground text-center">{contact.avatar}</span>
            ) : (
              <UserCircle2 className="size-8 text-muted-foreground" />
            )}
          </div>
          <label className="cursor-pointer rounded border px-3 py-1.5 text-xs hover:bg-accent/40">
            Upload avatar
            <input type="file" accept="image/*" className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const r = new FileReader();
                r.onload = () => setContact({ ...contact, avatar: f.name, avatarData: r.result as string });
                r.readAsDataURL(f);
              }}
            />
          </label>
          {contact.avatar || contact.avatarData ? (
            <Button variant="ghost" size="sm" onClick={() => setContact({ ...contact, avatar: undefined, avatarData: undefined })}>
              Remove
            </Button>
          ) : null}
        </div>

      </div>
    </Card>
  );
}
