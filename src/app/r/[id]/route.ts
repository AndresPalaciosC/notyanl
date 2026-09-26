import { redirect } from "next/navigation";
import { getBannerById, recordClick } from "@/lib/repo/banners";
import { bump } from "@/lib/repo/stats";

/** Salida de los banners: cuenta el clic y redirige al anunciante. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const banner = await getBannerById(Number(id));

  if (!banner || !banner.linkUrl) redirect("/");

  await recordClick(banner.id); // acumulado histórico
  bump("banner_click", banner.id); // desglose por día, para el Excel
  redirect(banner.linkUrl);
}
