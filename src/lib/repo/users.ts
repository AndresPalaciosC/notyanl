import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { execute, query, queryOne } from "../db";
import { nowIso } from "../dates";
import { MIN_PASSWORD_LENGTH, type User, type UserRole } from "../users-shared";

export {
  MIN_PASSWORD_LENGTH,
  ROLES,
  roleLabel,
  type User,
  type UserRole,
} from "../users-shared";

/**
 * Cuentas del panel. Cada persona entra con su usuario y su contraseña, y
 * queda registro de cuándo entró por última vez.
 *
 * Las contraseñas nunca se guardan en claro: se derivan con scrypt y una sal
 * distinta por usuario. Ni el panel ni la base pueden mostrarlas de vuelta.
 */

/** Error con mensaje pensado para mostrarse tal cual en el panel. */
export class UserError extends Error {}

type Row = {
  id: number;
  username: string;
  name: string;
  password_hash: string;
  role: string;
  active: number;
  token_version: number;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
};

function toUser(row: Row): User {
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    role: row.role === "admin" ? "admin" : "editor",
    active: row.active === 1,
    tokenVersion: row.token_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
  };
}

/* ------------------------------------------------------------- contraseñas */

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(plain.normalize("NFKC"), salt, KEY_LENGTH);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyHash(plain: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, keyHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;

  const expected = Buffer.from(keyHex, "hex");
  const key = await scryptAsync(
    plain.normalize("NFKC"),
    Buffer.from(saltHex, "hex"),
    expected.length || KEY_LENGTH,
  );

  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Contraseña legible pero difícil de adivinar, para altas y restablecimientos. */
export function suggestPassword(): string {
  // Sin caracteres que se confundan al dictarla por teléfono (O/0, l/1, I).
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (const byte of randomBytes(14)) out += alphabet[byte % alphabet.length];
  return `${out.slice(0, 5)}-${out.slice(5, 9)}-${out.slice(9)}`;
}

/* ------------------------------------------------------------ validaciones */

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

function assertUsername(username: string): void {
  if (username.length < 3 || username.length > 32) {
    throw new UserError("El usuario debe tener entre 3 y 32 caracteres.");
  }
  if (!/^[a-z0-9._-]+$/.test(username)) {
    throw new UserError(
      "El usuario sólo admite letras sin acento, números, punto, guion y guion bajo.",
    );
  }
}

export function assertPassword(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new UserError(
      `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    );
  }
  if (password.length > 200) {
    throw new UserError("La contraseña es demasiado larga.");
  }
}

function toRole(value: string): UserRole {
  return value === "admin" ? "admin" : "editor";
}

/* --------------------------------------------------------------- consultas */

export async function listUsers(): Promise<User[]> {
  const rows = await query<Row>(
    "SELECT * FROM users ORDER BY active DESC, username ASC",
  );
  return rows.map(toUser);
}

export async function getUserById(id: number): Promise<User | null> {
  const row = await queryOne<Row>("SELECT * FROM users WHERE id = ?", [id]);
  return row ? toUser(row) : null;
}

async function getRowByUsername(username: string): Promise<Row | null> {
  return queryOne<Row>("SELECT * FROM users WHERE username = ?", [
    normalizeUsername(username),
  ]);
}

export async function countUsers(): Promise<number> {
  const row = await queryOne<{ total: number }>(
    "SELECT COUNT(*) AS total FROM users",
  );
  return Number(row?.total ?? 0);
}

/** Administradores activos sin contar al que se está por modificar. */
async function countOtherActiveAdmins(exceptId: number): Promise<number> {
  const row = await queryOne<{ total: number }>(
    "SELECT COUNT(*) AS total FROM users WHERE role = 'admin' AND active = 1 AND id != ?",
    [exceptId],
  );
  return Number(row?.total ?? 0);
}

/* --------------------------------------------------------------- escritura */

export type NewUser = {
  username: string;
  name: string;
  password: string;
  role: string;
};

export async function createUser(input: NewUser): Promise<User> {
  const username = normalizeUsername(input.username);
  assertUsername(username);
  assertPassword(input.password);

  if (await getRowByUsername(username)) {
    throw new UserError(`El usuario "${username}" ya existe.`);
  }

  const timestamp = nowIso();
  const result = await execute(
    `INSERT INTO users
       (username, name, password_hash, role, active, token_version, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, 1, ?, ?)`,
    [
      username,
      input.name.trim() || username,
      await hashPassword(input.password),
      toRole(input.role),
      timestamp,
      timestamp,
    ],
  );

  return (await getUserById(result.insertId))!;
}

export async function updateUser(
  id: number,
  patch: { name?: string; role?: string; active?: boolean },
): Promise<User> {
  const current = await getUserById(id);
  if (!current) throw new UserError("Ese usuario ya no existe.");

  const role = patch.role === undefined ? current.role : toRole(patch.role);
  const active = patch.active ?? current.active;

  // El sitio no puede quedarse sin nadie que administre usuarios.
  if ((role !== "admin" || !active) && (await countOtherActiveAdmins(id)) === 0) {
    throw new UserError(
      "Debe quedar al menos un administrador activo. Nombra a otro antes de cambiar este.",
    );
  }

  await execute(
    "UPDATE users SET name = ?, role = ?, active = ?, updated_at = ? WHERE id = ?",
    [patch.name?.trim() || current.name, role, active ? 1 : 0, nowIso(), id],
  );

  return (await getUserById(id))!;
}

export async function setPassword(id: number, plain: string): Promise<void> {
  assertPassword(plain);
  if (!(await getUserById(id))) throw new UserError("Ese usuario ya no existe.");

  await execute(
    `UPDATE users
       SET password_hash = ?, token_version = token_version + 1, updated_at = ?
     WHERE id = ?`,
    [await hashPassword(plain), nowIso(), id],
  );
}

export async function deleteUser(id: number): Promise<void> {
  const current = await getUserById(id);
  if (!current) return;

  if (
    current.role === "admin" &&
    current.active &&
    (await countOtherActiveAdmins(id)) === 0
  ) {
    throw new UserError(
      "Es el único administrador activo. Crea otro antes de eliminar esta cuenta.",
    );
  }

  await execute("DELETE FROM users WHERE id = ?", [id]);
}

export async function recordLogin(id: number): Promise<void> {
  await execute("UPDATE users SET last_login_at = ? WHERE id = ?", [nowIso(), id]);
}

/* -------------------------------------------------------- inicio de sesión */

export type Credentials = { username: string; password: string };

/**
 * Devuelve el usuario si las credenciales son correctas. Cuando el nombre no
 * existe se hace igualmente un scrypt de descarte, para que el tiempo de
 * respuesta no delate qué cuentas están dadas de alta.
 */
export async function authenticate({
  username,
  password,
}: Credentials): Promise<User | null> {
  const row = await getRowByUsername(username);

  if (!row) {
    await verifyHash(password, await hashPassword("cuenta-inexistente"));
    return null;
  }

  const ok = await verifyHash(password, row.password_hash);
  if (!ok || row.active !== 1) return null;

  await recordLogin(row.id);
  return toUser(row);
}

/**
 * Crea la primera cuenta a partir del entorno cuando la base está vacía, para
 * que una instalación nueva tenga por dónde entrar. En cuanto existe un
 * usuario, ADMIN_PASSWORD deja de tener efecto.
 */
export async function ensureSeedUser(): Promise<void> {
  if ((await countUsers()) > 0) return;

  const password =
    process.env.ADMIN_PASSWORD ||
    (process.env.NODE_ENV === "production" ? "" : "admin1234");
  if (!password) return;

  try {
    await createUser({
      username: normalizeUsername(process.env.ADMIN_USER || "admin"),
      name: process.env.ADMIN_NAME || "Administrador",
      password,
      role: "admin",
    });
  } catch {
    // Otra petición simultánea pudo crearla primero: no es un error.
  }
}
