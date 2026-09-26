"use client";

import { useActionState, useRef } from "react";
import { uploadMediaAction, type MediaState } from "@/app/admin/actions";
import { IMPORT_ACCEPT_IMAGES } from "@/lib/config";

const INITIAL: MediaState = {};

/**
 * Alta de imágenes a la galería. Admite varias a la vez: al cargar una nota
 * suelen subirse todas sus fotos de golpe.
 */
export default function MediaUploadForm() {
  const [state, formAction, pending] = useActionState(uploadMediaAction, INITIAL);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form
      action={(formData) => {
        formAction(formData);
        // El input se limpia para que no se resuba lo mismo por error.
        if (inputRef.current) inputRef.current.value = "";
      }}
      className="space-y-3"
    >
      <div>
        <label
          htmlFor="files"
          className="block text-xs font-medium uppercase tracking-wider text-muted"
        >
          Imágenes
        </label>
        <input
          ref={inputRef}
          id="files"
          name="files"
          type="file"
          multiple
          accept={IMPORT_ACCEPT_IMAGES}
          required
          className="mt-1.5 w-full rounded border border-line bg-paper px-3 py-2 text-sm outline-none file:mr-3 file:rounded file:border-0 file:bg-surface-strong file:px-3 file:py-1 file:text-sm file:text-ink hover:file:bg-line focus:border-accent"
        />
        <p className="mt-1 text-xs text-muted">
          JPG, PNG, WebP, AVIF o GIF. Hasta 25 MB cada una. Puedes elegir varias.
        </p>
      </div>

      {state.notice && (
        <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {state.notice}
        </p>
      )}
      {state.error && (
        <p className="rounded bg-accent-soft px-3 py-2 text-sm text-accent-dark">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-ink px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent disabled:opacity-60"
      >
        {pending ? "Subiendo…" : "Subir imágenes"}
      </button>
    </form>
  );
}
