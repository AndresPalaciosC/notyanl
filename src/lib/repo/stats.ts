import "server-only";
import { getDb } from "../db";
import { dayInSiteZone } from "../dates";

export type Metric =
  | "visit" // una sesión de lectura (cookie de visita)
  | "pageview" // cada página abierta
  | "note" // lecturas por nota (ref = id de la nota)
  | "banner_view" // banner realmente visible en pantalla (ref = id)
  | "banner_click"; // clic en un banner (ref = id)

/** Suma 1 (o `amount`) al contador del día para esa métrica. */
export function bump(metric: Metric, ref: string | number = "", amount = 1): void {
  getDb()
    .prepare(
      `INSERT INTO stats_daily (day, metric, ref, count) VALUES (?, ?, ?, ?)
       ON CONFLICT(day, metric, ref) DO UPDATE SET count = count + excluded.count`,
    )
    .run(dayInSiteZone(), metric, String(ref), amount);
}

/** Versión por lotes: una sola transacción para todos los banners de la página. */
export function bumpMany(entries: { metric: Metric; ref: string | number }[]): void {
  if (!entries.length) return;

  const db = getDb();
  const statement = db.prepare(
    `INSERT INTO stats_daily (day, metric, ref, count) VALUES (?, ?, ?, 1)
     ON CONFLICT(day, metric, ref) DO UPDATE SET count = count + 1`,
  );
  const day = dayInSiteZone();

  db.transaction(() => {
    for (const entry of entries) statement.run(day, entry.metric, String(entry.ref));
  })();
}

export type Range = { from: string; to: string };

export function total(metric: Metric, range?: Range, ref?: string | number): number {
  const conditions = ["metric = ?"];
  const params: (string | number)[] = [metric];

  if (range) {
    conditions.push("day BETWEEN ? AND ?");
    params.push(range.from, range.to);
  }
  if (ref !== undefined) {
    conditions.push("ref = ?");
    params.push(String(ref));
  }

  const row = getDb()
    .prepare<(string | number)[], { total: number | null }>(
      `SELECT SUM(count) AS total FROM stats_daily WHERE ${conditions.join(" AND ")}`,
    )
    .get(...params);

  return row?.total ?? 0;
}

/** Serie diaria de una métrica, rellenando con ceros los días sin tráfico. */
export function series(metric: Metric, range: Range): { day: string; count: number }[] {
  const rows = getDb()
    .prepare<[string, string, string], { day: string; count: number }>(
      `SELECT day, SUM(count) AS count FROM stats_daily
       WHERE metric = ? AND day BETWEEN ? AND ?
       GROUP BY day ORDER BY day`,
    )
    .all(metric, range.from, range.to);

  const byDay = new Map(rows.map((row) => [row.day, row.count]));
  const out: { day: string; count: number }[] = [];

  for (
    let cursor = new Date(`${range.from}T12:00:00Z`);
    dayInSiteZone(cursor) <= range.to;
    cursor = new Date(cursor.getTime() + 86_400_000)
  ) {
    const day = dayInSiteZone(cursor);
    out.push({ day, count: byDay.get(day) ?? 0 });
    if (out.length > 400) break;
  }

  return out;
}

/** Totales por referencia (nota o banner), de mayor a menor. */
export function totalsByRef(
  metric: Metric,
  range?: Range,
): Map<string, number> {
  const conditions = ["metric = ?"];
  const params: string[] = [metric];

  if (range) {
    conditions.push("day BETWEEN ? AND ?");
    params.push(range.from, range.to);
  }

  const rows = getDb()
    .prepare<string[], { ref: string; count: number }>(
      `SELECT ref, SUM(count) AS count FROM stats_daily
       WHERE ${conditions.join(" AND ")}
       GROUP BY ref ORDER BY count DESC`,
    )
    .all(...params);

  return new Map(rows.map((row) => [row.ref, row.count]));
}

/** Detalle día × banner, para la hoja de Excel. */
export function bannerDaily(range: Range): {
  day: string;
  ref: string;
  views: number;
  clicks: number;
}[] {
  const rows = getDb()
    .prepare<[string, string], { day: string; ref: string; metric: string; count: number }>(
      `SELECT day, ref, metric, SUM(count) AS count FROM stats_daily
       WHERE metric IN ('banner_view','banner_click') AND day BETWEEN ? AND ?
       GROUP BY day, ref, metric ORDER BY day, ref`,
    )
    .all(range.from, range.to);

  const merged = new Map<string, { day: string; ref: string; views: number; clicks: number }>();

  for (const row of rows) {
    const key = `${row.day}|${row.ref}`;
    const entry = merged.get(key) ?? { day: row.day, ref: row.ref, views: 0, clicks: 0 };
    if (row.metric === "banner_view") entry.views = row.count;
    else entry.clicks = row.count;
    merged.set(key, entry);
  }

  return [...merged.values()];
}

/** El primer día con datos, para acotar el rango por omisión de la exportación. */
export function firstDay(): string | null {
  const row = getDb()
    .prepare<[], { day: string | null }>("SELECT MIN(day) AS day FROM stats_daily")
    .get();
  return row?.day ?? null;
}
