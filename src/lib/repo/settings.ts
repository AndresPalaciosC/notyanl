import "server-only";
import { getDb } from "../db";
import { nowIso } from "../dates";
import type { IconName } from "@/components/site/icons";

/**
 * Ajustes editables desde el panel. Se guardan como texto en la tabla
 * `settings` para no tener que tocar código al cambiar una red social.
 */

export type SocialKey =
  | "facebook"
  | "instagram"
  | "tiktok"
  | "x"
  | "threads"
  | "whatsapp";

export const SOCIAL_NETWORKS: {
  key: SocialKey;
  label: string;
  icon: IconName;
  placeholder: string;
}[] = [
  { key: "facebook", label: "Facebook", icon: "facebook", placeholder: "https://facebook.com/tu-pagina" },
  { key: "instagram", label: "Instagram", icon: "instagram", placeholder: "https://instagram.com/tu-cuenta" },
  { key: "tiktok", label: "TikTok", icon: "tiktok", placeholder: "https://tiktok.com/@tu-cuenta" },
  { key: "x", label: "X", icon: "x", placeholder: "https://x.com/tu-cuenta" },
  { key: "threads", label: "Threads", icon: "threads", placeholder: "https://threads.net/@tu-cuenta" },
  { key: "whatsapp", label: "WhatsApp", icon: "whatsapp", placeholder: "https://wa.me/528112345678" },
];

export type SocialLink = { key: SocialKey; label: string; icon: IconName; url: string };

function get(key: string): string {
  const row = getDb()
    .prepare<[string], { value: string }>("SELECT value FROM settings WHERE key = ?")
    .get(key);
  return row?.value ?? "";
}

export function setSetting(key: string, value: string): void {
  getDb()
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(key, value.trim(), nowIso());
}

/** Las URL configuradas, en el orden en que se muestran. Omite las vacías. */
export function listSocialLinks(): SocialLink[] {
  return SOCIAL_NETWORKS.map((network) => ({
    key: network.key,
    label: network.label,
    icon: network.icon,
    url: get(`social.${network.key}`),
  })).filter((link) => isSafeUrl(link.url));
}

/** Todas las redes con su valor actual, para el formulario del panel. */
export function socialSettings(): Record<SocialKey, string> {
  const out = {} as Record<SocialKey, string>;
  for (const network of SOCIAL_NETWORKS) out[network.key] = get(`social.${network.key}`);
  return out;
}

export function saveSocialSettings(values: Partial<Record<SocialKey, string>>): void {
  for (const network of SOCIAL_NETWORKS) {
    const value = values[network.key];
    if (value !== undefined) setSetting(`social.${network.key}`, value);
  }
}

/** Sólo http(s): evita que un enlace guardado pueda ejecutar javascript:. */
function isSafeUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
