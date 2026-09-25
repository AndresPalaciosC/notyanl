import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import BannerSlot from "@/components/site/BannerSlot";
import { HeroCard, NoteCard, NoteRow } from "@/components/site/NoteCard";
import { SIDEBAR_BANNER_COUNT, getCategory, isCategorySlug } from "@/lib/config";
import { countPublished, listPublished } from "@/lib/repo/notes";
import VisitTracker from "@/components/site/VisitTracker";

export const dynamic = "force-dynamic";

const PER_PAGE = 12;

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ p?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!isCategorySlug(slug)) return { title: "Sección" };

  const category = getCategory(slug);
  return { title: category.label, description: category.description };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  if (!isCategorySlug(slug)) notFound();

  const category = getCategory(slug);
  const { p } = await searchParams;
  const page = Math.max(1, Number(p) || 1);

  const notes = listPublished({
    category: slug,
    limit: PER_PAGE,
    offset: (page - 1) * PER_PAGE,
  });

  const total = countPublished(slug);
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const [lead, ...rest] = notes;
  const recent = listPublished({ limit: 6 });

  return (
    <>
      <VisitTracker path={`/seccion/${slug}`} />
      <SiteHeader active={slug} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4">
        <BannerSlot position="top" className="mt-6" showPlaceholder={false} />

        <div className="mt-8 border-b-2 border-ink pb-3">
          <h1 className="font-serif text-3xl font-bold text-ink sm:text-4xl">
            {category.label}
          </h1>
          <p className="mt-1 text-sm text-muted">{category.description}</p>
        </div>

        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            {!notes.length && (
              <p className="rounded-lg border border-dashed border-line bg-surface px-6 py-14 text-center text-sm text-muted">
                Aún no hay notas publicadas en esta sección.
              </p>
            )}

            {lead && page === 1 && <HeroCard note={lead} />}

            {(page === 1 ? rest : notes).length > 0 && (
              <div className={`grid gap-8 sm:grid-cols-2 ${page === 1 ? "mt-12" : ""}`}>
                {(page === 1 ? rest : notes).map((note) => (
                  <NoteCard key={note.id} note={note} />
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <Pagination slug={slug} page={page} totalPages={totalPages} />
            )}
          </div>

          <aside className="space-y-8 lg:sticky lg:top-6 lg:self-start">
            <BannerSlot position="sidebar" count={SIDEBAR_BANNER_COUNT} />

            {recent.length > 0 && (
              <section>
                <h2 className="mb-4 border-b-2 border-ink pb-2 font-serif text-lg font-bold text-ink">
                  Lo más reciente
                </h2>
                <div className="space-y-3">
                  {recent.map((note, index) => (
                    <NoteRow key={note.id} note={note} index={index} />
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

function Pagination({
  slug,
  page,
  totalPages,
}: {
  slug: string;
  page: number;
  totalPages: number;
}) {
  return (
    <nav className="mt-12 flex items-center justify-between border-t border-line pt-6 text-sm">
      {page > 1 ? (
        <Link
          href={`/seccion/${slug}?p=${page - 1}`}
          className="text-accent hover:underline"
        >
          ← Anteriores
        </Link>
      ) : (
        <span />
      )}

      <span className="text-muted">
        Página {page} de {totalPages}
      </span>

      {page < totalPages ? (
        <Link
          href={`/seccion/${slug}?p=${page + 1}`}
          className="text-accent hover:underline"
        >
          Siguientes →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
