import { redirect } from "next/navigation";
import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { SITE } from "@/lib/config";
import AdminNav from "@/components/admin/AdminNav";
import { logoutAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Única puerta del panel: todo lo que cuelga de este layout exige sesión.
  const user = await currentUser();
  if (!user) redirect("/admin/login");

  return (
    <div className="flex min-h-full flex-1 flex-col bg-surface">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-baseline gap-3">
            <Link href="/admin" className="font-serif text-lg font-bold text-ink">
              {SITE.nameLead} <span className="text-accent">{SITE.nameAccent}</span>
            </Link>
            <span className="text-xs uppercase tracking-[0.18em] text-muted">
              Administración
            </span>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-xs text-muted sm:block">
              {user.name}
            </span>
            <Link
              href="/"
              target="_blank"
              className="text-ink-soft hover:text-accent"
            >
              Ver sitio ↗
            </Link>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded border border-line px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-accent hover:text-accent"
              >
                Salir
              </button>
            </form>
          </div>
        </div>

        <AdminNav role={user.role} />
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
