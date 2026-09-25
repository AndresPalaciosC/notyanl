import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import { SITE } from "@/lib/config";
import { siteUrl } from "@/lib/url";
import "./globals.css";

const body = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const headline = Source_Serif_4({
  variable: "--font-headline",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  // Sin esto las imagenes de vista previa se quedan en ruta relativa y ni
  // WhatsApp ni Facebook las muestran al compartir una nota.
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  openGraph: {
    type: "website",
    siteName: SITE.name,
    locale: "es_MX",
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${body.variable} ${headline.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-paper text-ink">{children}</body>
    </html>
  );
}
