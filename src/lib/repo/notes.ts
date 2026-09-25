import "server-only";
import { getDb } from "../db";
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

export function slugExists(slug: string, exceptId?: number): boolean {
  const row = getDb()
    .prepare<[string], { id: number }>("SELECT id FROM notes WHERE slug = ?")
    .get(slug);
  if (!row) return false;
  return exceptId === undefined || row.id !== exceptId;
}

export function createNote(input: NoteInput): Note {
  const data = normalize(input);
  const timestamp = nowIso();
  const slug = input.slug?.trim()
    ? uniqueSlug(input.slug, (s) => slugExists(s))
    : uniqueSlug(data.title, (s) => slugExists(s));

  const publishedAt =
    data.status === "published" ? (input.publishedAt ?? timestamp) : (input.publishedAt ?? null);

  const result = getDb()
    .prepare(
      `INSERT INTO notes
         (slug, title, summary, body_html, plain_text, category, author,
          cover_url, cover_alt, status, featured, source_file,
          published_at, created_at, updated_at)
       VALUES
         (@slug, @title, @summary, @bodyHtml, @plainText, @category, @author,
          @coverUrl, @coverAlt, @status, @featured, @sourceFile,
          @publishedAt, @createdAt, @updatedAt)`,
    )
    .run({
      ...data,
      slug,
      publishedAt,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

  return getById(Number(result.lastInsertRowid))!;
}

export function updateNote(id: number, input: NoteInput): Note | null {
  const current = getById(id);
  if (!current) return null;

  const data = normalize(input);
  const requestedSlug = input.slug?.trim() || current.slug;
  const slug =
    requestedSlug === current.slug
      ? current.slug
      : uniqueSlug(requestedSlug, (s) => slugExists(s, id));

  // Al publicar por primera vez se sella la fecha; después se respeta la elegida.
  let publishedAt = input.publishedAt ?? current.publishedAt;
  if (data.status === "published" && !publishedAt) publishedAt = nowIso();

  getDb()
    .prepare(
      `UPDATE notes SET
         slug = @slug, title = @title, summary = @summary, body_html = @bodyHtml,
         plain_text = @plainText, category = @category, author = @author,
         cover_url = @coverUrl, cover_alt = @coverAlt, status = @status,
         featured = @featured, source_file = @sourceFile,
         published_at = @publishedAt, updated_at = @updatedAt
       WHERE id = @id`,
    )
    .run({
      ...data,
      id,
      slug,
      publishedAt,
      sourceFile: data.sourceFile ?? current.sourceFile,
      updatedAt: nowIso(),
    });

  return getById(id);
}

export function setStatus(id: number, status: NoteStatus): void {
  const current = getById(id);
  if (!current) return;

  const publishedAt =
    status === "published" ? (current.publishedAt ?? nowIso()) : current.publishedAt;

  getDb()
    .prepare("UPDATE notes SET status = ?, published_at = ?, updated_at = ? WHERE id = ?")
    .run(status, publishedAt, nowIso(), id);
}

export function toggleFeatured(id: number): void {
  getDb()
    .prepare("UPDATE notes SET featured = 1 - featured, updated_at = ? WHERE id = ?")
    .run(nowIso(), id);
}

export function deleteNote(id: number): void {
  getDb().prepare("DELETE FROM notes WHERE id = ?").run(id);
}

export function getById(id: number): Note | null {
  const row = getDb().prepare<[number], Row>("SELECT * FROM notes WHERE id = ?").get(id);
  return row ? toNote(row) : null;
}

export function getBySlug(slug: string, options?: { publishedOnly?: boolean }): Note | null {
  const row = getDb()
    .prepare<[string], Row>("SELECT * FROM notes WHERE slug = ?")
    .get(slug);
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

export function listPublished(options: FeedOptions = {}): Note[] {
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

  params.push(limit, offset);

  return getDb()
    .prepare<(string | number)[], Row>(
      `SELECT * FROM notes WHERE ${conditions.join(" AND ")}
       ORDER BY featured DESC, published_at DESC, id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params)
    .map(toNote);
}

export function countPublished(category?: string): number {
  const conditions = [VISIBLE_CLAUSE];
  const params: (string | number)[] = [nowIso()];
  if (category) {
    conditions.push("category = ?");
    params.push(category);
  }

  const row = getDb()
    .prepare<(string | number)[], { total: number }>(
      `SELECT COUNT(*) AS total FROM notes WHERE ${conditions.join(" AND ")}`,
    )
    .get(...params);

  return row?.total ?? 0;
}

export function searchPublished(query: string, limit = 30): Note[] {
  const term = `%${query.trim().toLowerCase()}%`;
  return getDb()
    .prepare<[string, string, string, string, number], Row>(
      `SELECT * FROM notes
       WHERE ${VISIBLE_CLAUSE}
         AND (lower(title) LIKE ? OR lower(summary) LIKE ? OR lower(plain_text) LIKE ?)
       ORDER BY published_at DESC
       LIMIT ?`,
    )
    .all(nowIso(), term, term, term, limit)
    .map(toNote);
}

export type AdminListOptions = {
  status?: NoteStatus | "all";
  category?: string;
  query?: string;
  limit?: number;
  offset?: number;
};

export function listForAdmin(options: AdminListOptions = {}): Note[] {
  const { status = "all", category, query, limit = 50, offset = 0 } = options;

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
  if (query?.trim()) {
    conditions.push("(lower(title) LIKE ? OR lower(plain_text) LIKE ?)");
    const term = `%${query.trim().toLowerCase()}%`;
    params.push(term, term);
  }

  params.push(limit, offset);
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  return getDb()
    .prepare<(string | number)[], Row>(
      `SELECT * FROM notes ${where}
       ORDER BY COALESCE(published_at, updated_at) DESC, id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params)
    .map(toNote);
}

export function statusCounts(): { published: number; draft: number; total: number } {
  const rows = getDb()
    .prepare<[], { status: string; total: number }>(
      "SELECT status, COUNT(*) AS total FROM notes GROUP BY status",
    )
    .all();

  const published = rows.find((r) => r.status === "published")?.total ?? 0;
  const draft = rows.find((r) => r.status === "draft")?.total ?? 0;
  return { published, draft, total: published + draft };
}

/**
 * Notas recomendadas: se eligen al azar entre las publicadas en los últimos
 * RECOMMEND_MAX_AGE_DAYS días. Las más viejas quedan archivadas — siguen
 * disponibles por enlace, sección y búsqueda, pero dejan de recomendarse para
 * que la portada no arrastre noticias vencidas.
 */
export function listRecommended(note: Note, limit = 3): Note[] {
  const now = nowIso();
  const cutoff = new Date(
    Date.now() - RECOMMEND_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  return getDb()
    .prepare<[string, string, number, number], Row>(
      `SELECT * FROM notes
       WHERE ${VISIBLE_CLAUSE}
         AND published_at IS NOT NULL
         AND published_at >= ?
         AND id != ?
       ORDER BY RANDOM()
       LIMIT ?`,
    )
    .all(now, cutoff, note.id, limit)
    .map(toNote);
}

/** ¿La nota sigue dentro de la ventana de recomendación? */
export function isRecommendable(note: Note): boolean {
  if (note.status !== "published" || !note.publishedAt) return false;
  const age = Date.now() - new Date(note.publishedAt).getTime();
  return age <= RECOMMEND_MAX_AGE_DAYS * 24 * 60 * 60 * 1000 && age >= 0;
}
