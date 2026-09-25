import { SITE } from "./config";

/** ISO en UTC, el formato en que se guarda todo en la base. */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Diferencia entre la hora del sitio y UTC en un instante dado, en ms.
 * Se calcula con Intl para que no dependa de la zona horaria del servidor:
 * en hosting compartido casi siempre es UTC, pero la redacción trabaja en
 * horario de México.
 */
function siteOffsetMs(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SITE.timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});

  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );

  return asUtc - date.getTime();
}

/** Fecha YYYY-MM-DD en hora del sitio, para agrupar los contadores por día. */
export function dayInSiteZone(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SITE.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Rango de los últimos `days` días (incluye hoy), en hora del sitio. */
export function lastDays(days: number): { from: string; to: string } {
  const to = dayInSiteZone();
  const from = dayInSiteZone(new Date(Date.now() - (days - 1) * 86_400_000));
  return { from, to };
}

/** Convierte el valor de un <input type="datetime-local"> (hora de México) a ISO UTC. */
export function localInputToIso(value: string | null | undefined): string | null {
  if (!value) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;

  const [, year, month, day, hour, minute] = match.map(Number) as unknown as number[];
  const naive = Date.UTC(year, month - 1, day, hour, minute);

  // Dos pasadas: la segunda corrige los cambios de horario de verano.
  let utc = naive - siteOffsetMs(new Date(naive));
  utc = naive - siteOffsetMs(new Date(utc));

  return new Date(utc).toISOString();
}

/** Convierte un ISO UTC al formato que espera <input type="datetime-local">. */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const shifted = new Date(date.getTime() + siteOffsetMs(date));
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-` +
    `${pad(shifted.getUTCDate())}T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`
  );
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "Sin fecha";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat(SITE.locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: SITE.timeZone,
  }).format(date);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(SITE.locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: SITE.timeZone,
  }).format(date);
}

/** "hace 3 horas" para listados de redacción. */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  const diffMs = date.getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat(SITE.locale, { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 1000 * 60 * 60 * 24 * 365],
    ["month", 1000 * 60 * 60 * 24 * 30],
    ["day", 1000 * 60 * 60 * 24],
    ["hour", 1000 * 60 * 60],
    ["minute", 1000 * 60],
  ];

  for (const [unit, ms] of units) {
    if (Math.abs(diffMs) >= ms) return rtf.format(Math.round(diffMs / ms), unit);
  }
  return "hace un momento";
}
