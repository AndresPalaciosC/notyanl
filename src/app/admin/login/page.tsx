import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { isAdminConfigured, isAuthenticated } from "@/lib/auth";
import { SITE } from "@/lib/config";
import LoginForm from "@/components/admin/LoginForm";

export const metadata: Metadata = { title: "Acceso al panel" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await isAuthenticated()) redirect("/admin");

  // Si la base no responde, el panel no puede ni comprobar si hay cuentas.
  // Vale mas decirlo que devolver un 500 sin explicacion.
  let configured = false;
  let dbError: string | null = null;
  try {
    configured = await isAdminConfigured();
  } catch (error) {
    dbError = error instanceof Error ? error.message : "Error desconocido.";
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-surface px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <Link href="/" className="font-serif text-2xl font-bold text-balance text-ink">
            {SITE.nameLead} <span className="text-accent">{SITE.nameAccent}</span>
          </Link>
          <p className="mt-1 text-xs uppercase tracking-[0.22em] text-muted">
            Panel de administración
          </p>
        </div>

        <div className="mt-8 rounded-lg border border-line bg-paper p-6 shadow-sm">
          {dbError ? (
            <div className="text-sm text-ink-soft">
              <p className="font-medium text-accent">
                No se puede conectar con la base de datos.
              </p>
              <p className="mt-2">
                El sitio arrancó, pero no alcanza el MySQL. Revisa las variables{" "}
                <code className="rounded bg-surface px-1">DB_HOST</code>,{" "}
                <code className="rounded bg-surface px-1">DB_USER</code>,{" "}
                <code className="rounded bg-surface px-1">DB_PASSWORD</code> y{" "}
                <code className="rounded bg-surface px-1">DB_NAME</code> en el
                servidor.
              </p>
              <p className="mt-2 text-xs text-muted">
                Detalle para diagnóstico en{" "}
                <code className="rounded bg-surface px-1">/api/estado</code>.
              </p>
            </div>
          ) : configured ? (
            <LoginForm />
          ) : (
            <div className="text-sm text-ink-soft">
              <p className="font-medium text-accent">Falta configurar el acceso.</p>
              <p className="mt-2">
                Define <code className="rounded bg-surface px-1">ADMIN_PASSWORD</code> y{" "}
                <code className="rounded bg-surface px-1">SESSION_SECRET</code> en el
                archivo <code className="rounded bg-surface px-1">.env</code> del
                servidor y reinicia la aplicación.
              </p>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          <Link href="/" className="hover:text-accent">
            ← Volver al sitio
          </Link>
        </p>
      </div>
    </main>
  );
}
