import { NextResponse } from "next/server";
import { bump, bumpMany } from "@/lib/repo/stats";
import { recordImpressions } from "@/lib/repo/banners";

const VISIT_COOKIE = "notyac_v";
/** Una visita termina tras media hora sin actividad, como en analítica web. */
const VISIT_MINUTES = 30;

const BOT_PATTERN =
  /bot|crawler|spider|crawling|facebookexternalhit|slurp|bingpreview|headless|lighthouse|pingdom|preview/i;

type Payload = {
  path?: string;
  noteId?: number;
  banners?: number[];
};

export async function POST(request: Request) {
  // Los rastreadores no ejecutan JavaScript, pero algunos sí: se filtran aquí
  // para que las cifras reflejen personas.
  const agent = request.headers.get("user-agent") ?? "";
  if (BOT_PATTERN.test(agent)) {
    return NextResponse.json({ ok: true, ignored: "bot" });
  }

  let payload: Payload;
  try {
    payload = (await request.json()) as Payload;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Reporte de banners vistos: no abre ni renueva la visita.
  if (Array.isArray(payload.banners) && payload.banners.length) {
    const ids = payload.banners
      .map(Number)
      .filter((id) => Number.isInteger(id) && id > 0)
      .slice(0, 30);

    await bumpMany(ids.map((id) => ({ metric: "banner_view" as const, ref: id })));
    // El acumulado histórico vive junto al banner para poder listarlo sin cruces.
    await recordImpressions(ids);
    return NextResponse.json({ ok: true });
  }

  const isNewVisit = !request.headers
    .get("cookie")
    ?.split(";")
    .some((part) => part.trim().startsWith(`${VISIT_COOKIE}=`));

  if (isNewVisit) bump("visit");
  bump("pageview");

  if (Number.isInteger(payload.noteId) && Number(payload.noteId) > 0) {
    bump("note", Number(payload.noteId));
  }

  const response = NextResponse.json({ ok: true, newVisit: isNewVisit });

  // Se renueva en cada página para que una lectura larga siga siendo una visita.
  response.cookies.set(VISIT_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VISIT_MINUTES * 60,
  });

  return response;
}
