import type { Metadata } from "next";
import Link from "next/link";
import { bannerPositionLabel, getCategory } from "@/lib/config";
import { dayInSiteZone, lastDays } from "@/lib/dates";
import * as stats from "@/lib/repo/stats";
import { listBanners } from "@/lib/repo/banners";
import { listForAdmin } from "@/lib/repo/notes";

export const metadata: Metadata = { title: "Estadísticas" };
export const dynamic = "force-dynamic";

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type Props = { searchParams: Promise<{ desde?: string; hasta?: string }> };

export default async function StatsPage({ searchParams }: Props) {
  const { desde, hasta } = await searchParams;
  const fallback = lastDays(30);

  const from = DAY_PATTERN.test(desde ?? "") ? desde! : fallback.from;
  const to = DAY_PATTERN.test(hasta ?? "") ? hasta! : dayInSiteZone();
  const range = from <= to ? { from, to } : { from: to, to: from };

  const visits = await stats.total("visit", range);
  const pageviews = await stats.total("pageview", range);
  const series = await stats.series("visit", range);
  const peak = Math.max(1, ...series.map((point) => point.count));

  const readsByNote = await stats.totalsByRef("note", range);
  const viewsByBanner = await stats.totalsByRef("banner_view", range);
  const clicksByBanner = await stats.totalsByRef("banner_click", range);

  const notes = await listForAdmin({ status: "published", limit: 500 });
  const topNotes = notes
    .map((note) => ({ note, reads: readsByNote.get(String(note.id)) ?? 0 }))
    .sort((a, b) => b.reads - a.reads)
    .slice(0, 10);

  const banners = (await listBanners())
    .map((banner) => {
      const views = viewsByBanner.get(String(banner.id)) ?? 0;
      const clicks = clicksByBanner.get(String(banner.id)) ?? 0;
      return { banner, views, clicks, ctr: views ? (clicks / views) * 100 : 0 };
    })
    .sort((a, b) => b.views - a.views);

  const totalViews = banners.reduce((acc, row) => acc + row.views, 0);
  const totalClicks = banners.reduce((acc, row) => acc + row.clicks, 0);

  const exportHref = `/admin/exportar?desde=${range.from}&hasta=${range.to}`;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-ink">Estadísticas</h1>
          <p className="mt-1 text-sm text-muted">
            Se cuentan desde el navegador del lector: los rastreadores no inflan las
            cifras y un banner sólo suma vista cuando aparece en pantalla.
          </p>
        </div>

        <a
          href={exportHref}
          className="rounded bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
        >
          ↓ Descargar Excel
        </a>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-paper p-4">
        <label>
          <span className="block text-xs font-medium uppercase tracking-wider text-muted">
            Desde
          </span>
          <input
            type="date"
            name="desde"
            defaultValue={range.from}
            className="mt-1 rounded border border-line px-3 py-1.5 text-sm outline-none focus:border-accent"
          />
        </label>
        <label>
          <span className="block text-xs font-medium uppercase tracking-wider text-muted">
            Hasta
          </span>
          <input
            type="date"
            name="hasta"
            defaultValue={range.to}
            className="mt-1 rounded border border-line px-3 py-1.5 text-sm outline-none focus:border-accent"
          />
        </label>
        <button
          type="submit"
          className="rounded border border-ink px-4 py-1.5 text-sm font-medium text-ink hover:bg-ink hover:text-white"
        >
          Aplicar
        </button>
        <Link href="/admin/estadisticas" className="text-xs text-muted hover:text-accent">
          Últimos 30 días
        </Link>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Visitas" value={visits} />
        <Stat label="Páginas vistas" value={pageviews} />
        <Stat
          label="Páginas por visita"
          value={visits ? (pageviews / visits).toFixed(2) : "0"}
        />
        <Stat
          label="CTR de publicidad"
          value={totalViews ? `${((totalClicks / totalViews) * 100).toFixed(2)}%` : "0%"}
          hint={`${totalViews.toLocaleString("es-MX")} vistas · ${totalClicks.toLocaleString("es-MX")} clics`}
        />
      </div>

      <section className="rounded-lg border border-line bg-paper p-5">
        <h2 className="font-serif text-lg font-bold text-ink">Visitas por día</h2>

        {/* Las columnas necesitan `items-stretch`: con `items-end` colapsan a
            altura cero y el alto en % de las barras no resuelve contra nada. */}
        {series.some((point) => point.count > 0) ? (
          <div className="mt-5 flex h-40 items-stretch gap-[2px] overflow-x-auto">
            {series.map((point) => (
              <div
                key={point.day}
                title={`${point.day}: ${point.count} visita${point.count === 1 ? "" : "s"}`}
                className="flex min-w-[6px] flex-1 flex-col justify-end"
              >
                <div
                  className="rounded-t bg-accent/80 transition-colors hover:bg-accent"
                  style={{ height: `${Math.max(2, (point.count / peak) * 100)}%` }}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-muted">
            Todavía no hay visitas registradas en este periodo.
          </p>
        )}
        <div className="mt-2 flex justify-between text-xs text-muted">
          <span>{range.from}</span>
          <span>{range.to}</span>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 font-serif text-lg font-bold text-ink">Notas más leídas</h2>
          {topNotes.some((row) => row.reads > 0) ? (
            <ul className="divide-y divide-line rounded-lg border border-line bg-paper">
              {topNotes.map(({ note, reads }) => (
                <li key={note.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/notas/${note.id}`}
                      className="block truncate text-sm text-ink hover:text-accent"
                    >
                      {note.title}
                    </Link>
                    <p className="text-xs text-muted">
                      {getCategory(note.category).label}
                    </p>
                  </div>
                  <span className="shrink-0 font-serif text-lg text-ink">
                    {reads.toLocaleString("es-MX")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-line bg-paper px-6 py-10 text-center text-sm text-muted">
              Sin lecturas registradas en este periodo.
            </p>
          )}
        </section>

        <section>
          <h2 className="mb-3 font-serif text-lg font-bold text-ink">
            Rendimiento de la publicidad
          </h2>
          {banners.length ? (
            <div className="overflow-x-auto rounded-lg border border-line bg-paper">
              <table className="w-full min-w-[30rem] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                    <th className="px-4 py-2 font-medium">Banner</th>
                    <th className="px-4 py-2 font-medium">Ubicación</th>
                    <th className="px-4 py-2 text-right font-medium">Vistas</th>
                    <th className="px-4 py-2 text-right font-medium">Clics</th>
                    <th className="px-4 py-2 text-right font-medium">CTR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {banners.map(({ banner, views, clicks, ctr }) => (
                    <tr key={banner.id}>
                      <td className="max-w-[14rem] truncate px-4 py-2 text-ink">
                        {banner.title}
                        {!banner.active && (
                          <span className="ml-2 text-xs text-muted">(pausado)</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-muted">
                        {bannerPositionLabel(banner.position)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {views.toLocaleString("es-MX")}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {clicks.toLocaleString("es-MX")}
                      </td>
                      <td className="px-4 py-2 text-right">{ctr.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-line bg-paper px-6 py-10 text-center text-sm text-muted">
              Todavía no hay banners cargados.
            </p>
          )}
        </section>
      </div>
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
      <p className="mt-1 font-serif text-3xl font-bold text-ink">
        {typeof value === "number" ? value.toLocaleString("es-MX") : value}
      </p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}
