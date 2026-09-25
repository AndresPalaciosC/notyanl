import Link from "next/link";
import { CATEGORIES, SITE } from "@/lib/config";
import { formatDate, nowIso } from "@/lib/dates";
import SocialLinks from "./SocialLinks";

export default function SiteHeader({ active }: { active?: string }) {
  return (
    <header className="border-b border-line bg-paper">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 text-xs text-muted">
        <div className="flex min-w-0 items-center gap-4">
          {/* `capitalize` pondría mayúscula en cada palabra ("7 De Agosto De"). */}
          <span className="hidden first-letter:uppercase lg:block">
            {formatDate(nowIso())}
          </span>
          <SocialLinks />
        </div>

        <div className="flex items-center gap-3">
          <SearchForm />
          <Link href="/admin" className="hidden hover:text-accent sm:block">
            Administrar
          </Link>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-6 text-center">
          <Link href="/" className="inline-block">
            <span className="font-serif text-3xl font-bold tracking-tight text-balance text-ink sm:text-4xl lg:text-5xl">
              {SITE.nameLead} <span className="text-accent">{SITE.nameAccent}</span>
            </span>
          </Link>
          <p className="mt-1.5 text-[10px] uppercase tracking-[0.22em] text-muted sm:text-xs sm:tracking-[0.28em]">
            {SITE.tagline}
          </p>
        </div>
      </div>

      <nav className="border-t border-line bg-ink">
        <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4">
          <NavLink href="/" label="Portada" active={active === "home"} />
          {CATEGORIES.map((category) => (
            <NavLink
              key={category.slug}
              href={`/seccion/${category.slug}`}
              label={category.navLabel}
              active={active === category.slug}
            />
          ))}
        </div>
      </nav>
    </header>
  );
}

function NavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors ${
        active ? "bg-accent text-white" : "text-white/80 hover:bg-white/10 hover:text-white"
      }`}
    >
      {label}
    </Link>
  );
}

function SearchForm() {
  return (
    <form action="/buscar" className="flex items-center">
      <input
        type="search"
        name="q"
        placeholder="Buscar notas…"
        aria-label="Buscar notas"
        className="w-32 rounded-l border border-line bg-surface px-2 py-1 text-xs text-ink outline-none transition-[width] focus:w-48 focus:border-accent sm:w-40"
      />
      <button
        type="submit"
        className="rounded-r border border-l-0 border-line bg-surface px-2 py-1 text-xs text-muted hover:text-accent"
      >
        Buscar
      </button>
    </form>
  );
}
