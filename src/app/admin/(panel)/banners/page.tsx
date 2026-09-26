import type { Metadata } from "next";
import BannerUploadForm from "@/components/admin/BannerUploadForm";
import { BANNER_POSITIONS, type BannerPosition } from "@/lib/config";
import { formatDateTime, isoToLocalInput } from "@/lib/dates";
import { listBanners, type Banner } from "@/lib/repo/banners";
import {
  deleteBannerAction,
  toggleBannerAction,
  updateBannerAction,
} from "@/app/admin/actions";
import ConfirmButton from "@/components/admin/ConfirmButton";

export const metadata: Metadata = { title: "Publicidad" };
export const dynamic = "force-dynamic";

export default async function BannersPage() {
  const all = await listBanners();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-ink">Publicidad</h1>
        <p className="mt-1 text-sm text-muted">
          Los banners activos de cada ubicación se sortean en cada visita, así que la
          publicidad cambia cada vez que alguien entra al sitio.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-6 lg:self-start">
          <BannerUploadForm />
        </div>

        <div className="space-y-8">
          {BANNER_POSITIONS.map((position) => (
            <PositionGroup
              key={position.value}
              position={position.value}
              label={position.label}
              hint={position.hint}
              banners={all.filter((banner) => banner.position === position.value)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function PositionGroup({
  position,
  label,
  hint,
  banners,
}: {
  position: BannerPosition;
  label: string;
  hint: string;
  banners: Banner[];
}) {
  const active = banners.filter((banner) => banner.active).length;

  return (
    <section>
      <div className="mb-3 border-b border-line pb-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-serif text-lg font-bold text-ink">{label}</h2>
          <span className="text-xs text-muted">
            {active} activo{active === 1 ? "" : "s"} de {banners.length}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted">{hint}</p>
      </div>

      {banners.length ? (
        <ul className="space-y-3">
          {banners.map((banner) => (
            <BannerRow key={banner.id} banner={banner} position={position} />
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-line bg-paper px-6 py-8 text-center text-sm text-muted">
          Sin banners en esta ubicación.
        </p>
      )}
    </section>
  );
}

function BannerRow({ banner }: { banner: Banner; position: BannerPosition }) {
  const ctr = banner.impressions
    ? ((banner.clicks / banner.impressions) * 100).toFixed(1)
    : "0.0";

  return (
    <li
      className={`rounded-lg border bg-paper p-4 ${
        banner.active ? "border-line" : "border-dashed border-line opacity-70"
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={banner.imageUrl}
          alt={banner.title}
          className="aspect-[3.75/1] w-full shrink-0 rounded border border-line bg-surface object-cover sm:w-64"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-ink">{banner.title}</p>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                banner.active
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-surface-strong text-ink-soft"
              }`}
            >
              {banner.active ? "Activo" : "Pausado"}
            </span>
            {banner.weight > 1 && (
              <span className="rounded-full bg-surface-strong px-2 py-0.5 text-[11px] text-ink-soft">
                Peso {banner.weight}
              </span>
            )}
          </div>

          {banner.advertiser && (
            <p className="mt-0.5 text-sm text-muted">{banner.advertiser}</p>
          )}

          <p className="mt-1 text-xs text-muted">
            {banner.width && banner.height
              ? `${banner.width}×${banner.height} px · `
              : ""}
            {banner.impressions.toLocaleString("es-MX")} vistas ·{" "}
            {banner.clicks.toLocaleString("es-MX")} clics · CTR {ctr}%
          </p>

          {(banner.startsAt || banner.endsAt) && (
            <p className="mt-1 text-xs text-muted">
              Vigencia: {banner.startsAt ? formatDateTime(banner.startsAt) : "desde ya"} →{" "}
              {banner.endsAt ? formatDateTime(banner.endsAt) : "sin fin"}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
            <form action={toggleBannerAction}>
              <input type="hidden" name="id" value={banner.id} />
              <button type="submit" className="text-ink-soft hover:text-ink">
                {banner.active ? "Pausar" : "Activar"}
              </button>
            </form>

            <ConfirmButton
              action={deleteBannerAction}
              fields={{ id: banner.id }}
              confirm={`¿Eliminar el banner "${banner.title}"?

Se borra tambien su imagen del disco. No se puede deshacer.`}
              label="Eliminar"
            />

            {banner.linkUrl && (
              <a
                href={banner.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-muted hover:text-ink"
              >
                {banner.linkUrl} ↗
              </a>
            )}
          </div>
        </div>
      </div>

      <details className="mt-4 border-t border-line pt-3">
        <summary className="cursor-pointer text-xs font-medium text-ink-soft hover:text-ink">
          Editar datos
        </summary>

        <form action={updateBannerAction} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="id" value={banner.id} />

          <EditField label="Nombre" name="title" defaultValue={banner.title} />
          <EditField
            label="Anunciante"
            name="advertiser"
            defaultValue={banner.advertiser}
          />
          <EditField
            label="Enlace"
            name="linkUrl"
            type="url"
            defaultValue={banner.linkUrl}
          />

          <label className="block">
            <span className="block text-xs font-medium uppercase tracking-wider text-muted">
              Ubicación
            </span>
            <select
              name="position"
              defaultValue={banner.position}
              className="mt-1 w-full rounded border border-line px-3 py-1.5 text-sm outline-none focus:border-accent"
            >
              {BANNER_POSITIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <EditField
            label="Peso"
            name="weight"
            type="number"
            defaultValue={String(banner.weight)}
          />
          <EditField
            label="Empieza"
            name="startsAt"
            type="datetime-local"
            defaultValue={isoToLocalInput(banner.startsAt)}
          />
          <EditField
            label="Termina"
            name="endsAt"
            type="datetime-local"
            defaultValue={isoToLocalInput(banner.endsAt)}
          />

          <label className="flex items-end gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              name="active"
              defaultChecked={banner.active}
              className="size-4 accent-[#b3121b]"
            />
            Activo
          </label>

          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded border border-ink px-4 py-1.5 text-sm font-medium text-ink hover:bg-ink hover:text-white"
            >
              Guardar cambios
            </button>
          </div>
        </form>
      </details>
    </li>
  );
}

function EditField({
  label,
  name,
  type = "text",
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium uppercase tracking-wider text-muted">
        {label}
      </span>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded border border-line px-3 py-1.5 text-sm outline-none focus:border-accent"
      />
    </label>
  );
}
