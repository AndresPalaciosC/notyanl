import "server-only";
import { getDb } from "../db";
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
    position: (["top", "sidebar", "inline"].includes(row.position)
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

export function createBanner(input: BannerInput): Banner {
  const timestamp = nowIso();
  const result = getDb()
    .prepare(
      `INSERT INTO banners
         (title, advertiser, image_key, image_url, width, height, link_url,
          position, weight, active, starts_at, ends_at, created_at, updated_at)
       VALUES
         (@title, @advertiser, @imageKey, @imageUrl, @width, @height, @linkUrl,
          @position, @weight, @active, @startsAt, @endsAt, @createdAt, @updatedAt)`,
    )
    .run({
      title: input.title.trim() || "Banner sin título",
      advertiser: input.advertiser?.trim() ?? "",
      imageKey: input.imageKey,
      imageUrl: input.imageUrl,
      width: input.width ?? null,
      height: input.height ?? null,
      linkUrl: input.linkUrl?.trim() ?? "",
      position: ["top", "sidebar", "inline"].includes(input.position)
        ? input.position
        : "sidebar",
      weight: clampWeight(input.weight),
      active: input.active === false ? 0 : 1,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

  return getBannerById(Number(result.lastInsertRowid))!;
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

export function updateBanner(id: number, patch: BannerPatch): Banner | null {
  const current = getBannerById(id);
  if (!current) return null;

  getDb()
    .prepare(
      `UPDATE banners SET
         title = @title, advertiser = @advertiser, link_url = @linkUrl,
         position = @position, weight = @weight, active = @active,
         starts_at = @startsAt, ends_at = @endsAt, updated_at = @updatedAt
       WHERE id = @id`,
    )
    .run({
      id,
      title: patch.title?.trim() || current.title,
      advertiser: patch.advertiser?.trim() ?? current.advertiser,
      linkUrl: patch.linkUrl?.trim() ?? current.linkUrl,
      position:
        patch.position && ["top", "sidebar", "inline"].includes(patch.position)
          ? patch.position
          : current.position,
      weight: patch.weight === undefined ? current.weight : clampWeight(patch.weight),
      active: (patch.active ?? current.active) ? 1 : 0,
      startsAt: patch.startsAt === undefined ? current.startsAt : patch.startsAt,
      endsAt: patch.endsAt === undefined ? current.endsAt : patch.endsAt,
      updatedAt: nowIso(),
    });

  return getBannerById(id);
}

export function toggleBanner(id: number): void {
  getDb()
    .prepare("UPDATE banners SET active = 1 - active, updated_at = ? WHERE id = ?")
    .run(nowIso(), id);
}

export function deleteBanner(id: number): Banner | null {
  const banner = getBannerById(id);
  if (!banner) return null;
  getDb().prepare("DELETE FROM banners WHERE id = ?").run(id);
  return banner;
}

export function getBannerById(id: number): Banner | null {
  const row = getDb().prepare<[number], Row>("SELECT * FROM banners WHERE id = ?").get(id);
  return row ? toBanner(row) : null;
}

export function listBanners(position?: string): Banner[] {
  const db = getDb();
  const rows = position
    ? db
        .prepare<[string], Row>(
          "SELECT * FROM banners WHERE position = ? ORDER BY active DESC, created_at DESC",
        )
        .all(position)
    : db
        .prepare<[], Row>("SELECT * FROM banners ORDER BY active DESC, created_at DESC")
        .all();

  return rows.map(toBanner);
}

/** Banners vigentes: activos y dentro de su ventana de fechas. */
export function listEligible(position: BannerPosition): Banner[] {
  const now = nowIso();
  return getDb()
    .prepare<[string, string, string], Row>(
      `SELECT * FROM banners
       WHERE position = ?
         AND active = 1
         AND (starts_at IS NULL OR starts_at <= ?)
         AND (ends_at   IS NULL OR ends_at   >= ?)`,
    )
    .all(position, now, now)
    .map(toBanner);
}

/**
 * Reparte los banners vigentes en `slots` huecos para que cada uno vaya
 * rotando solo en el navegador. Se ordena la bolsa con el mismo criterio
 * ponderado y luego se reparte de uno en uno, así que dos huecos de la misma
 * página nunca muestran el mismo anuncio a la vez.
 */
export function pickRotation(
  position: BannerPosition,
  slots: number,
  perSlot: number,
): Banner[][] {
  const pool = listEligible(position)
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

export function recordImpressions(ids: number[]): void {
  if (!ids.length) return;
  getDb()
    .prepare(
      `UPDATE banners SET impressions = impressions + 1
       WHERE id IN (${ids.map(() => "?").join(",")})`,
    )
    .run(...ids);
}

export function recordClick(id: number): void {
  getDb().prepare("UPDATE banners SET clicks = clicks + 1 WHERE id = ?").run(id);
}

export function bannerStats(): { total: number; active: number; byPosition: Record<string, number> } {
  const rows = getDb()
    .prepare<[], { position: string; total: number; active: number }>(
      `SELECT position, COUNT(*) AS total, SUM(active) AS active
       FROM banners GROUP BY position`,
    )
    .all();

  const byPosition: Record<string, number> = {};
  let total = 0;
  let active = 0;

  for (const row of rows) {
    byPosition[row.position] = row.total;
    total += row.total;
    active += row.active ?? 0;
  }

  return { total, active, byPosition };
}
