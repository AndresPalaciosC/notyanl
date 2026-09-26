"use client";

import { useFormStatus } from "react-dom";

type Props = {
  /** Server action que recibe el formulario. */
  action: (formData: FormData) => void | Promise<void>;
  /** Campos ocultos que identifican lo que se va a borrar. */
  fields: Record<string, string | number>;
  /** Texto del cuadro de confirmación. */
  confirm: string;
  label: string;
  pendingLabel?: string;
  className?: string;
};

/**
 * Botón para acciones que no se pueden deshacer: pide confirmación antes de
 * enviar y se bloquea mientras corre, para que un doble clic no dispare dos
 * borrados.
 */
export default function ConfirmButton({
  action,
  fields,
  confirm,
  label,
  pendingLabel = "Eliminando…",
  className = "text-accent hover:underline",
}: Props) {
  return (
    <form action={action}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Submit
        confirm={confirm}
        label={label}
        pendingLabel={pendingLabel}
        className={className}
      />
    </form>
  );
}

function Submit({
  confirm,
  label,
  pendingLabel,
  className,
}: {
  confirm: string;
  label: string;
  pendingLabel: string;
  className: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm(confirm)) event.preventDefault();
      }}
      className={`${className} disabled:opacity-50`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
