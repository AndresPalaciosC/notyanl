import { pickRotation } from "@/lib/repo/banners";
import type { BannerPosition } from "@/lib/config";
import BannerRotator from "./BannerRotator";

/** Cuántos anuncios como máximo se turnan dentro de un mismo hueco. */
const PER_SLOT = 4;

type Props = {
  position: BannerPosition;
  count?: number;
  className?: string;
  /** Muestra un hueco marcado cuando no hay banners cargados para esa posición. */
  showPlaceholder?: boolean;
};

/**
 * Hueco publicitario. El reparto de anuncios se sortea (ponderado por peso) en
 * cada petición, y dentro del hueco se van turnando solos cada pocos segundos,
 * así que un mismo lector ve varios anunciantes sin recargar la página.
 */
export default function BannerSlot({
  position,
  count = 1,
  className = "",
  showPlaceholder = true,
}: Props) {
  const groups = pickRotation(position, count, PER_SLOT);

  // Las impresiones NO se cuentan al renderizar: las reporta VisitTracker
  // cuando el banner entra de verdad en la pantalla del lector.
  if (!groups.length && !showPlaceholder) return null;

  return (
    <div className={className}>
      {/* A 3.75:1 un banner a todo lo ancho mide casi 300 px de alto y se come
          el pliegue, así que el hueco superior se limita a un ancho de lectura. */}
      <div className={position === "top" ? "mx-auto max-w-3xl" : ""}>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
          Publicidad
        </p>
        <div className="space-y-3">
          {groups.length ? (
            groups.map((banners) => (
              <BannerRotator
                key={banners[0].id}
                // Al cliente sólo baja lo que se pinta: nada de pesos, fechas
                // ni contadores.
                banners={banners.map((banner) => ({
                  id: banner.id,
                  title: banner.title,
                  advertiser: banner.advertiser,
                  imageUrl: banner.imageUrl,
                  width: banner.width,
                  height: banner.height,
                  linkUrl: banner.linkUrl,
                }))}
                // El banner superior está sobre el pliegue: no debe diferirse.
                eager={position === "top"}
              />
            ))
          ) : (
            <Placeholder />
          )}
        </div>
      </div>
    </div>
  );
}

function Placeholder() {
  return (
    <div className="flex aspect-[3.75/1] w-full items-center justify-center rounded-md border border-dashed border-line bg-surface">
      <span className="text-xs text-muted">Espacio disponible</span>
    </div>
  );
}
