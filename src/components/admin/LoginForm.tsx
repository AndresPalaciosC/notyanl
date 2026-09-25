"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction, type LoginState } from "@/app/admin/actions";

const INITIAL: LoginState = {};

export default function LoginForm() {
  const [state, formAction] = useActionState(loginAction, INITIAL);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label
          htmlFor="username"
          className="block text-xs font-medium uppercase tracking-wider text-muted"
        >
          Usuario
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          required
          className="mt-1.5 w-full rounded border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-xs font-medium uppercase tracking-wider text-muted"
        >
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1.5 w-full rounded border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>

      {state.error && (
        <p className="rounded bg-accent-soft px-3 py-2 text-sm text-accent-dark">
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded bg-ink px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent disabled:opacity-60"
    >
      {pending ? "Entrando…" : "Entrar"}
    </button>
  );
}
