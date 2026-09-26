import "server-only";
import { execute, query, queryOne } from "../db";
import { nowIso } from "../dates";
import { uniqueSlug } from "../slug";
import { autoSummary, htmlToText, sanitizeBody } from "../sanitize";
import {
  CATEGORY_SLUGS,
  DEFAULT_CATEGORY,
  RECOMMEND_MAX_AGE_DAYS,
  type CategorySlug,
} from "../config";

export type NoteStatus = "draft" | "published";

export type Note = {
  id: number;
  slug: string;
  title: string;
  summary: string;
  bodyHtml: string;
  plainText: string;
  category: CategorySlug;
  author: string;
  coverUrl: string | null;
  coverAlt: string;
  status: NoteStatus;
  featured: boolean;
  sourceFile: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type Row = {
  id: number;
  slug: string;
  title: string;
  summary: string;
  body_html: string;
  plain_text: string;
  category: string;
  author: string;
  cover_url: string | null;
  cover_alt: string;
  status: string;
  featured: number;
  source_file: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

function toNote(row: Row): Note {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    bodyHtml: row.body_html,
    plainText: row.plain_text,
    category: (CATEGORY_SLUGS.includes(row.category as CategorySlug)
      ? row.category
      : DEFAULT_CATEGORY) as CategorySlug,
    author: row.author,
    coverUrl: row.cover_url,
    coverAlt: row.cover_alt,
    status: row.status === "published" ? "published" : "draft",
    featured: row.featured === 1,
    sourceFile: row.source_file,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Entero seguro para interpolar donde MySQL no admite parámetros (LIMIT). */
function int(value: number, fallback: number, max = 5000): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(0, Math.trunc(value)));
}

export type NoteInput = {
  title: string;
  summary?: string;
  bodyHtml: string;
  category: string;
  author?: string;
  coverUrl?: string | null;
  coverAlt?: string;
  status: NoteStatus;
  featured?: boolean;
  sourceFile?: string | null;
  publishedAt?: string | null;
  slug?: string;
};

function normalize(input: NoteInput) {
  const bodyHtml = sanitizeBody(input.bodyHtml);
  const plainText = htmlToText(bodyHtml);
  const title = input.title.trim() || "Nota sin título";
  const category = (
    CATEGORY_SLUGS.includes(input.category as CategorySlug) ? input.category : DEFAULT_CATEGORY
  ) as CategorySlug;

  return {
    title,
    bodyHtml,
    plainText,
    category,
    summary: (input.summary?.trim() || autoSummary(bodyHtml)).slice(0, 400),
    author: input.author?.trim() ?? "",
    coverUrl: input.coverUrl?.trim() || null,
    coverAlt: input.coverAlt?.trim() ?? "",
    status: input.status === "published" ? "published" : "draft",
    featured: input.featured ? 1 : 0,
    sourceFile: input.sourceFile ?? null,
  };
}

export async function slugExists(slug: string, exceptId?: number): Promise<boolean> {
  const row = await queryOne<{ id: number }>("SELECT id FROM notes WHERE slug = ?", [slug]);
  if (!row) return false;
  return exceptId === undefined || row.id !== exceptId;
}

export async function createNote(input: NoteInput): Promise<Note> {
  const data = normalize(input);
  const timestamp = nowIso();
  const slug = await uniqueSlug(input.slug?.trim() || data.title, (s) => slugExists(s));

  const publishedAt =
    data.status === "published" ? (input.publishedAt ?? timestamp) : (input.publishedAt ?? null);

  const result = await execute(
    `INSERT INTO notes
       (slug, title, summary, body_html, plain_text, category, author,
        cover_url, cover_alt, status, featured, source_file,
        published_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      slug,
      data.title,
      data.summary,
      data.bodyHtml,
      data.plainText,
      data.category,
      data.author,
      data.coverUrl,
      data.coverAlt,
      data.status,
      data.featured,
      data.sourceFile,
      publishedAt,
      timestamp,
      timestamp,
    ],
  );

  return (await getById(result.insertId))!;
}

export async function updateNote(id: number, input: NoteInput): Promise<Note | null> {
  const current = await getById(id);
  if (!current) return null;

  const data = normalize(input);
  const requestedSlug = input.slug?.trim() || current.slug;
  const slug =
    requestedSlug === current.slug
      ? current.slug
      : await uniqueSlug(requestedSlug, (s) => slugExists(s, id));

  // Al publicar por primera vez se sella la fecha; después se respeta la elegida.
  let publishedAt = input.publishedAt ?? current.publishedAt;
  if (data.status === "published" && !publishedAt) publishedAt = nowIso();

  await execute(
    `UPDATE notes SET
       slug = ?, title = ?, summary = ?, body_html = ?, plain_text = ?,
       category = ?, author = ?, cover_url = ?, cover_alt = ?, status = ?,
       featured = ?, source_file = ?, published_at = ?, updated_at = ?
     WHERE id = ?`,
    [
      slug,
      data.title,
      data.summary,
      data.bodyHtml,
      data.plainText,
      data.category,
      data.author,
      data.coverUrl,
      data.coverAlt,
      data.status,
      data.featured,
      data.sourceFile ?? current.sourceFile,
      publishedAt,
      nowIso(),
      id,
    ],
  );

  return getById(id);
}

export async function setStatus(id: number, status: NoteStatus): Promise<void> {
  const current = await getById(id);
  if (!current) return;

  const publishedAt =
    status === "published" ? (current.publishedAt ?? nowIso()) : current.publishedAt;

  await execute(
    "UPDATE notes SET status = ?, published_at = ?, updated_at = ? WHERE id = ?",
    [status, publishedAt, nowIso(), id],
  );
}

export async function toggleFeatured(id: number): Promise<void> {
  await execute(
    "UPDATE notes SET featured = 1 - featured, updated_at = ? WHERE id = ?",
    [nowIso(), id],
  );
}

export async function deleteNote(id: number): Promise<void> {
  await execute("DELETE FROM notes WHERE id = ?", [id]);
}

export async function getById(id: number): Promise<Note | null> {
  const row = await queryOne<Row>("SELECT * FROM notes WHERE id = ?", [id]);
  return row ? toNote(row) : null;
}

export async function getBySlug(
  slug: string,
  options?: { publishedOnly?: boolean },
): Promise<Note | null> {
  const row = await queryOne<Row>("SELECT * FROM notes WHERE slug = ?", [slug]);
  if (!row) return null;

  const note = toNote(row);
  if (options?.publishedOnly && !isVisible(note)) return null;
  return note;
}

/** Publicada y con fecha ya alcanzada (permite programar). */
function isVisible(note: Note): boolean {
  if (note.status !== "published") return false;
  if (!note.publishedAt) return true;
  return new Date(note.publishedAt).getTime() <= Date.now();
}

const VISIBLE_CLAUSE = `status = 'published' AND (published_at IS NULL OR published_at <= ?)`;

export type FeedOptions = {
  category?: string;
  limit?: number;
  offset?: number;
  excludeIds?: number[];
  featuredOnly?: boolean;
};

export async function listPublished(options: FeedOptions = {}): Promise<Note[]> {
  const { category, limit = 12, offset = 0, excludeIds = [], featuredOnly } = options;

  const conditions = [VISIBLE_CLAUSE];
  const params: (string | number)[] = [nowIso()];

  if (category) {
    conditions.push("category = ?");
    params.push(category);
  }
  if (featuredOnly) conditions.push("featured = 1");
  if (excludeIds.length) {
    conditions.push(`id NOT IN (${excludeIds.map(() => "?").join(",")})`);
    params.push(...excludeIds);
  }

  const rows = await query<Row>(
    `SELECT * FROM notes WHERE ${conditions.join(" AND ")}
     ORDER BY featured DESC, published_at DESC, id DESC
     LIMIT ${int(limit, 12)} OFFSET ${int(offset, 0)}`,
    params,
  );

  return rows.map(toNote);
}

export async function countPublished(category?: string): Promise<number> {
  const conditions = [VISIBLE_CLAUSE];
  const params: (string | number)[] = [nowIso()];
  if (category) {
    conditions.push("category = ?");
    params.push(category);
  }

  const row = await queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM notes WHERE ${conditions.join(" AND ")}`,
    params,
  );

  return Number(row?.total ?? 0);
}

export async function searchPublished(term: string, limit = 30): Promise<Note[]> {
  const like = `%${term.trim().toLowerCase()}%`;
  const rows = await query<Row>(
    `SELECT * FROM notes
     WHERE ${VISIBLE_CLAUSE}
       AND (lower(title) LIKE ? OR lower(summary) LIKE ? OR lower(plain_text) LIKE ?)
     ORDER BY published_at DESC
     LIMIT ${int(limit, 30)}`,
    [nowIso(), like, like, like],
  );
  return rows.map(toNote);
}

export type AdminListOptions = {
  status?: NoteStatus | "all";
  category?: string;
  query?: string;
  limit?: number;
  offset?: number;
};

export async function listForAdmin(options: AdminListOptions = {}): Promise<Note[]> {
  const { status = "all", category, query: search, limit = 50, offset = 0 } = options;

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (status !== "all") {
    conditions.push("status = ?");
    params.push(status);
  }
  if (category) {
    conditions.push("category = ?");
    params.push(category);
  }
  if (search?.trim()) {
    conditions.push("(lower(title) LIKE ? OR lower(plain_text) LIKE ?)");
    const like = `%${search.trim().toLowerCase()}%`;
    params.push(like, like);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = await query<Row>(
    `SELECT * FROM notes ${where}
     ORDER BY COALESCE(published_at, updated_at) DESC, id DESC
     LIMIT ${int(limit, 50)} OFFSET ${int(offset, 0)}`,
    params,
  );

  return rows.map(toNote);
}

export async function statusCounts(): Promise<{
  published: number;
  draft: number;
  total: number;
}> {
  const rows = await query<{ status: string; total: number }>(
    "SELECT status, COUNT(*) AS total FROM notes GROUP BY status",
  );

  const published = Number(rows.find((r) => r.status === "published")?.total ?? 0);
  const draft = Number(rows.find((r) => r.status === "draft")?.total ?? 0);
  return { published, draft, total: published + draft };
}

/**
 * Notas recomendadas: se eligen al azar entre las publicadas en los últimos
 * RECOMMEND_MAX_AGE_DAYS días. Las más viejas quedan archivadas — siguen
 * disponibles por enlace, sección y búsqueda, pero dejan de recomendarse para
 * que la portada no arrastre noticias vencidas.
 */
export async function listRecommended(note: Note, limit = 3): Promise<Note[]> {
  const now = nowIso();
  const cutoff = new Date(
    Date.now() - RECOMMEND_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const rows = await query<Row>(
    `SELECT * FROM notes
     WHERE ${VISIBLE_CLAUSE}
       AND published_at IS NOT NULL
       AND published_at >= ?
       AND id != ?
     ORDER BY RAND()
     LIMIT ${int(limit, 3, 50)}`,
    [now, cutoff, note.id],
  );

  return rows.map(toNote);
}

/** ¿La nota sigue dentro de la ventana de recomendación? */
export function isRecommendable(note: Note): boolean {
  if (note.status !== "published" || !note.publishedAt) return false;
  const age = Date.now() - new Date(note.publishedAt).getTime();
  return age <= RECOMMEND_MAX_AGE_DAYS * 24 * 60 * 60 * 1000 && age >= 0;
}
