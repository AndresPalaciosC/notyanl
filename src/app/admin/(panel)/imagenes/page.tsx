import type { Metadata } from "next";
import { listMedia, mediaTotals } from "@/lib/repo/media";
import { formatDateTime } from "@/lib/dates";
import { deleteMediaAction } from "@/app/admin/actions";
import MediaUploadForm from "@/components/admin/MediaUploadForm";
import ConfirmButton from "@/components/admin/ConfirmButton";

export const metadata: Metadata = { title: "Imágenes" };
export const dynamic = "force-dynamic";

export default async function MediaPage() {
  const [items, totals] = await Promise.all([listMedia(undefined, 200), mediaTotals()]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-bold text-ink">Imágenes</h1>
        <p className="mt-1 text-sm text-muted">
          Todo lo que se ha subido: portadas, fotos dentro de las notas y banners.
          {totals.count > 0 && (
            <>
              {" "}
              {totals.count} {totals.count === 1 ? "archivo" : "archivos"} ·{" "}
              {formatBytes(totals.bytes)}
            </>
          )}
        </p>
      </div>

      <section className="rounded-lg border border-line bg-paper p-5">
        <h2 className="font-serif text-lg font-bold text-ink">Subir imágenes</h2>
        <p className="mt-1 mb-4 text-sm text-muted">
          Quedan disponibles para usarlas como portada o dentro de una nota.
        </p>
        <MediaUploadForm />
      </section>

      <section>
        <h2 className="mb-3 font-serif text-lg font-bold text-ink">
          Galería ({items.length})
        </h2>

        {items.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="overflow-hidden rounded-lg border border-line bg-paper"
              >
                <a href={item.url} target="_blank" rel="noopener">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.url}
                    alt=""
                    loading="lazy"
                    className="aspect-[3/2] w-full bg-surface object-cover"
                  />
                </a>

                <div className="space-y-1.5 p-3">
                  <p className="truncate font-mono text-xs text-ink" title={item.key}>
                    {item.key.split("/").pop()}
                  </p>
                  <p className="text-xs text-muted">
                    {item.width && item.height
                      ? `${item.width} × ${item.height} · `
                      : ""}
                    {formatBytes(item.size)} · {kindLabel(item.kind)}
                  </p>
                  <p className="text-xs text-muted">{formatDateTime(item.createdAt)}</p>

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener"
                      className="text-ink-soft hover:text-accent"
                    >
                      Ver ↗
                    </a>
                    <ConfirmButton
                      action={deleteMediaAction}
                      fields={{ key: item.key }}
                      confirm={
                        "¿Eliminar esta imagen?\n\n" +
                        "Si alguna nota o banner la está usando, ahí se verá rota. " +
                        "No se puede deshacer."
                      }
                      label="Eliminar"
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-line bg-paper px-6 py-14 text-center text-sm text-muted">
            Todavía no hay imágenes subidas.
          </p>
        )}
      </section>
    </div>
  );
}

function kindLabel(kind: string): string {
  if (kind === "cover") return "portada";
  if (kind === "banner") return "publicidad";
  return "nota";
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}
