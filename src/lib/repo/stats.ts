import "server-only";
import { execute, query, queryOne } from "../db";
import { dayInSiteZone } from "../dates";

export type Metric =
  | "visit" // una sesión de lectura (cookie de visita)
  | "pageview" // cada página abierta
  | "note" // lecturas por nota (ref = id de la nota)
  | "banner_view" // banner realmente visible en pantalla (ref = id)
  | "banner_click"; // clic en un banner (ref = id)

/** Suma 1 (o `amount`) al contador del día para esa métrica. */
export async function bump(
  metric: Metric,
  ref: string | number = "",
  amount = 1,
): Promise<void> {
  await execute(
    `INSERT INTO stats_daily (day, metric, ref, count) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE count = count + VALUES(count)`,
    [dayInSiteZone(), metric, String(ref), amount],
  );
}

/**
 * Versión por lotes: un solo INSERT para todos los banners de la página.
 * Una sentencia es atómica de por sí, así que no hace falta transacción.
 */
export async function bumpMany(
  entries: { metric: Metric; ref: string | number }[],
): Promise<void> {
  if (!entries.length) return;

  const day = dayInSiteZone();
  const params: (string | number)[] = [];
  for (const entry of entries) params.push(day, entry.metric, String(entry.ref), 1);

  await execute(
    `INSERT INTO stats_daily (day, metric, ref, count)
     VALUES ${entries.map(() => "(?, ?, ?, ?)").join(", ")}
     ON DUPLICATE KEY UPDATE count = count + VALUES(count)`,
    params,
  );
}

export type Range = { from: string; to: string };

export async function total(
  metric: Metric,
  range?: Range,
  ref?: string | number,
): Promise<number> {
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

  const row = await queryOne<{ total: number | null }>(
    `SELECT SUM(count) AS total FROM stats_daily WHERE ${conditions.join(" AND ")}`,
    params,
  );

  return Number(row?.total ?? 0);
}

/** Serie diaria de una métrica, rellenando con ceros los días sin tráfico. */
export async function series(
  metric: Metric,
  range: Range,
): Promise<{ day: string; count: number }[]> {
  const rows = await query<{ day: string; count: number }>(
    `SELECT day, SUM(count) AS count FROM stats_daily
     WHERE metric = ? AND day BETWEEN ? AND ?
     GROUP BY day ORDER BY day`,
    [metric, range.from, range.to],
  );

  const byDay = new Map(rows.map((row) => [row.day, Number(row.count)]));
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
export async function totalsByRef(
  metric: Metric,
  range?: Range,
): Promise<Map<string, number>> {
  const conditions = ["metric = ?"];
  const params: string[] = [metric];

  if (range) {
    conditions.push("day BETWEEN ? AND ?");
    params.push(range.from, range.to);
  }

  const rows = await query<{ ref: string; count: number }>(
    `SELECT ref, SUM(count) AS count FROM stats_daily
     WHERE ${conditions.join(" AND ")}
     GROUP BY ref ORDER BY count DESC`,
    params,
  );

  return new Map(rows.map((row) => [row.ref, Number(row.count)]));
}

/** Detalle día × banner, para la hoja de Excel. */
export async function bannerDaily(range: Range): Promise<
  {
    day: string;
    ref: string;
    views: number;
    clicks: number;
  }[]
> {
  const rows = await query<{
    day: string;
    ref: string;
    metric: string;
    count: number;
  }>(
    `SELECT day, ref, metric, SUM(count) AS count FROM stats_daily
     WHERE metric IN ('banner_view','banner_click') AND day BETWEEN ? AND ?
     GROUP BY day, ref, metric ORDER BY day, ref`,
    [range.from, range.to],
  );

  const merged = new Map<string, { day: string; ref: string; views: number; clicks: number }>();

  for (const row of rows) {
    const key = `${row.day}|${row.ref}`;
    const entry = merged.get(key) ?? { day: row.day, ref: row.ref, views: 0, clicks: 0 };
    if (row.metric === "banner_view") entry.views = Number(row.count);
    else entry.clicks = Number(row.count);
    merged.set(key, entry);
  }

  return [...merged.values()];
}

/** El primer día con datos, para acotar el rango por omisión de la exportación. */
export async function firstDay(): Promise<string | null> {
  const row = await queryOne<{ day: string | null }>(
    "SELECT MIN(day) AS day FROM stats_daily",
  );
  return row?.day ?? null;
}
