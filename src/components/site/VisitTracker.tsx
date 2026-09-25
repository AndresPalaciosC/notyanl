"use client";

import { useEffect } from "react";

type Props = { path: string; noteId?: number };

/**
 * Contabiliza la visita desde el navegador, no en el servidor: así no cuentan
 * los rastreadores ni las precargas, y un banner sólo suma "visto" cuando de
 * verdad entró en pantalla.
 */
export default function VisitTracker({ path, noteId }: Props) {
  useEffect(() => {
    const controller = new AbortController();

    // 1) La visita y la página vista se avisan de inmediato: la respuesta trae
    //    la cookie que distingue una visita nueva de una navegación más.
    fetch("/api/hit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, noteId }),
      credentials: "same-origin",
      keepalive: true,
      signal: controller.signal,
    }).catch(() => {
      /* si falla la analítica, la lectura no se interrumpe */
    });

    // 2) Los banners se reportan cuando aparecen en pantalla.
    const pending = new Set<number>();
    const reported = new Set<number>();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const flush = () => {
      if (!pending.size) return;
      const banners = [...pending];
      pending.clear();

      const payload = JSON.stringify({ banners });
      const sent =
        typeof navigator.sendBeacon === "function" &&
        navigator.sendBeacon("/api/hit", new Blob([payload], { type: "application/json" }));

      if (!sent) {
        fetch("/api/hit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          credentials: "same-origin",
          keepalive: true,
        }).catch(() => {});
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;

          const element = entry.target as HTMLElement;
          const id = Number(element.dataset.bannerId);
          observer.unobserve(element);

          if (!id || reported.has(id)) continue;
          reported.add(id);
          pending.add(id);
        }

        if (pending.size) {
          clearTimeout(timer);
          timer = setTimeout(flush, 1500);
        }
      },
      // La mitad del banner visible cuenta como impresión.
      { threshold: 0.5 },
    );

    for (const element of document.querySelectorAll<HTMLElement>("[data-banner-id]")) {
      observer.observe(element);
    }

    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);

    return () => {
      clearTimeout(timer);
      flush();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onHide);
      controller.abort();
    };
  }, [path, noteId]);

  return null;
}
