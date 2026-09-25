"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { saveSocialAction, type SettingsState } from "@/app/admin/actions";
import { BrandIcon, type IconName } from "@/components/site/icons";

const INITIAL: SettingsState = {};

type Network = { key: string; label: string; icon: IconName; placeholder: string };

export default function SocialForm({
  networks,
  values,
}: {
  networks: Network[];
  values: Record<string, string>;
}) {
  const [state, formAction] = useActionState(saveSocialAction, INITIAL);

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-line bg-paper p-5">
      <div>
        <h2 className="font-serif text-lg font-bold text-ink">Redes sociales</h2>
        <p className="mt-1 text-xs text-muted">
          Pega la dirección completa de cada perfil. Las que dejes vacías no aparecen
          en el sitio.
        </p>
      </div>

      <div className="space-y-3">
        {networks.map((network) => (
          <label key={network.key} className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line text-ink-soft">
              <BrandIcon name={network.icon} />
            </span>
            <span className="w-24 shrink-0 text-sm text-ink-soft">{network.label}</span>
            <input
              type="url"
              name={network.key}
              defaultValue={values[network.key] ?? ""}
              placeholder={network.placeholder}
              className="min-w-0 flex-1 rounded border border-line px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </label>
        ))}
      </div>

      {state.error && (
        <p className="rounded bg-accent-soft px-3 py-2 text-sm text-accent-dark">
          {state.error}
        </p>
      )}
      {state.notice && (
        <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {state.notice}
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
      className="rounded bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-60"
    >
      {pending ? "Guardando…" : "Guardar redes sociales"}
    </button>
  );
}
