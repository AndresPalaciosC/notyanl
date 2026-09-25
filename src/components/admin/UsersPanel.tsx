"use client";

import { useActionState, useState } from "react";
import {
  changeOwnPasswordAction,
  createUserAction,
  manageUserAction,
  type UserActionState,
} from "@/app/admin/actions";
import { MIN_PASSWORD_LENGTH, ROLES, type User } from "@/lib/users-shared";
import { formatDateTime, relativeTime } from "@/lib/dates";

const INITIAL: UserActionState = {};

const FIELD =
  "mt-1.5 w-full rounded border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent";
const LABEL = "block text-xs font-medium uppercase tracking-wider text-muted";

/* ------------------------------------------------------------------ avisos */

function Feedback({ state }: { state: UserActionState }) {
  if (!state.error && !state.notice) return null;

  return (
    <p
      className={`rounded px-3 py-2 text-sm ${
        state.error
          ? "bg-accent-soft text-accent-dark"
          : "bg-emerald-50 text-emerald-800"
      }`}
    >
      {state.error ?? state.notice}
    </p>
  );
}

/**
 * La contraseña sólo se puede leer en este momento: se guarda derivada, así que
 * después no hay forma de recuperarla, únicamente de asignar otra.
 */
function Credentials({ value }: { value: { username: string; password: string } }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        `Usuario: ${value.username}\nContraseña: ${value.password}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin permiso de portapapeles queda el texto a la vista para copiarlo a mano.
    }
  };

  return (
    <div className="rounded border border-amber-300 bg-amber-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-amber-900">
        Anota estos datos ahora
      </p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-sm text-ink">
        <dt className="text-muted">Usuario</dt>
        <dd className="break-all">{value.username}</dd>
        <dt className="text-muted">Contraseña</dt>
        <dd className="break-all">{value.password}</dd>
      </dl>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={copy}
          className="rounded border border-amber-400 px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
        >
          {copied ? "Copiado" : "Copiar"}
        </button>
        <span className="text-xs text-amber-900">
          No se vuelven a mostrar: al salir de esta pantalla desaparecen.
        </span>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- alta de cuenta */

export function NewUserForm() {
  const [state, formAction, pending] = useActionState(createUserAction, INITIAL);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="new-username" className={LABEL}>
            Usuario
          </label>
          <input
            id="new-username"
            name="username"
            required
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="jperez"
            className={FIELD}
          />
          <p className="mt-1 text-xs text-muted">
            Con el que entra al panel. Minúsculas, sin acentos ni espacios.
          </p>
        </div>

        <div>
          <label htmlFor="new-name" className={LABEL}>
            Nombre
          </label>
          <input
            id="new-name"
            name="name"
            placeholder="Juana Pérez"
            className={FIELD}
          />
          <p className="mt-1 text-xs text-muted">Como aparecerá dentro del panel.</p>
        </div>

        <div>
          <label htmlFor="new-role" className={LABEL}>
            Permisos
          </label>
          <select id="new-role" name="role" defaultValue="editor" className={FIELD}>
            {ROLES.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted">
            El editor carga notas y publicidad; el administrador además da de alta
            usuarios.
          </p>
        </div>

        <div>
          <label htmlFor="new-password" className={LABEL}>
            Contraseña
          </label>
          <input
            id="new-password"
            name="password"
            type="text"
            autoComplete="off"
            placeholder="Se genera sola si la dejas vacía"
            className={FIELD}
          />
          <p className="mt-1 text-xs text-muted">
            Mínimo {MIN_PASSWORD_LENGTH} caracteres. Déjala vacía y el sistema crea
            una segura.
          </p>
        </div>
      </div>

      <Feedback state={state} />
      {state.credentials && <Credentials value={state.credentials} />}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-ink px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent disabled:opacity-60"
      >
        {pending ? "Creando…" : "Crear usuario"}
      </button>
    </form>
  );
}

/* ------------------------------------------------------------ fila de lista */

export function UserRow({ user, isSelf }: { user: User; isSelf: boolean }) {
  const [state, formAction, pending] = useActionState(manageUserAction, INITIAL);

  return (
    <li className="px-4 py-4">
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="id" value={user.id} />

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-sm text-ink">
              {user.username}
              {isSelf && <span className="ml-2 text-xs text-muted">(tú)</span>}
              {!user.active && (
                <span className="ml-2 rounded-full bg-surface-strong px-2 py-0.5 text-[11px] font-medium text-ink-soft">
                  Sin acceso
                </span>
              )}
            </p>
            <input
              name="name"
              defaultValue={user.name}
              aria-label={`Nombre de ${user.username}`}
              className={FIELD}
            />
          </div>

          <div className="w-44">
            <label className={LABEL} htmlFor={`role-${user.id}`}>
              Permisos
            </label>
            <select
              id={`role-${user.id}`}
              name="role"
              defaultValue={user.role}
              className={FIELD}
            >
              {ROLES.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            name="intent"
            value="update"
            disabled={pending}
            className="rounded border border-line px-3 py-2 text-sm font-medium text-ink-soft hover:border-accent hover:text-accent disabled:opacity-60"
          >
            Guardar
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <label className={LABEL} htmlFor={`password-${user.id}`}>
              Contraseña nueva
            </label>
            <input
              id={`password-${user.id}`}
              name="password"
              type="text"
              autoComplete="off"
              placeholder="Vacío: se genera una segura"
              className={FIELD}
            />
          </div>

          <button
            type="submit"
            name="intent"
            value="reset"
            disabled={pending}
            className="rounded border border-line px-3 py-2 text-sm font-medium text-ink-soft hover:border-accent hover:text-accent disabled:opacity-60"
          >
            Restablecer
          </button>

          {!isSelf && (
            <>
              <button
                type="submit"
                name="intent"
                value="toggle"
                disabled={pending}
                className="rounded border border-line px-3 py-2 text-sm font-medium text-ink-soft hover:border-accent hover:text-accent disabled:opacity-60"
              >
                {user.active ? "Quitar acceso" : "Devolver acceso"}
              </button>

              <button
                type="submit"
                name="intent"
                value="delete"
                disabled={pending}
                onClick={(event) => {
                  if (
                    !confirm(
                      `¿Eliminar la cuenta de ${user.name}? Sus notas se conservan.`,
                    )
                  ) {
                    event.preventDefault();
                  }
                }}
                className="rounded border border-line px-3 py-2 text-sm font-medium text-accent hover:border-accent disabled:opacity-60"
              >
                Eliminar
              </button>
            </>
          )}
        </div>

        <p className="text-xs text-muted">
          Alta {formatDateTime(user.createdAt)} ·{" "}
          {user.lastLoginAt
            ? `última entrada ${relativeTime(user.lastLoginAt)}`
            : "todavía no ha entrado"}
        </p>

        <Feedback state={state} />
        {state.credentials && <Credentials value={state.credentials} />}
      </form>
    </li>
  );
}

/* ------------------------------------------------------- contraseña propia */

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changeOwnPasswordAction, INITIAL);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="current-password" className={LABEL}>
            Contraseña actual
          </label>
          <input
            id="current-password"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            className={FIELD}
          />
        </div>

        <div>
          <label htmlFor="next-password" className={LABEL}>
            Nueva
          </label>
          <input
            id="next-password"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            required
            className={FIELD}
          />
        </div>

        <div>
          <label htmlFor="repeat-password" className={LABEL}>
            Repite la nueva
          </label>
          <input
            id="repeat-password"
            name="repeatPassword"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            required
            className={FIELD}
          />
        </div>
      </div>

      <Feedback state={state} />

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-ink px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Cambiar mi contraseña"}
      </button>
    </form>
  );
}
