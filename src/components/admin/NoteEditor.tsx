"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import RichText, { type RichTextHandle } from "./RichText";
import DocumentImport from "./DocumentImport";
import { deleteNoteAction, saveNoteAction, uploadImageAction } from "@/app/admin/actions";
import type { ImportResult } from "@/lib/importers/shared";
import { CATEGORIES } from "@/lib/config";
import { slugify } from "@/lib/slug";

export type NoteFormValues = {
  id?: number;
  title: string;
  summary: string;
  bodyHtml: string;
  category: string;
  author: string;
  coverUrl: string;
  coverAlt: string;
  slug: string;
  status: "draft" | "published";
  featured: boolean;
  publishedAtLocal: string;
  sourceFile: string | null;
};

export default function NoteEditor({ initial }: { initial: NoteFormValues }) {
  const router = useRouter();
  const editorRef = useRef<RichTextHandle>(null);
  const [pending, startTransition] = useTransition();

  const [values, setValues] = useState<NoteFormValues>(initial);
  const [dirty, setDirty] = useState(false);
  const [feedback, setFeedback] = useState<
    { kind: "ok" | "error"; text: string } | null
  >(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  // El slug se sigue del título hasta que alguien lo escribe a mano.
  const [slugLocked, setSlugLocked] = useState(Boolean(initial.slug));

  const patch = useCallback(<K extends keyof NoteFormValues>(
    key: K,
    value: NoteFormValues[K],
  ) => {
    setValues((previous) => ({ ...previous, [key]: value }));
    setDirty(true);
  }, []);

  // Aviso del navegador si se intenta salir con cambios sin guardar.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const handleImported = useCallback(
    (result: ImportResult) => {
      editorRef.current?.setHtml(result.html);
      setValues((previous) => ({
        ...previous,
        title: previous.title.trim() ? previous.title : result.title,
        bodyHtml: result.html,
        sourceFile: result.sourceFile,
        coverUrl: previous.coverUrl || firstImage(result.html) || "",
      }));
      setDirty(true);
    },
    [],
  );

  const uploadCover = useCallback(async (file: File) => {
    setUploadingCover(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", "cover");

      const response = await uploadImageAction(formData);
      if (response.ok) {
        patch("coverUrl", response.url);
      } else {
        setFeedback({ kind: "error", text: response.error });
      }
    } finally {
      setUploadingCover(false);
    }
  }, [patch]);

  const uploadInline = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await uploadImageAction(formData);
    if (response.ok) return response.url;

    setFeedback({ kind: "error", text: response.error });
    return null;
  }, []);

  const save = useCallback(
    (status?: "draft" | "published") => {
      const bodyHtml = editorRef.current?.getHtml() ?? values.bodyHtml;
      const nextStatus = status ?? values.status;
      const slug = values.slug.trim() || slugify(values.title);

      setFeedback(null);

      startTransition(async () => {
        const response = await saveNoteAction({
          ...values,
          bodyHtml,
          slug,
          status: nextStatus,
        });

        if (!response.ok) {
          setFeedback({ kind: "error", text: response.error });
          return;
        }

        setValues((previous) => ({
          ...previous,
          id: response.id,
          slug: response.slug,
          status: nextStatus,
          bodyHtml,
        }));
        setDirty(false);
        setSlugLocked(true);
        setFeedback({
          kind: "ok",
          text: nextStatus === "published" ? "Nota publicada." : "Borrador guardado.",
        });

        if (!values.id) {
          router.replace(`/admin/notas/${response.id}`);
        } else {
          router.refresh();
        }
      });
    },
    [router, values],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-5">
        <DocumentImport
          onImported={handleImported}
          hasContent={Boolean(values.bodyHtml.trim())}
        />

        <div>
          <label htmlFor="title" className="sr-only">
            Título de la nota
          </label>
          <input
            id="title"
            value={values.title}
            onChange={(event) => {
              const title = event.target.value;
              setValues((previous) => ({
                ...previous,
                title,
                slug: slugLocked ? previous.slug : slugify(title),
              }));
              setDirty(true);
            }}
            placeholder="Título de la nota"
            className="w-full rounded-lg border border-line bg-paper px-4 py-3 font-serif text-2xl leading-tight text-ink outline-none focus:border-accent"
          />
        </div>

        <div>
          <label
            htmlFor="summary"
            className="block text-xs font-medium uppercase tracking-wider text-muted"
          >
            Entrada / resumen
          </label>
          <textarea
            id="summary"
            value={values.summary}
            onChange={(event) => patch("summary", event.target.value)}
            rows={2}
            placeholder="Se genera solo a partir del cuerpo si lo dejas vacío."
            className="mt-1.5 w-full resize-y rounded-lg border border-line bg-paper px-4 py-3 text-sm leading-relaxed outline-none focus:border-accent"
          />
        </div>

        <RichText
          ref={editorRef}
          initialHtml={initial.bodyHtml}
          onChange={(html) => {
            setValues((previous) => ({ ...previous, bodyHtml: html }));
            setDirty(true);
          }}
          onUploadImage={uploadInline}
        />
      </div>

      <aside className="space-y-5">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Publicación</h2>
            <StatusPill status={values.status} dirty={dirty} />
          </div>

          {feedback && (
            <p
              className={`mt-3 rounded px-3 py-2 text-sm ${
                feedback.kind === "ok"
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-accent-soft text-accent-dark"
              }`}
            >
              {feedback.text}
            </p>
          )}

          <Field label="Fecha de publicación" htmlFor="publishedAt">
            <input
              id="publishedAt"
              type="datetime-local"
              value={values.publishedAtLocal}
              onChange={(event) => patch("publishedAtLocal", event.target.value)}
              className={inputClass}
            />
            <p className="mt-1 text-[11px] text-muted">
              Una fecha futura mantiene la nota oculta hasta ese momento.
            </p>
          </Field>

          <label className="mt-4 flex items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={values.featured}
              onChange={(event) => patch("featured", event.target.checked)}
              className="size-4 accent-[#b3121b]"
            />
            Destacar en la portada
          </label>

          <div className="mt-5 space-y-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => save("published")}
              className="w-full rounded bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-60"
            >
              {pending ? "Guardando…" : values.status === "published" ? "Actualizar nota publicada" : "Publicar"}
            </button>

            <button
              type="button"
              disabled={pending}
              onClick={() => save("draft")}
              className="w-full rounded border border-line px-4 py-2.5 text-sm font-medium text-ink-soft hover:border-ink hover:text-ink disabled:opacity-60"
            >
              Guardar como borrador
            </button>

            {values.id && values.status === "published" && (
              <Link
                href={`/nota/${values.slug}`}
                target="_blank"
                className="block pt-1 text-center text-xs text-accent hover:underline"
              >
                Ver nota en el sitio ↗
              </Link>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-ink">Clasificación</h2>

          <Field label="Sección" htmlFor="category">
            <select
              id="category"
              value={values.category}
              onChange={(event) => patch("category", event.target.value)}
              className={inputClass}
            >
              {CATEGORIES.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Autor" htmlFor="author">
            <input
              id="author"
              value={values.author}
              onChange={(event) => patch("author", event.target.value)}
              placeholder="Nombre de quien firma"
              className={inputClass}
            />
          </Field>

          <Field label="Dirección web (slug)" htmlFor="slug">
            <input
              id="slug"
              value={values.slug}
              onChange={(event) => {
                setSlugLocked(true);
                patch("slug", event.target.value);
              }}
              className={`${inputClass} font-mono text-xs`}
            />
            <p className="mt-1 truncate text-[11px] text-muted">
              /nota/{values.slug || "…"}
            </p>
          </Field>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-ink">Imagen de portada</h2>

          {values.coverUrl ? (
            <div className="mt-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={values.coverUrl}
                alt=""
                className="aspect-[16/9] w-full rounded border border-line object-cover"
              />
              <button
                type="button"
                onClick={() => patch("coverUrl", "")}
                className="mt-2 text-xs text-accent hover:underline"
              >
                Quitar portada
              </button>
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted">
              Sin portada. Las notas sin imagen muestran un bloque con la inicial del
              título.
            </p>
          )}

          <label className="mt-3 block">
            <span className="sr-only">Subir portada</span>
            <input
              type="file"
              accept="image/*"
              disabled={uploadingCover}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void uploadCover(file);
              }}
              className="block w-full text-xs text-muted file:mr-3 file:rounded file:border-0 file:bg-surface-strong file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink hover:file:bg-line"
            />
          </label>

          <button
            type="button"
            onClick={() => {
              const found = firstImage(editorRef.current?.getHtml() ?? "");
              if (found) patch("coverUrl", found);
              else setFeedback({ kind: "error", text: "El cuerpo no tiene imágenes." });
            }}
            className="mt-2 text-xs text-accent hover:underline"
          >
            Usar la primera imagen del cuerpo
          </button>

          <Field label="Pie de foto" htmlFor="coverAlt">
            <input
              id="coverAlt"
              value={values.coverAlt}
              onChange={(event) => patch("coverAlt", event.target.value)}
              placeholder="Describe la imagen"
              className={inputClass}
            />
          </Field>
        </Card>

        {values.id && (
          <Card>
            <h2 className="text-sm font-semibold text-ink">Eliminar</h2>
            <p className="mt-1 text-xs text-muted">
              Se borra la nota de forma permanente. Las imágenes subidas se conservan.
            </p>
            <form action={deleteNoteAction} className="mt-3">
              <input type="hidden" name="id" value={values.id} />
              <button
                type="submit"
                onClick={(event) => {
                  if (!window.confirm("¿Eliminar esta nota definitivamente?")) {
                    event.preventDefault();
                  }
                }}
                className="w-full rounded border border-accent px-4 py-2 text-sm font-medium text-accent hover:bg-accent hover:text-white"
              >
                Eliminar nota
              </button>
            </form>
          </Card>
        )}

        {values.sourceFile && (
          <p className="text-xs text-muted">
            Importada de <span className="font-medium">{values.sourceFile}</span>
          </p>
        )}
      </aside>
    </div>
  );
}

const inputClass =
  "w-full rounded border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-paper p-4">{children}</section>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <label
        htmlFor={htmlFor}
        className="block text-xs font-medium uppercase tracking-wider text-muted"
      >
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function StatusPill({ status, dirty }: { status: string; dirty: boolean }) {
  if (dirty) {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
        Sin guardar
      </span>
    );
  }

  return status === "published" ? (
    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
      Publicada
    </span>
  ) : (
    <span className="rounded-full bg-surface-strong px-2 py-0.5 text-[11px] font-medium text-ink-soft">
      Borrador
    </span>
  );
}

/** Primera imagen del cuerpo, candidata a portada. */
function firstImage(html: string): string | null {
  const match = /<img[^>]+src\s*=\s*["']([^"']+)["']/i.exec(html);
  return match ? match[1] : null;
}
