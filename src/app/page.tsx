import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import BannerSlot from "@/components/site/BannerSlot";
import { HeroCard, NoteCard, NoteRow } from "@/components/site/NoteCard";
import { CATEGORIES, SIDEBAR_BANNER_COUNT } from "@/lib/config";
import { listPublished } from "@/lib/repo/notes";
import { orEmpty } from "@/lib/resilient";
import VisitTracker from "@/components/site/VisitTracker";

// La publicidad se sortea en cada visita, así que la portada no se cachea.
export const metadata: Metadata = {
  // La portada vive en la raiz: sin canonical, cualquier variante con
  // parametros de campana se indexa como pagina distinta.
  alternates: { canonical: "/" },
};

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Si la base no responde, la portada sale vacia pero en pie: un 500 aqui
  // tumbaria el sitio entero y el hosting daria el despliegue por fallido.
  const featuredList = await orEmpty(listPublished({ limit: 1, featuredOnly: true }));
  const fallback = featuredList.length
    ? featuredList
    : await orEmpty(listPublished({ limit: 1 }));
  const hero = fallback[0] ?? null;

  const latest = await orEmpty(
    listPublished({ limit: 6, excludeIds: hero ? [hero.id] : [] }),
  );

  const recent = await orEmpty(listPublished({ limit: 6 }));

  return (
    <>
      <VisitTracker path="/" />
      <SiteHeader active="home" />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4">
        <BannerSlot position="top" className="mt-6" showPlaceholder={false} />

        {!hero ? (
          <EmptyState />
        ) : (
          <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0">
              <HeroCard note={hero} as="h1" />

              {latest.length > 0 && (
                <>
                  <SectionTitle>Últimas notas</SectionTitle>
                  <div className="grid gap-8 sm:grid-cols-2">
                    {latest.map((note) => (
                      <NoteCard key={note.id} note={note} />
                    ))}
                  </div>
                </>
              )}

              <BannerSlot position="inline" className="mt-10" showPlaceholder={false} />

              {CATEGORIES.map((category) => (
                <CategoryBlock key={category.slug} slug={category.slug} label={category.label} />
              ))}
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
        )}
      </main>

      <SiteFooter />
    </>
  );
}

async function CategoryBlock({ slug, label }: { slug: string; label: string }) {
  const notes = await orEmpty(listPublished({ category: slug, limit: 3 }));
  if (!notes.length) return null;

  return (
    <section>
      <div className="mt-12 mb-6 flex items-baseline justify-between border-b-2 border-ink pb-2">
        <h2 className="font-serif text-2xl font-bold text-ink">{label}</h2>
        <Link
          href={`/seccion/${slug}`}
          className="text-xs font-medium uppercase tracking-wider text-accent hover:underline"
        >
          Ver todas
        </Link>
      </div>
      <div className="grid gap-8 sm:grid-cols-3">
        {notes.map((note) => (
          <NoteCard key={note.id} note={note} />
        ))}
      </div>
    </section>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-12 mb-6 border-b-2 border-ink pb-2 font-serif text-2xl font-bold text-ink">
      {children}
    </h2>
  );
}

function EmptyState() {
  return (
    <div className="my-20 rounded-lg border border-dashed border-line bg-surface px-6 py-16 text-center">
      <h1 className="font-serif text-2xl font-bold text-ink">
        Todavía no hay notas publicadas
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Entra al panel de administración, carga un documento de Word o PDF y publícalo
        para que aparezca aquí.
      </p>
      <Link
        href="/admin"
        className="mt-6 inline-block rounded bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-dark"
      >
        Ir al panel
      </Link>
    </div>
  );
}
