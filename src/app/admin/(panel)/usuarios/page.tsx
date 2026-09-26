import type { Metadata } from "next";
import { currentUser } from "@/lib/auth";
import { listUsers, ROLES } from "@/lib/repo/users";
import {
  ChangePasswordForm,
  NewUserForm,
  UserRow,
} from "@/components/admin/UsersPanel";

export const metadata: Metadata = { title: "Usuarios" };

export default async function UsersPage() {
  // El layout ya exigió sesión; aquí sólo se decide cuánto se muestra.
  const me = (await currentUser())!;
  const isAdmin = me.role === "admin";
  const users = isAdmin ? await listUsers() : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-bold text-ink">Usuarios</h1>
        <p className="mt-1 text-sm text-muted">
          Cada persona entra con su propio usuario y contraseña. Las contraseñas se
          guardan cifradas: no se pueden consultar, sólo restablecer.
        </p>
      </div>

      <section className="rounded-lg border border-line bg-paper p-5">
        <h2 className="font-serif text-lg font-bold text-ink">Mi cuenta</h2>
        <p className="mt-1 mb-4 text-sm text-muted">
          Entraste como <span className="font-mono text-ink">{me.username}</span> ·{" "}
          {ROLES.find((r) => r.value === me.role)?.label}
        </p>
        <ChangePasswordForm />
      </section>

      {isAdmin ? (
        <>
          <section className="rounded-lg border border-line bg-paper p-5">
            <h2 className="font-serif text-lg font-bold text-ink">Crear usuario</h2>
            <p className="mt-1 mb-4 text-sm text-muted">
              La contraseña se muestra una sola vez, al crearla. Pásasela a su dueño
              y pídele que la cambie desde “Mi cuenta”.
            </p>
            <NewUserForm />
          </section>

          <section>
            <h2 className="mb-3 font-serif text-lg font-bold text-ink">
              Cuentas ({users.length})
            </h2>
            <ul className="divide-y divide-line rounded-lg border border-line bg-paper">
              {users.map((user) => (
                <UserRow key={user.id} user={user} isSelf={user.id === me.id} />
              ))}
            </ul>
          </section>
        </>
      ) : (
        <p className="rounded-lg border border-dashed border-line bg-paper px-6 py-10 text-center text-sm text-muted">
          Sólo los administradores dan de alta o quitan cuentas. Pide a uno que te
          cambie los permisos si necesitas hacerlo.
        </p>
      )}
    </div>
  );
}
