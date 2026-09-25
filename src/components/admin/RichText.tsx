"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export type RichTextHandle = {
  getHtml: () => string;
  setHtml: (html: string) => void;
  focus: () => void;
};

type Props = {
  initialHtml: string;
  onChange?: (html: string) => void;
  /** Sube una imagen y devuelve su URL, o null si falló. */
  onUploadImage: (file: File) => Promise<string | null>;
};

/** Etiquetas que sobreviven al pegar desde Word, Google Docs o el navegador. */
const ALLOWED_TAGS = new Set([
  "P", "BR", "HR",
  "H2", "H3", "H4",
  "STRONG", "B", "EM", "I", "U", "S", "SUP", "SUB",
  "UL", "OL", "LI",
  "BLOCKQUOTE", "FIGURE", "FIGCAPTION",
  "A", "IMG",
  "TABLE", "THEAD", "TBODY", "TR", "TH", "TD",
]);

const DROP_TAGS = new Set(["STYLE", "SCRIPT", "META", "LINK", "TITLE", "HEAD"]);

const RENAME_TAGS: Record<string, string> = { H1: "H2", H5: "H4", H6: "H4", DIV: "P" };

/** Limpia el HTML pegado dejando sólo estructura, sin estilos de Word. */
function cleanPastedHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");

  for (const element of Array.from(doc.body.querySelectorAll("*"))) {
    const tag = element.tagName.toUpperCase();

    if (DROP_TAGS.has(tag)) {
      element.remove();
      continue;
    }

    const renamed = RENAME_TAGS[tag];
    if (renamed) {
      const replacement = doc.createElement(renamed);
      while (element.firstChild) replacement.appendChild(element.firstChild);
      element.replaceWith(replacement);
      continue;
    }

    if (!ALLOWED_TAGS.has(tag)) {
      unwrap(element);
      continue;
    }

    for (const attribute of Array.from(element.attributes)) {
      const keep =
        (tag === "A" && attribute.name === "href") ||
        (tag === "IMG" && (attribute.name === "src" || attribute.name === "alt")) ||
        ((tag === "TD" || tag === "TH") &&
          (attribute.name === "colspan" || attribute.name === "rowspan"));

      if (!keep) element.removeAttribute(attribute.name);
    }
  }

  return doc.body.innerHTML;
}

function unwrap(element: Element): void {
  const parent = element.parentNode;
  if (!parent) return;
  while (element.firstChild) parent.insertBefore(element.firstChild, element);
  parent.removeChild(element);
}

type ToolbarButton = {
  label: string;
  title: string;
  command: string;
  value?: string;
  /** Nombre del estado a consultar con queryCommandState. */
  state?: string;
  className?: string;
};

const INLINE_BUTTONS: ToolbarButton[] = [
  { label: "B", title: "Negrita (Ctrl+B)", command: "bold", state: "bold", className: "font-bold" },
  { label: "I", title: "Cursiva (Ctrl+I)", command: "italic", state: "italic", className: "italic" },
  { label: "U", title: "Subrayado", command: "underline", state: "underline", className: "underline" },
  { label: "S", title: "Tachado", command: "strikeThrough", state: "strikeThrough", className: "line-through" },
];

const BLOCK_BUTTONS: ToolbarButton[] = [
  { label: "Párrafo", title: "Texto normal", command: "formatBlock", value: "<p>" },
  { label: "Título 2", title: "Subtítulo principal", command: "formatBlock", value: "<h2>" },
  { label: "Título 3", title: "Subtítulo secundario", command: "formatBlock", value: "<h3>" },
  { label: "Cita", title: "Cita destacada", command: "formatBlock", value: "<blockquote>" },
];

const LIST_BUTTONS: ToolbarButton[] = [
  { label: "• Lista", title: "Lista con viñetas", command: "insertUnorderedList", state: "insertUnorderedList" },
  { label: "1. Lista", title: "Lista numerada", command: "insertOrderedList", state: "insertOrderedList" },
];

const RichText = forwardRef<RichTextHandle, Props>(function RichText(
  { initialHtml, onChange, onUploadImage },
  ref,
) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // El evento de pegado no expone las teclas modificadoras: se siguen aparte.
  const shiftHeldRef = useRef(false);
  const [activeStates, setActiveStates] = useState<Record<string, boolean>>({});
  const [showSource, setShowSource] = useState(false);
  const [sourceValue, setSourceValue] = useState("");
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState({ words: 0, minutes: 1 });

  const measure = useCallback(() => {
    const text = editorRef.current?.innerText ?? "";
    const words = text.split(/\s+/).filter(Boolean).length;
    setStats({ words, minutes: Math.max(1, Math.round(words / 200)) });
  }, []);

  const sync = useCallback(() => {
    const html = editorRef.current?.innerHTML ?? "";
    measure();
    onChange?.(html);
  }, [measure, onChange]);

  useImperativeHandle(ref, () => ({
    getHtml: () => (showSource ? sourceValue : (editorRef.current?.innerHTML ?? "")),
    setHtml: (html: string) => {
      if (editorRef.current) editorRef.current.innerHTML = html;
      setSourceValue(html);
      measure();
      onChange?.(html);
    },
    focus: () => editorRef.current?.focus(),
  }));

  // Contenido inicial: se escribe una sola vez para no pelear con el cursor.
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = initialHtml;
      setSourceValue(initialHtml);
      measure();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // `bold` produce <b> en vez de <span style>, más limpio al guardar.
  useEffect(() => {
    try {
      document.execCommand("styleWithCSS", false, "false");
    } catch {
      /* algunos navegadores no lo soportan; no es crítico */
    }
  }, []);

  useEffect(() => {
    const track = (event: KeyboardEvent) => {
      shiftHeldRef.current = event.shiftKey;
    };

    window.addEventListener("keydown", track);
    window.addEventListener("keyup", track);
    return () => {
      window.removeEventListener("keydown", track);
      window.removeEventListener("keyup", track);
    };
  }, []);

  useEffect(() => {
    const refresh = () => {
      if (!editorRef.current?.contains(document.getSelection()?.anchorNode ?? null)) {
        return;
      }
      const next: Record<string, boolean> = {};
      for (const button of [...INLINE_BUTTONS, ...LIST_BUTTONS]) {
        if (!button.state) continue;
        try {
          next[button.state] = document.queryCommandState(button.state);
        } catch {
          next[button.state] = false;
        }
      }
      setActiveStates(next);
    };

    document.addEventListener("selectionchange", refresh);
    return () => document.removeEventListener("selectionchange", refresh);
  }, []);

  const exec = useCallback(
    (command: string, value?: string) => {
      editorRef.current?.focus();
      document.execCommand(command, false, value);
      sync();
    },
    [sync],
  );

  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      const html = event.clipboardData.getData("text/html");
      const text = event.clipboardData.getData("text/plain");

      // Con Shift se pega en texto plano; el atajo habitual de las redacciones.
      if (!html || shiftHeldRef.current) {
        if (!text) return;
        event.preventDefault();
        document.execCommand("insertText", false, text);
        sync();
        return;
      }

      event.preventDefault();
      document.execCommand("insertHTML", false, cleanPastedHtml(html));
      sync();
    },
    [sync],
  );

  const insertLink = useCallback(() => {
    const url = window.prompt("Dirección del enlace (https://…)");
    if (!url) return;
    exec("createLink", url);
  }, [exec]);

  const handleImage = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const url = await onUploadImage(file);
        if (url) exec("insertHTML", `<img src="${url}" alt="" /><p><br /></p>`);
      } finally {
        setUploading(false);
      }
    },
    [exec, onUploadImage],
  );

  const toggleSource = useCallback(() => {
    if (showSource) {
      if (editorRef.current) editorRef.current.innerHTML = sourceValue;
      setShowSource(false);
      measure();
      onChange?.(sourceValue);
    } else {
      setSourceValue(editorRef.current?.innerHTML ?? "");
      setShowSource(true);
    }
  }, [measure, onChange, showSource, sourceValue]);

  return (
    <div className="rounded-lg border border-line bg-paper">
      <div className="flex flex-wrap items-center gap-1 border-b border-line px-2 py-2">
        {INLINE_BUTTONS.map((button) => (
          <ToolButton
            key={button.command}
            button={button}
            active={button.state ? activeStates[button.state] : false}
            onClick={() => exec(button.command, button.value)}
          />
        ))}

        <Divider />

        {BLOCK_BUTTONS.map((button) => (
          <ToolButton
            key={button.value}
            button={button}
            onClick={() => exec(button.command, button.value)}
          />
        ))}

        <Divider />

        {LIST_BUTTONS.map((button) => (
          <ToolButton
            key={button.command}
            button={button}
            active={button.state ? activeStates[button.state] : false}
            onClick={() => exec(button.command, button.value)}
          />
        ))}

        <Divider />

        <ToolButton
          button={{ label: "Enlace", title: "Insertar enlace", command: "createLink" }}
          onClick={insertLink}
        />
        <ToolButton
          button={{ label: "Quitar enlace", title: "Quitar enlace", command: "unlink" }}
          onClick={() => exec("unlink")}
        />
        <ToolButton
          button={{
            label: uploading ? "Subiendo…" : "Imagen",
            title: "Insertar imagen en el cuerpo",
            command: "image",
          }}
          onClick={() => fileRef.current?.click()}
        />
        <ToolButton
          button={{ label: "Línea", title: "Separador horizontal", command: "insertHorizontalRule" }}
          onClick={() => exec("insertHorizontalRule")}
        />

        <Divider />

        <ToolButton
          button={{ label: "Limpiar", title: "Quitar formato de la selección", command: "removeFormat" }}
          onClick={() => exec("removeFormat")}
        />
        <ToolButton
          button={{ label: "Deshacer", title: "Deshacer (Ctrl+Z)", command: "undo" }}
          onClick={() => exec("undo")}
        />
        <ToolButton
          button={{ label: "Rehacer", title: "Rehacer (Ctrl+Y)", command: "redo" }}
          onClick={() => exec("redo")}
        />

        <button
          type="button"
          onClick={toggleSource}
          title="Ver o editar el HTML de la nota"
          className={`ml-auto rounded px-2 py-1 text-xs font-medium ${
            showSource ? "bg-ink text-white" : "text-muted hover:bg-surface hover:text-ink"
          }`}
        >
          HTML
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void handleImage(file);
        }}
      />

      {showSource ? (
        <textarea
          value={sourceValue}
          onChange={(event) => setSourceValue(event.target.value)}
          spellCheck={false}
          className="min-h-[28rem] w-full resize-y bg-surface p-4 font-mono text-xs leading-relaxed outline-none"
        />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Cuerpo de la nota"
          data-placeholder="Escribe el cuerpo de la nota, o carga un documento de Word o PDF arriba…"
          onInput={sync}
          onBlur={sync}
          onPaste={handlePaste}
          className="note-body note-editor min-h-[28rem] px-6 py-5"
        />
      )}

      <div className="flex items-center justify-between border-t border-line px-3 py-1.5 text-xs text-muted">
        <span>
          {stats.words.toLocaleString("es-MX")} palabras · {stats.minutes} min de lectura
        </span>
        <span className="hidden sm:block">
          Pegar con Shift inserta texto sin formato
        </span>
      </div>
    </div>
  );
});

function ToolButton({
  button,
  active,
  onClick,
}: {
  button: ToolbarButton;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={button.title}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`rounded px-2 py-1 text-xs transition-colors ${button.className ?? ""} ${
        active ? "bg-ink text-white" : "text-ink-soft hover:bg-surface hover:text-ink"
      }`}
    >
      {button.label}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-4 w-px bg-line" aria-hidden />;
}

export default RichText;
