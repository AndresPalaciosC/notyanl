"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createBannerAction, type BannerState } from "@/app/admin/actions";
import { BANNER_ASPECT, BANNER_POSITIONS } from "@/lib/config";

const INITIAL: BannerState = {};

export default function BannerUploadForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(createBannerAction, INITIAL);
  const [preview, setPreview] = useState<{
    url: string;
    width: number;
    height: number;
  } | null>(null);

  // Al terminar una carga correcta se limpia el formulario para el siguiente banner.
  useEffect(() => {
    if (state.notice) {
      formRef.current?.reset();
      setPreview(null);
    }
  }, [state.notice]);

  const ratio = preview ? preview.width / preview.height : null;
  const ratioOff = ratio !== null && Math.abs(ratio - BANNER_ASPECT) / BANNER_ASPECT > 0.12;

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-4 rounded-lg border border-line bg-paper p-5"
    >
      <div>
        <h2 className="font-serif text-lg font-bold text-ink">Nuevo banner</h2>
        <p className="mt-1 text-xs text-muted">
          Proporción recomendada {BANNER_ASPECT}:1. Cualquier otra medida se recorta
          centrada al mostrarse.
        </p>
      </div>

      <label className="block">
        <span className="block text-xs font-medium uppercase tracking-wider text-muted">
          Imagen
        </span>
        <input
          type="file"
          name="image"
          accept="image/*"
          required
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) {
              setPreview(null);
              return;
            }
            const url = URL.createObjectURL(file);
            const image = new Image();
            image.onload = () =>
              setPreview({ url, width: image.naturalWidth, height: image.naturalHeight });
            image.src = url;
          }}
          className="mt-1.5 block w-full text-xs text-muted file:mr-3 file:rounded file:border-0 file:bg-surface-strong file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink hover:file:bg-line"
        />
      </label>

      {preview && (
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview.url}
            alt="Vista previa del banner"
            className="aspect-[3.75/1] w-full rounded border border-line bg-surface object-cover"
          />
          <p className={`mt-1.5 text-xs ${ratioOff ? "text-accent" : "text-muted"}`}>
            {preview.width}×{preview.height} px · proporción {ratio?.toFixed(2)}:1
            {ratioOff &&
              ` — se recortará. Para que entre completa usa ${preview.width}×${Math.round(
                preview.width / BANNER_ASPECT,
              )} px.`}
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombre" name="title" placeholder="Campaña octubre" required />
        <Field label="Anunciante" name="advertiser" placeholder="Opcional" />
      </div>

      <Field
        label="Enlace al hacer clic"
        name="linkUrl"
        type="url"
        placeholder="https://ejemplo.com"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="block text-xs font-medium uppercase tracking-wider text-muted">
            Ubicación
          </span>
          <select
            name="position"
            defaultValue="sidebar"
            className="mt-1.5 w-full rounded border border-line px-3 py-2 text-sm outline-none focus:border-accent"
          >
            {BANNER_POSITIONS.map((position) => (
              <option key={position.value} value={position.value}>
                {position.label} — {position.recommended}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-xs font-medium uppercase tracking-wider text-muted">
            Peso en la rotación
          </span>
          <input
            type="number"
            name="weight"
            defaultValue={1}
            min={1}
            max={10}
            className="mt-1.5 w-full rounded border border-line px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Empieza (opcional)" name="startsAt" type="datetime-local" />
        <Field label="Termina (opcional)" name="endsAt" type="datetime-local" />
      </div>

      <label className="flex items-center gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          name="active"
          defaultChecked
          className="size-4 accent-[#b3121b]"
        />
        Activar de inmediato
      </label>

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

function Field({
  label,
  name,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium uppercase tracking-wider text-muted">
        {label}
      </span>
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        required={required}
        className="mt-1.5 w-full rounded border border-line px-3 py-2 text-sm outline-none focus:border-accent"
      />
    </label>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-60"
    >
      {pending ? "Subiendo…" : "Agregar banner"}
    </button>
  );
}
