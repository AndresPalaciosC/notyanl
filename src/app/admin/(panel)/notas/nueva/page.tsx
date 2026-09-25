import type { Metadata } from "next";
import NoteEditor, { type NoteFormValues } from "@/components/admin/NoteEditor";
import { isoToLocalInput, nowIso } from "@/lib/dates";
import { DEFAULT_CATEGORY } from "@/lib/config";
import { currentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Nueva nota" };

const EMPTY: NoteFormValues = {
  title: "",
  summary: "",
  bodyHtml: "",
  category: DEFAULT_CATEGORY,
  author: "",
  coverUrl: "",
  coverAlt: "",
  slug: "",
  status: "draft",
  featured: false,
  publishedAtLocal: "",
  sourceFile: null,
};

export default async function NewNotePage() {
  // La firma se propone sola con quien está redactando; se puede cambiar.
  const me = await currentUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-ink">Nueva nota</h1>
        <p className="mt-1 text-sm text-muted">
          Carga el documento, ajusta lo que haga falta en el editor y publica.
        </p>
      </div>

      <NoteEditor
        initial={{
          ...EMPTY,
          author: me?.name ?? "",
          publishedAtLocal: isoToLocalInput(nowIso()),
        }}
      />
    </div>
  );
}
