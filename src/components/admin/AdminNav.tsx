"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/lib/users-shared";

const LINKS = [
  { href: "/admin", label: "Resumen", exact: true },
  { href: "/admin/notas", label: "Notas" },
  { href: "/admin/notas/nueva", label: "Cargar documento" },
  { href: "/admin/imagenes", label: "Imágenes" },
  { href: "/admin/banners", label: "Publicidad" },
  { href: "/admin/estadisticas", label: "Estadísticas" },
  { href: "/admin/ajustes", label: "Ajustes" },
];

/** El editor no administra cuentas: para él esa pestaña es sólo la suya. */
export default function AdminNav({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const links = [
    ...LINKS,
    {
      href: "/admin/usuarios",
      label: role === "admin" ? "Usuarios" : "Mi cuenta",
    },
  ];

  return (
    <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4">
      {links.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "border-accent text-accent"
                : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
