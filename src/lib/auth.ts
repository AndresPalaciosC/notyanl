import "server-only";
import { cookies } from "next/headers";
import {
  authenticate,
  countUsers,
  ensureSeedUser,
  getUserById,
  type User,
  type UserRole,
} from "./repo/users";

/**
 * Sesión del panel: una cookie firmada con HMAC que sólo guarda quién eres y
 * hasta cuándo vale. Los permisos se leen siempre de la base, así que quitarle
 * el rol a alguien surte efecto en su siguiente petición, sin esperar a que
 * caduque la cookie.
 */

const COOKIE_NAME = "notyac_session";
const SESSION_HOURS = 12;

function textEncoder(): TextEncoder {
  return new TextEncoder();
}

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (secret) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Falta SESSION_SECRET (o ADMIN_PASSWORD) en las variables de entorno.",
    );
  }
  return "notyac-desarrollo-inseguro";
}

/** ¿Hay alguna cuenta con la que se pueda entrar? */
export function isAdminConfigured(): boolean {
  if (countUsers() > 0) return true;
  // Todavía sin cuentas: sólo sirve si el entorno puede sembrar la primera.
  return process.env.NODE_ENV !== "production" || Boolean(process.env.ADMIN_PASSWORD);
}

function base64url(bytes: ArrayBuffer): string {
  return Buffer.from(bytes).toString("base64url");
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder().encode(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder().encode(payload));
  return base64url(signature);
}

/** Comparación en tiempo constante, sin depender de node:crypto. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Valida usuario y contraseña; si son correctos, abre la sesión. */
export async function login(username: string, password: string): Promise<User | null> {
  await ensureSeedUser();

  const user = await authenticate({ username, password });
  if (!user) return null;

  await createSession(user);
  return user;
}

export async function createSession(user: User): Promise<void> {
  const expiresAt = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  const payload = `${user.id}.${user.tokenVersion}.${expiresAt}`;
  const token = `${payload}.${await sign(payload)}`;

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

/** El usuario de la sesión actual, o null si no hay o ya no es válida. */
export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;

  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  if (!safeEqual(signature, await sign(payload))) return null;

  const [rawId, rawVersion, rawExpiry] = payload.split(".");
  const expiresAt = Number(rawExpiry);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;

  const user = getUserById(Number(rawId));
  if (!user || !user.active) return null;

  // Cambiar la contraseña sube tokenVersion y tumba las sesiones anteriores.
  if (user.tokenVersion !== Number(rawVersion)) return null;

  return user;
}

export async function isAuthenticated(): Promise<boolean> {
  return (await currentUser()) !== null;
}

/** Guardia para server actions y route handlers del panel. */
export async function requireAdmin(): Promise<User> {
  const user = await currentUser();
  if (!user) throw new Error("No autorizado. Inicia sesión de nuevo.");
  return user;
}

/** Guardia de las pantallas que sólo toca un administrador (usuarios). */
export async function requireRole(role: UserRole): Promise<User> {
  const user = await requireAdmin();
  if (role === "admin" && user.role !== "admin") {
    throw new Error("Esta sección es sólo para administradores.");
  }
  return user;
}
