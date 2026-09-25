import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import BannerSlot from "@/components/site/BannerSlot";
import { CategoryBadge, NoteCard, NoteRow } from "@/components/site/NoteCard";
import { SIDEBAR_BANNER_COUNT, getCategory } from "@/lib/config";
import { formatDate } from "@/lib/dates";
import { readingMinutes } from "@/lib/sanitize";
import { getBySlug, listPublished, listRecommended } from "@/lib/repo/notes";
import ShareButtons from "@/components/site/ShareButtons";
import VisitTracker from "@/components/site/VisitTracker";
import { absoluteUrl } from "@/lib/url";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const note = getBySlug(slug, { publishedOnly: true });
  if (!note) return { title: "Nota no encontrada" };

  const canonical = `/nota/${note.slug}`;
  const images = note.coverUrl ? [note.coverUrl] : undefined;

  return {
    title: note.title,
    description: note.summary,
    // La direccion buena de la nota, para que Google no la trate como copia
    // cuando llega con parametros de campana o desde una red social.
    alternates: { canonical },
    openGraph: {
      title: note.title,
      description: note.summary,
      type: "article",
      url: canonical,
      publishedTime: note.publishedAt ?? undefined,
      modifiedTime: note.updatedAt,
      authors: note.author ? [note.author] : undefined,
      section: getCategory(note.category).label,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: note.title,
      description: note.summary,
      images,
    },
  };
}

export default async function NotePage({ params }: Props) {
  const { slug } = await params;
  const note = getBySlug(slug, { publishedOnly: true });
  if (!note) notFound();

  const category = getCategory(note.category);
  const related = listRecommended(note, 3);
  const recent = listPublished({ limit: 6, excludeIds: [note.id] });
  const shareUrl = await absoluteUrl(`/nota/${note.slug}`);

  return (
    <>
      <VisitTracker path={`/nota/${note.slug}`} noteId={note.id} />
      <SiteHeader active={note.category} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4">
        <BannerSlot position="top" className="mt-6" showPlaceholder={false} />

        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          <article className="min-w-0">
            <nav className="text-xs text-muted">
              <Link href="/" className="hover:text-accent">
                Portada
              </Link>
              <span className="mx-1.5">/</span>
              <Link href={`/seccion/${note.category}`} className="hover:text-accent">
                {category.label}
              </Link>
            </nav>

            <header className="mt-4">
              <CategoryBadge slug={note.category} />
              <h1 className="mt-3 font-serif text-3xl leading-tight text-ink sm:text-[2.75rem]">
                {note.title}
              </h1>

              {note.summary && (
                <p className="mt-4 font-serif text-xl leading-relaxed text-ink-soft">
                  {note.summary}
                </p>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 border-y border-line py-3 text-xs text-muted">
                {note.author && (
                  <span className="font-medium text-ink">Por {note.author}</span>
                )}
                <span>{formatDate(note.publishedAt)}</span>
                <span>· {readingMinutes(note.plainText)} min de lectura</span>
              </div>
            </header>

            {note.coverUrl && (
              <figure className="mt-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={note.coverUrl}
                  alt={note.coverAlt || note.title}
                  className="w-full rounded-md bg-surface object-cover"
                />
                {note.coverAlt && (
                  <figcaption className="mt-2 text-xs text-muted">
                    {note.coverAlt}
                  </figcaption>
                )}
              </figure>
            )}

            {/* El HTML se saneó contra una lista blanca al guardarse. */}
            <div
              className="note-body mt-8"
              dangerouslySetInnerHTML={{ __html: note.bodyHtml }}
            />

            <div className="mt-8 border-y border-line py-4">
              <ShareButtons url={shareUrl} title={note.title} />
            </div>

            <BannerSlot position="inline" className="mt-12" showPlaceholder={false} />

            {related.length > 0 && (
              <section className="mt-12">
                <h2 className="mb-6 border-b-2 border-ink pb-2 font-serif text-xl font-bold text-ink">
                  También te puede interesar
                </h2>
                <div className="grid gap-8 sm:grid-cols-3">
                  {related.map((item) => (
                    <NoteCard key={item.id} note={item} />
                  ))}
                </div>
              </section>
            )}
          </article>

          <aside className="space-y-8 lg:sticky lg:top-6 lg:self-start">
            <BannerSlot position="sidebar" count={SIDEBAR_BANNER_COUNT} />

            {recent.length > 0 && (
              <section>
                <h2 className="mb-4 border-b-2 border-ink pb-2 font-serif text-lg font-bold text-ink">
                  Lo más reciente
                </h2>
                <div className="space-y-3">
                  {recent.map((item, index) => (
                    <NoteRow key={item.id} note={item} index={index} />
                  ))}
                </div>
              </section>
            )}
          </aside>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
