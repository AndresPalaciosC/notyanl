"use client";

import { useEffect, useState } from "react";
import { BrandIcon, type IconName } from "./icons";

type Props = { url: string; title: string };

/**
 * Botones para compartir la nota. WhatsApp primero porque es como más se
 * reenvían las notas desde el celular.
 */
export default function ShareButtons({ url, title }: Props) {
  const [copied, setCopied] = useState(false);
  const [canShareNatively, setCanShareNatively] = useState(false);

  // La hoja de compartir del sistema sólo existe en móvil: se pregunta en el
  // cliente para no romper la hidratación.
  useEffect(() => {
    setCanShareNatively(typeof navigator !== "undefined" && "share" in navigator);
  }, []);

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const targets: { label: string; icon: IconName; href: string; color: string }[] = [
    {
      label: "WhatsApp",
      icon: "whatsapp",
      href: `https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}`,
      color: "hover:bg-[#25D366] hover:border-[#25D366]",
    },
    {
      label: "Facebook",
      icon: "facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      color: "hover:bg-[#1877F2] hover:border-[#1877F2]",
    },
    {
      label: "X",
      icon: "x",
      href: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
      color: "hover:bg-black hover:border-black",
    },
    {
      label: "Threads",
      icon: "threads",
      href: `https://www.threads.net/intent/post?text=${encodedTitle}%20${encodedUrl}`,
      color: "hover:bg-black hover:border-black",
    },
  ];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copia el enlace:", url);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-xs font-medium uppercase tracking-wider text-muted">
        Compartir
      </span>

      {targets.map((target) => (
        <a
          key={target.label}
          href={target.href}
          target="_blank"
          rel="noopener noreferrer"
          title={`Compartir por ${target.label}`}
          aria-label={`Compartir por ${target.label}`}
          className={`flex size-9 items-center justify-center rounded-full border border-line text-ink-soft transition-colors hover:text-white ${target.color}`}
        >
          <BrandIcon name={target.icon} />
        </a>
      ))}

      <button
        type="button"
        onClick={copy}
        title="Copiar enlace"
        aria-label="Copiar enlace"
        className="flex size-9 items-center justify-center rounded-full border border-line text-ink-soft transition-colors hover:border-accent hover:bg-accent hover:text-white"
      >
        <BrandIcon name="link" />
      </button>

      {copied && <span className="text-xs text-emerald-700">Enlace copiado</span>}

      {canShareNatively && (
        <button
          type="button"
          onClick={() => void navigator.share({ title, url }).catch(() => {})}
          className="flex items-center gap-1.5 rounded-full border border-line px-3 py-2 text-xs font-medium text-ink-soft transition-colors hover:border-accent hover:text-accent"
        >
          <BrandIcon name="share" className="size-3.5" />
          Más
        </button>
      )}
    </div>
  );
}
