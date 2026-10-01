import Link from "next/link";
import { getCategory } from "@/lib/config";
import { formatDate } from "@/lib/dates";
import type { Note } from "@/lib/repo/notes";

export function CategoryBadge({ slug }: { slug: string }) {
  const category = getCategory(slug);
  return (
    // `self-start` evita que el distintivo se estire al ancho de la tarjeta
    // cuando el contenedor es un flex en columna.
    <span
      className={`inline-block self-start px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white ${category.accent}`}
    >
      {category.label}
    </span>
  );
}

function Cover({
  note,
  className,
  priority = false,
}: {
  note: Note;
  className: string;
  /** La imagen de apertura no se difiere: suele ser el elemento mas grande. */
  priority?: boolean;
}) {
  if (!note.coverUrl) {
    return (
      <div
        className={`${className} flex items-center justify-center bg-surface-strong`}
        aria-hidden
      >
        <span className="font-serif text-3xl text-muted/50">{note.title.charAt(0)}</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={note.coverUrl}
      alt={note.coverAlt || note.title}
      // Las medidas acompanan a la proporcion 16/9 que fija la clase: el
      // navegador reserva el hueco antes de descargar y la pagina no salta.
      width={1600}
      height={900}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding={priority ? "sync" : "async"}
      className={`${className} bg-surface object-cover`}
    />
  );
}

/** Nota principal de la portada. */
export function HeroCard({
  note,
  as: Heading = "h2",
}: {
  note: Note;
  /** h1 en la portada, donde este titular es el encabezado de la pagina. */
  as?: "h1" | "h2";
}) {
  return (
    <article className="group">
      {/* Sin foto no se dibuja un bloque gris gigante: la entrada queda como
          un titular de plana, que es lo que hace un diario impreso. */}
      {note.coverUrl && (
        <Link href={`/nota/${note.slug}`} className="block">
          <Cover
            note={note}
            className="aspect-[16/9] w-full rounded-md"
            priority={Heading === "h1"}
          />
        </Link>
      )}

      <div className={note.coverUrl ? "mt-4" : ""}>
        <CategoryBadge slug={note.category} />
        <Heading className="mt-2 font-serif text-3xl leading-tight text-ink sm:text-4xl">
          <Link href={`/nota/${note.slug}`} className="group-hover:text-accent">
            {note.title}
          </Link>
        </Heading>
        <p className="mt-3 line-clamp-3 text-[15px] leading-relaxed text-ink-soft">
          {note.summary}
        </p>
        <Meta note={note} className="mt-3" />
      </div>
    </article>
  );
}

/** Tarjeta estándar para rejillas de notas. */
export function NoteCard({ note }: { note: Note }) {
  return (
    <article className="group flex flex-col">
      <Link href={`/nota/${note.slug}`}>
        <Cover note={note} className="aspect-[16/9] w-full rounded-md" />
      </Link>

      <div className="mt-3 flex flex-1 flex-col">
        <CategoryBadge slug={note.category} />
        <h3 className="mt-2 font-serif text-xl leading-snug text-ink">
          <Link href={`/nota/${note.slug}`} className="group-hover:text-accent">
            {note.title}
          </Link>
        </h3>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-soft">
          {note.summary}
        </p>
        <Meta note={note} className="mt-auto pt-3" />
      </div>
    </article>
  );
}

/** Fila compacta para listas laterales ("lo más reciente"). */
export function NoteRow({ note, index }: { note: Note; index?: number }) {
  return (
    <article className="group flex gap-3 border-b border-line pb-3 last:border-0">
      {index !== undefined && (
        <span className="font-serif text-2xl leading-none text-accent/40">
          {String(index + 1).padStart(2, "0")}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-3 text-sm font-medium leading-snug text-ink">
          <Link href={`/nota/${note.slug}`} className="group-hover:text-accent">
            {note.title}
          </Link>
        </h3>
        <p className="mt-1 text-xs text-muted">{formatDate(note.publishedAt)}</p>
      </div>
    </article>
  );
}

function Meta({ note, className = "" }: { note: Note; className?: string }) {
  return (
    <p className={`text-xs text-muted ${className}`}>
      {note.author && <span className="text-ink-soft">{note.author} · </span>}
      {formatDate(note.publishedAt)}
    </p>
  );
}
