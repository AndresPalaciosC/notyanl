import { requireAdmin } from "@/lib/auth";
import { buildXlsx, type Sheet } from "@/lib/xlsx";
import { dayInSiteZone, formatDateTime, lastDays } from "@/lib/dates";
import { bannerPositionLabel, getCategory } from "@/lib/config";
import * as stats from "@/lib/repo/stats";
import { listBanners } from "@/lib/repo/banners";
import { listForAdmin, statusCounts } from "@/lib/repo/notes";

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Descarga en Excel de visitas, lecturas por nota y rendimiento de la publicidad. */
export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch {
    return new Response("No autorizado", { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const fallback = lastDays(30);

  const from = DAY_PATTERN.test(params.get("desde") ?? "")
    ? params.get("desde")!
    : (await stats.firstDay() ?? fallback.from);
  const to = DAY_PATTERN.test(params.get("hasta") ?? "")
    ? params.get("hasta")!
    : dayInSiteZone();

  const range = from <= to ? { from, to } : { from: to, to: from };

  const visits = await stats.total("visit", range);
  const pageviews = await stats.total("pageview", range);
  const notes = await listForAdmin({ limit: 5000 });
  const banners = await listBanners();
  const counts = await statusCounts();

  const readsByNote = await stats.totalsByRef("note", range);
  const viewsByBanner = await stats.totalsByRef("banner_view", range);
  const clicksByBanner = await stats.totalsByRef("banner_click", range);

  const rangeViews = sum(viewsByBanner);
  const rangeClicks = sum(clicksByBanner);

  const visitSeries = await stats.series("visit", range);
  const pageviewSeries = new Map(
    (await stats.series("pageview", range)).map((point) => [point.day, point.count]),
  );

  const bannerById = new Map(banners.map((banner) => [String(banner.id), banner]));

  const sheets: Sheet[] = [
    {
      name: "Resumen",
      columns: [{ header: "Concepto", width: 34 }, { header: "Valor", width: 22 }],
      rows: [
        ["Periodo", `${range.from} a ${range.to}`],
        ["Generado", formatDateTime(new Date().toISOString())],
        [],
        ["Visitas", visits],
        ["Páginas vistas", pageviews],
        ["Páginas por visita", visits ? Number((pageviews / visits).toFixed(2)) : 0],
        [],
        ["Notas publicadas", counts.published],
        ["Borradores", counts.draft],
        [],
        ["Banners cargados", banners.length],
        ["Banners activos", banners.filter((b) => b.active).length],
        ["Vistas de publicidad (periodo)", rangeViews],
        ["Clics de publicidad (periodo)", rangeClicks],
        ["CTR global", rangeViews ? `${((rangeClicks / rangeViews) * 100).toFixed(2)}%` : "0.00%"],
      ],
    },
    {
      name: "Visitas por día",
      columns: [
        { header: "Fecha", width: 14 },
        { header: "Visitas", width: 12 },
        { header: "Páginas vistas", width: 16 },
      ],
      rows: visitSeries.map((point) => [
        point.day,
        point.count,
        pageviewSeries.get(point.day) ?? 0,
      ]),
    },
    {
      name: "Notas",
      columns: [
        { header: "Título", width: 52 },
        { header: "Sección", width: 22 },
        { header: "Estado", width: 12 },
        { header: "Autor", width: 20 },
        { header: "Publicada", width: 20 },
        { header: "Lecturas (periodo)", width: 18 },
        { header: "Dirección", width: 42 },
      ],
      rows: notes.map((note) => [
        note.title,
        getCategory(note.category).label,
        note.status === "published" ? "Publicada" : "Borrador",
        note.author || "—",
        note.publishedAt ? formatDateTime(note.publishedAt) : "—",
        readsByNote.get(String(note.id)) ?? 0,
        `/nota/${note.slug}`,
      ]),
    },
    {
      name: "Publicidad",
      columns: [
        { header: "Banner", width: 30 },
        { header: "Anunciante", width: 24 },
        { header: "Ubicación", width: 14 },
        { header: "Estado", width: 10 },
        { header: "Peso", width: 8 },
        { header: "Vistas (periodo)", width: 16 },
        { header: "Clics (periodo)", width: 15 },
        { header: "CTR periodo", width: 13 },
        { header: "Vistas históricas", width: 17 },
        { header: "Clics históricos", width: 16 },
        { header: "Enlace", width: 40 },
      ],
      rows: banners.map((banner) => {
        const views = viewsByBanner.get(String(banner.id)) ?? 0;
        const clicks = clicksByBanner.get(String(banner.id)) ?? 0;
        return [
          banner.title,
          banner.advertiser || "—",
          bannerPositionLabel(banner.position),
          banner.active ? "Activo" : "Pausado",
          banner.weight,
          views,
          clicks,
          views ? `${((clicks / views) * 100).toFixed(2)}%` : "0.00%",
          banner.impressions,
          banner.clicks,
          banner.linkUrl || "—",
        ];
      }),
    },
    {
      name: "Publicidad por día",
      columns: [
        { header: "Fecha", width: 14 },
        { header: "Banner", width: 30 },
        { header: "Anunciante", width: 24 },
        { header: "Vistas", width: 12 },
        { header: "Clics", width: 12 },
      ],
      rows: (await stats.bannerDaily(range)).map((entry) => {
        const banner = bannerById.get(entry.ref);
        return [
          entry.day,
          banner?.title ?? `Banner ${entry.ref} (eliminado)`,
          banner?.advertiser || "—",
          entry.views,
          entry.clicks,
        ];
      }),
    },
  ];

  const file = buildXlsx(sheets);

  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="notas-actualidad-mty_${range.from}_a_${range.to}.xlsx"`,
      "Content-Length": String(file.length),
      "Cache-Control": "no-store",
    },
  });
}

function sum(map: Map<string, number>): number {
  let total = 0;
  for (const value of map.values()) total += value;
  return total;
}
