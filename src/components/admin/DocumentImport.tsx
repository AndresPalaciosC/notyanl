"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { importDocumentAction } from "@/app/admin/actions";
import type { ImportResult } from "@/lib/importers/shared";
import { IMPORT_ACCEPT } from "@/lib/config";

type Props = {
  onImported: (result: ImportResult) => void;
  /** Advierte antes de reemplazar un cuerpo que ya tiene contenido. */
  hasContent: boolean;
};

export default function DocumentImport({ onImported, hasContent }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loaded, setLoaded] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (
        hasContent &&
        !window.confirm(
          "El cuerpo actual se reemplazará con el contenido del documento. ¿Continuar?",
        )
      ) {
        return;
      }

      setError(null);
      setWarnings([]);

      const formData = new FormData();
      formData.append("file", file);

      startTransition(async () => {
        const response = await importDocumentAction(formData);

        if (!response.ok) {
          setError(response.error);
          setLoaded(null);
          return;
        }

        setLoaded(file.name);
        setWarnings(response.result.warnings);
        onImported(response.result);
      });
    },
    [hasContent, onImported],
  );

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors ${
          dragging
            ? "border-accent bg-accent-soft"
            : "border-line bg-paper hover:border-accent hover:bg-surface"
        }`}
      >
        {pending ? (
          <p className="text-sm font-medium text-ink">Leyendo el documento…</p>
        ) : (
          <>
            <p className="text-sm font-medium text-ink">
              Arrastra aquí el documento o haz clic para elegirlo
            </p>
            <p className="mt-1 text-xs text-muted">
              Word (.docx), PDF, texto o HTML · hasta 25 MB
            </p>
            {loaded && (
              <p className="mt-2 text-xs text-emerald-700">
                Cargado: <span className="font-medium">{loaded}</span>
              </p>
            )}
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={IMPORT_ACCEPT}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) handleFile(file);
        }}
      />

      {error && (
        <p className="mt-3 rounded bg-accent-soft px-3 py-2 text-sm text-accent-dark">
          {error}
        </p>
      )}

      {warnings.length > 0 && (
        <ul className="mt-3 space-y-1 rounded bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {warnings.map((warning, index) => (
            <li key={index}>• {warning}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
