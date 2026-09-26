import type { Metadata } from "next";
import Link from "next/link";
import { bannerStats } from "@/lib/repo/banners";
import { listForAdmin, statusCounts } from "@/lib/repo/notes";
import { mediaTotals } from "@/lib/repo/media";
import { formatDateTime, relativeTime } from "@/lib/dates";
import { getCategory } from "@/lib/config";

export const metadata: Metadata = { title: "Resumen" };

export default async function AdminHome() {
  const notes = await statusCounts();
  const banners = await bannerStats();
  const media = await mediaTotals();
  const latest = await listForAdmin({ limit: 6 });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-bold text-ink">Resumen</h1>
        <p className="mt-1 text-sm text-muted">
          Estado del sitio y accesos rápidos a lo que se usa todos los días.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Notas publicadas" value={notes.published} />
        <Stat label="Borradores" value={notes.draft} />
        <Stat label="Banners activos" value={`${banners.active} / ${banners.total}`} />
        <Stat label="Archivos subidos" value={media.count} hint={formatBytes(media.bytes)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ActionCard
          href="/admin/notas/nueva"
          title="Cargar un documento"
          description="Sube un Word o PDF, revísalo en el editor y publícalo."
        />
        <ActionCard
          href="/admin/banners"
          title="Administrar publicidad"
          description="Agrega, desactiva o elimina banners y ajusta dónde aparecen."
        />
      </div>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-serif text-lg font-bold text-ink">Movimiento reciente</h2>
          <Link href="/admin/notas" className="text-xs text-accent hover:underline">
            Ver todas las notas
          </Link>
        </div>

        {latest.length ? (
          <ul className="divide-y divide-line rounded-lg border border-line bg-paper">
            {latest.map((note) => (
              <li key={note.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/admin/notas/${note.id}`}
                    className="block truncate text-sm font-medium text-ink hover:text-accent"
                  >
                    {note.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-muted">
                    {getCategory(note.category).label} · actualizada{" "}
                    {relativeTime(note.updatedAt)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    note.status === "published"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-surface-strong text-ink-soft"
                  }`}
                >
                  {note.status === "published" ? "Publicada" : "Borrador"}
                </span>
                <span className="hidden shrink-0 text-xs text-muted sm:block">
                  {formatDateTime(note.publishedAt ?? note.updatedAt)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-line bg-paper px-6 py-12 text-center text-sm text-muted">
            Todavía no hay notas.{" "}
            <Link href="/admin/notas/nueva" className="text-accent hover:underline">
              Carga la primera
            </Link>
            .
          </p>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-paper p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 font-serif text-3xl font-bold text-ink">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

function ActionCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-lg border border-line bg-paper p-5 transition-colors hover:border-accent"
    >
      <p className="font-serif text-lg font-bold text-ink group-hover:text-accent">
        {title} →
      </p>
      <p className="mt-1 text-sm text-muted">{description}</p>
    </Link>
  );
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}
