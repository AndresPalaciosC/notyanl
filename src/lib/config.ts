/**
 * Configuración global del sitio.
 * Este archivo es seguro de importar desde componentes de cliente: sólo constantes.
 */

export const SITE = {
  /** Nombre editorial: es el que ve el lector en la cabecera y en los títulos. */
  name: "Noticias de Actualidad MTY",
  /** El nombre partido, para destacar "MTY" en la cabecera. */
  nameLead: "Noticias de Actualidad",
  nameAccent: "MTY",
  tagline: "Política, economía y más, desde Monterrey",
  description:
    "Cobertura diaria de política, economía y temas de interés general en Monterrey y Nuevo León.",
  locale: "es-MX",
  timeZone: "America/Mexico_City",
} as const;

export type CategorySlug =
  | "mundo"
  | "pais"
  | "nuevo-leon"
  | "cultura"
  | "espectaculos"
  | "deportes"
  | "ciencia";

export type Category = {
  slug: CategorySlug;
  /** Nombre completo: encabezado de la sección y distintivo de las notas. */
  label: string;
  /** Versión corta para la barra de navegación, que debe caber en una línea. */
  navLabel: string;
  description: string;
  /** Clase de color del distintivo de sección. */
  accent: string;
};

export const CATEGORIES: Category[] = [
  {
    slug: "mundo",
    label: "Actualidad Mundial",
    navLabel: "Mundial",
    description: "Lo que ocurre fuera de México y cómo nos afecta.",
    accent: "bg-indigo-700",
  },
  {
    slug: "pais",
    label: "El País",
    navLabel: "El País",
    description: "Política, economía y sociedad a nivel nacional.",
    accent: "bg-accent",
  },
  {
    slug: "nuevo-leon",
    label: "Actualidad Nuevo León",
    navLabel: "Nuevo León",
    description: "Monterrey y el estado: gobierno, obra pública y comunidad.",
    accent: "bg-emerald-700",
  },
  {
    slug: "cultura",
    label: "Cultura",
    navLabel: "Cultura",
    description: "Libros, arte, música y patrimonio.",
    accent: "bg-purple-700",
  },
  {
    slug: "espectaculos",
    label: "Espectáculos",
    navLabel: "Espectáculos",
    description: "Cine, televisión, farándula y vida social.",
    accent: "bg-pink-700",
  },
  {
    slug: "deportes",
    label: "Deportes",
    navLabel: "Deportes",
    description: "Fútbol, béisbol y el deporte regiomontano.",
    accent: "bg-amber-600",
  },
  {
    slug: "ciencia",
    label: "Ciencia",
    navLabel: "Ciencia",
    description: "Investigación, salud, tecnología y medio ambiente.",
    accent: "bg-cyan-700",
  },
];

export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug);

/** Sección por omisión cuando el valor guardado ya no existe. */
export const DEFAULT_CATEGORY: CategorySlug = "pais";

export function getCategory(slug: string): Category {
  return (
    CATEGORIES.find((c) => c.slug === slug) ??
    CATEGORIES.find((c) => c.slug === DEFAULT_CATEGORY)!
  );
}

export function isCategorySlug(value: string): value is CategorySlug {
  return CATEGORY_SLUGS.includes(value as CategorySlug);
}

/** Relación de aspecto de los banners publicitarios (ancho / alto). */
export const BANNER_ASPECT = 3.75;

/** Tolerancia antes de avisar que una imagen no cumple la proporción. */
export const BANNER_ASPECT_TOLERANCE = 0.12;

export type BannerPosition = "top" | "sidebar" | "inline";

export const BANNER_POSITIONS: {
  value: BannerPosition;
  label: string;
  hint: string;
  recommended: string;
}[] = [
  {
    value: "top",
    label: "Superior",
    hint: "Franja ancha debajo del encabezado, visible en todas las páginas.",
    recommended: "1500 × 400 px",
  },
  {
    value: "sidebar",
    label: "Costado",
    hint: "Columna lateral del home y de las notas. Rota en cada visita.",
    recommended: "750 × 200 px",
  },
  {
    value: "inline",
    label: "Intercalado",
    hint: "Entre bloques de notas del home y dentro del cuerpo de la nota.",
    recommended: "1200 × 320 px",
  },
];

export function bannerPositionLabel(value: string): string {
  return BANNER_POSITIONS.find((p) => p.value === value)?.label ?? value;
}

/** Cuántos banners se muestran por hueco. */
export const SIDEBAR_BANNER_COUNT = 3;

/**
 * Antigüedad máxima, en días, para que una nota siga apareciendo en
 * "También te puede interesar". Pasado ese plazo queda archivada: sigue
 * accesible por su enlace, por sección y por búsqueda, pero ya no se recomienda.
 */
export const RECOMMEND_MAX_AGE_DAYS = 2;

/** Formatos de imagen que acepta el selector de archivos. */
export const IMPORT_ACCEPT_IMAGES = "image/jpeg,image/png,image/webp,image/avif,image/gif";

/** Extensiones aceptadas al importar una nota. */
export const IMPORT_ACCEPT = ".docx,.pdf,.txt,.html,.htm,.md";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB
