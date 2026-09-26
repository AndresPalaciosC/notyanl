import type { Metadata } from "next";
import { notFound } from "next/navigation";
import NoteEditor, { type NoteFormValues } from "@/components/admin/NoteEditor";
import { isoToLocalInput } from "@/lib/dates";
import { getById } from "@/lib/repo/notes";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const note = await getById(Number(id));
  return { title: note ? `Editar: ${note.title}` : "Nota no encontrada" };
}

export default async function EditNotePage({ params }: Props) {
  const { id } = await params;
  const note = await getById(Number(id));
  if (!note) notFound();

  const initial: NoteFormValues = {
    id: note.id,
    title: note.title,
    summary: note.summary,
    bodyHtml: note.bodyHtml,
    category: note.category,
    author: note.author,
    coverUrl: note.coverUrl ?? "",
    coverAlt: note.coverAlt,
    slug: note.slug,
    status: note.status,
    featured: note.featured,
    publishedAtLocal: isoToLocalInput(note.publishedAt),
    sourceFile: note.sourceFile,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-ink">Editar nota</h1>
        <p className="mt-1 text-sm text-muted">
          Puedes reemplazar el cuerpo cargando otro documento sin perder el resto de
          los datos.
        </p>
      </div>

      <NoteEditor initial={initial} />
    </div>
  );
}
