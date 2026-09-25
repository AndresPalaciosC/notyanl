import Link from "next/link";
import { CATEGORIES, SITE } from "@/lib/config";
import SocialLinks from "./SocialLinks";

export default function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <p className="font-serif text-2xl font-bold text-ink">
            {SITE.nameLead} <span className="text-accent">{SITE.nameAccent}</span>
          </p>
          <p className="mt-2 max-w-xs text-sm text-muted">{SITE.description}</p>
          <SocialLinks variant="block" className="mt-4" />
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Secciones
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {CATEGORIES.map((category) => (
              <li key={category.slug}>
                <Link
                  href={`/seccion/${category.slug}`}
                  className="text-ink-soft hover:text-accent"
                >
                  {category.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Sitio
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/buscar" className="text-ink-soft hover:text-accent">
                Buscar
              </Link>
            </li>
            <li>
              <Link href="/admin" className="text-ink-soft hover:text-accent">
                Panel de administración
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-muted">
          © {new Date().getFullYear()} {SITE.name}. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}
