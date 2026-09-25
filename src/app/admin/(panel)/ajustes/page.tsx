import type { Metadata } from "next";
import SocialForm from "@/components/admin/SocialForm";
import { SOCIAL_NETWORKS, socialSettings } from "@/lib/repo/settings";
import { CATEGORIES, RECOMMEND_MAX_AGE_DAYS, SITE } from "@/lib/config";

export const metadata: Metadata = { title: "Ajustes" };
export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const values = socialSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-ink">Ajustes</h1>
        <p className="mt-1 text-sm text-muted">
          Lo que se puede cambiar sin tocar código.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <SocialForm
          networks={SOCIAL_NETWORKS.map((network) => ({
            key: network.key,
            label: network.label,
            icon: network.icon,
            placeholder: network.placeholder,
          }))}
          values={values}
        />

        <aside className="space-y-4">
          <section className="rounded-lg border border-line bg-paper p-5 text-sm">
            <h2 className="font-serif text-base font-bold text-ink">
              Se cambian en el código
            </h2>
            <p className="mt-1 text-xs text-muted">
              En <code className="rounded bg-surface px-1">src/lib/config.ts</code>.
            </p>

            <dl className="mt-4 space-y-3">
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted">
                  Nombre del sitio
                </dt>
                <dd className="text-ink">{SITE.name}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted">Secciones</dt>
                <dd className="text-ink">
                  {CATEGORIES.map((category) => category.label).join(" · ")}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted">
                  Ventana de recomendación
                </dt>
                <dd className="text-ink">
                  {RECOMMEND_MAX_AGE_DAYS} días
                  <p className="mt-0.5 text-xs text-muted">
                    Pasado ese plazo la nota deja de aparecer en “También te puede
                    interesar”, pero sigue disponible por su enlace, por sección y por
                    búsqueda.
                  </p>
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-line bg-paper p-5 text-sm">
            <h2 className="font-serif text-base font-bold text-ink">
              Compartir en redes
            </h2>
            <p className="mt-1 text-xs text-muted">
              Cada nota lleva botones para compartir por WhatsApp, Facebook, X y
              Threads, además de copiar el enlace. En celular también aparece la opción
              del sistema, que incluye Instagram y TikTok. No requiere configuración.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
