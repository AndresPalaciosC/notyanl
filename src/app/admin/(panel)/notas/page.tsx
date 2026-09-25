import type { Metadata } from "next";
import Link from "next/link";
import { CATEGORIES, getCategory } from "@/lib/config";
import { formatDateTime } from "@/lib/dates";
import { listForAdmin, type NoteStatus } from "@/lib/repo/notes";
import { setNoteStatusAction, toggleFeaturedAction } from "@/app/admin/actions";

export const metadata: Metadata = { title: "Notas" };
export const dynamic = "force-dynamic";

const PER_PAGE = 30;

type Props = {
  searchParams: Promise<{ estado?: string; seccion?: string; q?: string; p?: string }>;
};

export default async function NotesListPage({ searchParams }: Props) {
  const { estado, seccion, q, p } = await searchParams;

  const status: NoteStatus | "all" =
    estado === "published" || estado === "draft" ? estado : "all";
  const page = Math.max(1, Number(p) || 1);

  const notes = listForAdmin({
    status,
    category: seccion,
    query: q,
    limit: PER_PAGE + 1,
    offset: (page - 1) * PER_PAGE,
  });

  const hasNext = notes.length > PER_PAGE;
  const visible = notes.slice(0, PER_PAGE);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold text-ink">Notas</h1>
          <p className="mt-1 text-sm text-muted">
            Edita, publica, destaca o elimina lo que ya está cargado.
          </p>
        </div>
        <Link
          href="/admin/notas/nueva"
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark"
        >
          + Nueva nota
        </Link>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-paper p-4">
        <label className="flex-1 min-w-[12rem]">
          <span className="block text-xs font-medium uppercase tracking-wider text-muted">
            Buscar
          </span>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Título o texto de la nota"
            className="mt-1 w-full rounded border border-line px-3 py-1.5 text-sm outline-none focus:border-accent"
          />
        </label>

        <label>
          <span className="block text-xs font-medium uppercase tracking-wider text-muted">
            Estado
          </span>
          <select
            name="estado"
            defaultValue={estado ?? ""}
            className="mt-1 rounded border border-line px-3 py-1.5 text-sm outline-none focus:border-accent"
          >
            <option value="">Todos</option>
            <option value="published">Publicadas</option>
            <option value="draft">Borradores</option>
          </select>
        </label>

        <label>
          <span className="block text-xs font-medium uppercase tracking-wider text-muted">
            Sección
          </span>
          <select
            name="seccion"
            defaultValue={seccion ?? ""}
            className="mt-1 rounded border border-line px-3 py-1.5 text-sm outline-none focus:border-accent"
          >
            <option value="">Todas</option>
            {CATEGORIES.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          className="rounded border border-ink px-4 py-1.5 text-sm font-medium text-ink hover:bg-ink hover:text-white"
        >
          Filtrar
        </button>
      </form>

      {visible.length ? (
        <div className="overflow-x-auto rounded-lg border border-line bg-paper">
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-4 py-2.5 font-medium">Nota</th>
                <th className="px-4 py-2.5 font-medium">Sección</th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5 font-medium">Fecha</th>
                <th className="px-4 py-2.5 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map((note) => (
                <tr key={note.id} className="align-middle">
                  <td className="max-w-md px-4 py-3">
                    <Link
                      href={`/admin/notas/${note.id}`}
                      className="font-medium text-ink hover:text-accent"
                    >
                      {note.title}
                    </Link>
                    {note.featured && (
                      <span className="ml-2 rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent-dark">
                        Destacada
                      </span>
                    )}
                    <p className="mt-0.5 truncate text-xs text-muted">
                      /nota/{note.slug}
                    </p>
                  </td>

                  <td className="px-4 py-3 text-ink-soft">
                    {getCategory(note.category).label}
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        note.status === "published"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-surface-strong text-ink-soft"
                      }`}
                    >
                      {note.status === "published" ? "Publicada" : "Borrador"}
                    </span>
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">
                    {formatDateTime(note.publishedAt ?? note.updatedAt)}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Link
                        href={`/admin/notas/${note.id}`}
                        className="text-accent hover:underline"
                      >
                        Editar
                      </Link>

                      <form action={setNoteStatusAction}>
                        <input type="hidden" name="id" value={note.id} />
                        <input
                          type="hidden"
                          name="status"
                          value={note.status === "published" ? "draft" : "published"}
                        />
                        <button type="submit" className="text-ink-soft hover:text-ink">
                          {note.status === "published" ? "Despublicar" : "Publicar"}
                        </button>
                      </form>

                      <form action={toggleFeaturedAction}>
                        <input type="hidden" name="id" value={note.id} />
                        <button type="submit" className="text-ink-soft hover:text-ink">
                          {note.featured ? "Quitar destaque" : "Destacar"}
                        </button>
                      </form>

                      {note.status === "published" && (
                        <Link
                          href={`/nota/${note.slug}`}
                          target="_blank"
                          className="text-muted hover:text-ink"
                        >
                          Ver ↗
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-line bg-paper px-6 py-14 text-center text-sm text-muted">
          No hay notas que coincidan con el filtro.
        </p>
      )}

      {(page > 1 || hasNext) && (
        <nav className="flex items-center justify-between text-sm">
          {page > 1 ? (
            <Link
              href={buildHref({ estado, seccion, q, p: page - 1 })}
              className="text-accent hover:underline"
            >
              ← Anteriores
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">Página {page}</span>
          {hasNext ? (
            <Link
              href={buildHref({ estado, seccion, q, p: page + 1 })}
              className="text-accent hover:underline"
            >
              Siguientes →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}

function buildHref(params: {
  estado?: string;
  seccion?: string;
  q?: string;
  p: number;
}): string {
  const search = new URLSearchParams();
  if (params.estado) search.set("estado", params.estado);
  if (params.seccion) search.set("seccion", params.seccion);
  if (params.q) search.set("q", params.q);
  search.set("p", String(params.p));
  return `/admin/notas?${search.toString()}`;
}
