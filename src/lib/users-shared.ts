/**
 * Lo que el panel necesita saber de los usuarios y que también es seguro de
 * importar desde componentes de cliente: tipos y constantes, sin acceso a la
 * base. La lógica vive en `lib/repo/users.ts`, que sí es sólo de servidor.
 */

export type UserRole = "admin" | "editor";

export type User = {
  id: number;
  username: string;
  name: string;
  role: UserRole;
  active: boolean;
  /** Sube al cambiar la contraseña: invalida las sesiones ya abiertas. */
  tokenVersion: number;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
};

export const ROLES: { value: UserRole; label: string; hint: string }[] = [
  {
    value: "admin",
    label: "Administrador",
    hint: "Todo el panel, incluida la creación de usuarios.",
  },
  {
    value: "editor",
    label: "Editor",
    hint: "Notas, publicidad y estadísticas. No administra usuarios.",
  },
];

export function roleLabel(role: string): string {
  return ROLES.find((r) => r.value === role)?.label ?? role;
}

export const MIN_PASSWORD_LENGTH = 8;
