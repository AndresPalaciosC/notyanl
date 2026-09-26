import { listSocialLinks } from "@/lib/repo/settings";
import { orEmpty } from "@/lib/resilient";
import { BrandIcon } from "./icons";

type Props = {
  className?: string;
  /** `bar` para la cinta superior, `block` para el pie de página. */
  variant?: "bar" | "block";
};

/** Enlaces a las redes propias. Se configuran en el panel → Ajustes. */
export default async function SocialLinks({ className = "", variant = "bar" }: Props) {
  const links = await orEmpty(listSocialLinks());
  if (!links.length) return null;

  const itemClass =
    variant === "bar"
      ? "text-muted transition-colors hover:text-accent"
      : "flex size-9 items-center justify-center rounded-full border border-line text-ink-soft transition-colors hover:border-accent hover:bg-accent hover:text-white";

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {links.map((link) => (
        <a
          key={link.key}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          title={`Síguenos en ${link.label}`}
          aria-label={`Síguenos en ${link.label}`}
          className={itemClass}
        >
          <BrandIcon name={link.icon} className={variant === "bar" ? "size-4" : "size-4"} />
        </a>
      ))}
    </div>
  );
}
