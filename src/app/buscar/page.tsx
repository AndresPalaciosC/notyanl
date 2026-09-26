import type { Metadata } from "next";
import SiteHeader from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import BannerSlot from "@/components/site/BannerSlot";
import { NoteCard } from "@/components/site/NoteCard";
import { SIDEBAR_BANNER_COUNT } from "@/lib/config";
import { searchPublished } from "@/lib/repo/notes";
import VisitTracker from "@/components/site/VisitTracker";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Buscar" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const results = query.length >= 2 ? await searchPublished(query) : [];

  return (
    <>
      <VisitTracker path="/buscar" />
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4">
        <div className="mt-8 border-b-2 border-ink pb-3">
          <h1 className="font-serif text-3xl font-bold text-ink">Buscar</h1>
          {query && (
            <p className="mt-1 text-sm text-muted">
              {results.length} resultado{results.length === 1 ? "" : "s"} para “{query}”
            </p>
          )}
        </div>

        <form action="/buscar" className="mt-6 flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Escribe una palabra o frase…"
            aria-label="Buscar notas"
            className="flex-1 rounded border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="rounded bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-dark"
          >
            Buscar
          </button>
        </form>

        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            {query.length < 2 ? (
              <p className="py-12 text-sm text-muted">
                Escribe al menos dos caracteres para buscar entre las notas publicadas.
              </p>
            ) : results.length ? (
              <div className="grid gap-8 sm:grid-cols-2">
                {results.map((note) => (
                  <NoteCard key={note.id} note={note} />
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-line bg-surface px-6 py-14 text-center text-sm text-muted">
                No se encontraron notas que coincidan con “{query}”.
              </p>
            )}
          </div>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <BannerSlot position="sidebar" count={SIDEBAR_BANNER_COUNT} />
          </aside>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
