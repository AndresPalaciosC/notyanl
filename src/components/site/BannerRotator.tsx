"use client";

import { useEffect, useState } from "react";

export type RotatingBanner = {
  id: number;
  title: string;
  advertiser: string;
  imageUrl: string;
  width: number | null;
  height: number | null;
  linkUrl: string;
};

type Props = {
  banners: RotatingBanner[];
  /** El hueco superior está sobre el pliegue: su primera imagen no se difiere. */
  eager?: boolean;
  intervalMs?: number;
};

/**
 * Un hueco publicitario que va alternando entre los anuncios que le tocaron.
 *
 * Todos se pintan desde el servidor y se ocultan con `hidden` en vez de
 * montarse y desmontarse: así el observador de impresiones de VisitTracker los
 * toma desde el principio y cuenta cada anuncio cuando de verdad aparece en
 * pantalla, no cuando se carga la página.
 */
export default function BannerRotator({
  banners,
  eager = false,
  intervalMs = 8000,
}: Props) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (banners.length < 2) return;

    const timer = setInterval(() => {
      // En una pestaña de fondo nadie está viendo: no se gastan impresiones.
      if (document.visibilityState !== "visible") return;
      setIndex((current) => (current + 1) % banners.length);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [banners.length, intervalMs]);

  return (
    <div className="relative">
      {banners.map((banner, position) => (
        <BannerImage
          key={banner.id}
          banner={banner}
          hidden={position !== index}
          eager={eager && position === 0}
        />
      ))}

      {banners.length > 1 && (
        <div className="mt-1.5 flex justify-end gap-1" aria-hidden="true">
          {banners.map((banner, position) => (
            <span
              key={banner.id}
              className={`h-1 w-4 rounded-full transition-colors ${
                position === index ? "bg-muted" : "bg-line"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BannerImage({
  banner,
  hidden,
  eager,
}: {
  banner: RotatingBanner;
  hidden: boolean;
  eager: boolean;
}) {
  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={banner.imageUrl}
      alt={banner.title}
      // Sin medidas reales se declaran las de la proporcion 3.75:1 que fija
      // la clase, para que el navegador reserve el hueco igualmente.
      width={banner.width ?? 1500}
      height={banner.height ?? 400}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : undefined}
      // Marca que VisitTracker observa para contar la impresión.
      data-banner-id={banner.id}
      className="aspect-[3.75/1] w-full rounded-md border border-line bg-surface object-cover"
    />
  );

  // Se oculta con `display:none` (clase `hidden`), no con opacidad: así el
  // anuncio tapado no cuenta como visto mientras espera su turno.
  if (!banner.linkUrl) {
    return <div className={hidden ? "hidden" : "block"}>{image}</div>;
  }

  return (
    <a
      href={`/r/${banner.id}`}
      target="_blank"
      rel="noopener sponsored"
      title={banner.advertiser || banner.title}
      className={
        hidden ? "hidden" : "block transition-opacity hover:opacity-90"
      }
    >
      {image}
    </a>
  );
}
