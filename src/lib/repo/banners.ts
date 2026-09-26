import "server-only";
import { execute, query, queryOne } from "../db";
import { nowIso } from "../dates";
import type { BannerPosition } from "../config";

export type Banner = {
  id: number;
  title: string;
  advertiser: string;
  imageKey: string;
  imageUrl: string;
  width: number | null;
  height: number | null;
  linkUrl: string;
  position: BannerPosition;
  weight: number;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  impressions: number;
  clicks: number;
  createdAt: string;
  updatedAt: string;
};

type Row = {
  id: number;
  title: string;
  advertiser: string;
  image_key: string;
  image_url: string;
  width: number | null;
  height: number | null;
  link_url: string;
  position: string;
  weight: number;
  active: number;
  starts_at: string | null;
  ends_at: string | null;
  impressions: number;
  clicks: number;
  created_at: string;
  updated_at: string;
};

const POSITIONS = ["top", "sidebar", "inline"];

function toBanner(row: Row): Banner {
  return {
    id: row.id,
    title: row.title,
    advertiser: row.advertiser,
    imageKey: row.image_key,
    imageUrl: row.image_url,
    width: row.width,
    height: row.height,
    linkUrl: row.link_url,
    position: (POSITIONS.includes(row.position)
      ? row.position
      : "sidebar") as BannerPosition,
    weight: row.weight,
    active: row.active === 1,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    impressions: row.impressions,
    clicks: row.clicks,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type BannerInput = {
  title: string;
  advertiser?: string;
  imageKey: string;
  imageUrl: string;
  width?: number | null;
  height?: number | null;
  linkUrl?: string;
  position: string;
  weight?: number;
  active?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
};

export async function createBanner(input: BannerInput): Promise<Banner> {
  const timestamp = nowIso();
  const result = await execute(
    `INSERT INTO banners
       (title, advertiser, image_key, image_url, width, height, link_url,
        position, weight, active, starts_at, ends_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.title.trim() || "Banner sin título",
      input.advertiser?.trim() ?? "",
      input.imageKey,
      input.imageUrl,
      input.width ?? null,
      input.height ?? null,
      input.linkUrl?.trim() ?? "",
      POSITIONS.includes(input.position) ? input.position : "sidebar",
      clampWeight(input.weight),
      input.active === false ? 0 : 1,
      input.startsAt ?? null,
      input.endsAt ?? null,
      timestamp,
      timestamp,
    ],
  );

  return (await getBannerById(result.insertId))!;
}

function clampWeight(weight: number | undefined): number {
  if (!weight || !Number.isFinite(weight)) return 1;
  return Math.min(10, Math.max(1, Math.round(weight)));
}

export type BannerPatch = {
  title?: string;
  advertiser?: string;
  linkUrl?: string;
  position?: string;
  weight?: number;
  active?: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
};

export async function updateBanner(
  id: number,
  patch: BannerPatch,
): Promise<Banner | null> {
  const current = await getBannerById(id);
  if (!current) return null;

  await execute(
    `UPDATE banners SET
       title = ?, advertiser = ?, link_url = ?, position = ?, weight = ?,
       active = ?, starts_at = ?, ends_at = ?, updated_at = ?
     WHERE id = ?`,
    [
      patch.title?.trim() || current.title,
      patch.advertiser?.trim() ?? current.advertiser,
      patch.linkUrl?.trim() ?? current.linkUrl,
      patch.position && POSITIONS.includes(patch.position)
        ? patch.position
        : current.position,
      patch.weight === undefined ? current.weight : clampWeight(patch.weight),
      (patch.active ?? current.active) ? 1 : 0,
      patch.startsAt === undefined ? current.startsAt : patch.startsAt,
      patch.endsAt === undefined ? current.endsAt : patch.endsAt,
      nowIso(),
      id,
    ],
  );

  return getBannerById(id);
}

export async function toggleBanner(id: number): Promise<void> {
  await execute(
    "UPDATE banners SET active = 1 - active, updated_at = ? WHERE id = ?",
    [nowIso(), id],
  );
}

export async function deleteBanner(id: number): Promise<Banner | null> {
  const banner = await getBannerById(id);
  if (!banner) return null;
  await execute("DELETE FROM banners WHERE id = ?", [id]);
  return banner;
}

export async function getBannerById(id: number): Promise<Banner | null> {
  const row = await queryOne<Row>("SELECT * FROM banners WHERE id = ?", [id]);
  return row ? toBanner(row) : null;
}

export async function listBanners(position?: string): Promise<Banner[]> {
  const rows = position
    ? await query<Row>(
        "SELECT * FROM banners WHERE position = ? ORDER BY active DESC, created_at DESC",
        [position],
      )
    : await query<Row>("SELECT * FROM banners ORDER BY active DESC, created_at DESC");

  return rows.map(toBanner);
}

/** Banners vigentes: activos y dentro de su ventana de fechas. */
export async function listEligible(position: BannerPosition): Promise<Banner[]> {
  const now = nowIso();
  const rows = await query<Row>(
    `SELECT * FROM banners
     WHERE position = ?
       AND active = 1
       AND (starts_at IS NULL OR starts_at <= ?)
       AND (ends_at   IS NULL OR ends_at   >= ?)`,
    [position, now, now],
  );
  return rows.map(toBanner);
}

/**
 * Reparte los banners vigentes en `slots` huecos para que cada uno vaya
 * rotando solo en el navegador. Se ordena la bolsa con un criterio ponderado
 * (Efraimidis–Spirakis: cada banner recibe la llave `random^(1/peso)`, así que
 * un peso mayor sube la probabilidad de salir adelante sin garantizarlo) y
 * luego se reparte de uno en uno, para que dos huecos de la misma página no
 * muestren el mismo anuncio a la vez.
 */
export async function pickRotation(
  position: BannerPosition,
  slots: number,
  perSlot: number,
): Promise<Banner[][]> {
  const pool = (await listEligible(position))
    .map((banner) => ({
      banner,
      key: Math.random() ** (1 / Math.max(1, banner.weight)),
    }))
    .sort((a, b) => b.key - a.key)
    .map((entry) => entry.banner);

  const groups: Banner[][] = Array.from({ length: Math.max(1, slots) }, () => []);

  pool.slice(0, groups.length * perSlot).forEach((banner, index) => {
    groups[index % groups.length].push(banner);
  });

  return groups.filter((group) => group.length > 0);
}

export async function recordImpressions(ids: number[]): Promise<void> {
  if (!ids.length) return;
  await execute(
    `UPDATE banners SET impressions = impressions + 1
     WHERE id IN (${ids.map(() => "?").join(",")})`,
    ids,
  );
}

export async function recordClick(id: number): Promise<void> {
  await execute("UPDATE banners SET clicks = clicks + 1 WHERE id = ?", [id]);
}

export async function bannerStats(): Promise<{
  total: number;
  active: number;
  byPosition: Record<string, number>;
}> {
  const rows = await query<{ position: string; total: number; active: number | null }>(
    `SELECT position, COUNT(*) AS total, SUM(active) AS active
     FROM banners GROUP BY position`,
  );

  const byPosition: Record<string, number> = {};
  let total = 0;
  let active = 0;

  for (const row of rows) {
    byPosition[row.position] = Number(row.total);
    total += Number(row.total);
    active += Number(row.active ?? 0);
  }

  return { total, active, byPosition };
}
