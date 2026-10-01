"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createSession,
  destroySession,
  login,
  requireAdmin,
  requireRole,
} from "@/lib/auth";
import * as users from "@/lib/repo/users";
import { localInputToIso } from "@/lib/dates";
import { checkBannerAspect, readImageSize } from "@/lib/images";
import { MAX_IMAGE_BYTES, MAX_UPLOAD_BYTES } from "@/lib/config";
import { ALLOWED_IMAGE_MIME, saveFile } from "@/lib/storage";
import { recordMedia, removeMedia } from "@/lib/repo/media";
import { ImportError, importDocument, type ImportResult } from "@/lib/importers";
import * as notes from "@/lib/repo/notes";
import * as banners from "@/lib/repo/banners";
import {
  SOCIAL_NETWORKS,
  saveSocialSettings,
  type SocialKey,
} from "@/lib/repo/settings";

/* ------------------------------------------------------------------ sesión */

export type LoginState = { error?: string };

export async function loginAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!username.trim()) return { error: "Escribe tu usuario." };
  if (!password) return { error: "Escribe la contraseña." };

  // Un solo mensaje para usuario inexistente, contraseña mala o cuenta
  // desactivada: no hay por qué decirle a quien tantea qué cuentas existen.
  if (!(await login(username, password))) {
    return { error: "Usuario o contraseña incorrectos." };
  }

  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/admin/login");
}

/* ------------------------------------------------------------------- notas */

export type NotePayload = {
  id?: number;
  title: string;
  summary: string;
  bodyHtml: string;
  category: string;
  author: string;
  coverUrl: string;
  coverAlt: string;
  slug: string;
  status: notes.NoteStatus;
  featured: boolean;
  /** Valor de <input type="datetime-local">, en hora local del navegador. */
  publishedAtLocal: string;
  sourceFile?: string | null;
};

export type SaveResult =
  | { ok: true; id: number; slug: string }
  | { ok: false; error: string };

export async function saveNoteAction(payload: NotePayload): Promise<SaveResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  }

  if (!payload.title.trim()) {
    return { ok: false, error: "La nota necesita un título." };
  }

  const input: notes.NoteInput = {
    title: payload.title,
    summary: payload.summary,
    bodyHtml: payload.bodyHtml,
    category: payload.category,
    author: payload.author,
    coverUrl: payload.coverUrl,
    coverAlt: payload.coverAlt,
    status: payload.status,
    featured: payload.featured,
    slug: payload.slug,
    publishedAt: localInputToIso(payload.publishedAtLocal),
    sourceFile: payload.sourceFile ?? null,
  };

  try {
    const note = payload.id
      ? await notes.updateNote(payload.id, input)
      : await notes.createNote(input);

    if (!note) return { ok: false, error: "La nota ya no existe." };

    revalidatePath("/");
    revalidatePath(`/nota/${note.slug}`);
    revalidatePath("/admin/notas");

    return { ok: true, id: note.id, slug: note.slug };
  } catch (error) {
    return { ok: false, error: describe(error) };
  }
}

export async function deleteNoteAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (Number.isFinite(id)) await notes.deleteNote(id);

  revalidatePath("/");
  revalidatePath("/admin/notas");
  redirect("/admin/notas");
}

export async function setNoteStatusAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const status = formData.get("status") === "published" ? "published" : "draft";
  if (Number.isFinite(id)) await notes.setStatus(id, status);

  revalidatePath("/");
  revalidatePath("/admin/notas");
}

export async function toggleFeaturedAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (Number.isFinite(id)) await notes.toggleFeatured(id);

  revalidatePath("/");
  revalidatePath("/admin/notas");
}

/* -------------------------------------------------------- importar y subir */

export type ImportActionResult =
  | { ok: true; result: ImportResult }
  | { ok: false; error: string };

/** Lee un .docx/.pdf/.txt/.html y devuelve título + cuerpo para el editor. */
export async function importDocumentAction(
  formData: FormData,
): Promise<ImportActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No se recibió ningún archivo." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "El archivo supera el límite de 25 MB." };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await importDocument(buffer, file.name);
    return { ok: true, result };
  } catch (error) {
    if (error instanceof ImportError) return { ok: false, error: error.message };
    return {
      ok: false,
      error: `No se pudo leer el documento: ${describe(error)}`,
    };
  }
}

export type UploadResult =
  | { ok: true; url: string; width: number | null; height: number | null }
  | { ok: false; error: string };

/** Sube una imagen suelta desde el editor o para la portada de la nota. */
export async function uploadImageAction(formData: FormData): Promise<UploadResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  }

  const file = formData.get("file");
  const kind = formData.get("kind") === "cover" ? "cover" : "note";

  const validation = validateImage(file);
  if (!validation.ok) return { ok: false, error: validation.error };

  const buffer = Buffer.from(await validation.file.arrayBuffer());
  const size = readImageSize(buffer);

  const stored = await saveFile(buffer, {
    mime: validation.file.type,
    originalName: validation.file.name,
  });
  await recordMedia(stored, kind, size, buffer);

  return {
    ok: true,
    url: stored.url,
    width: size?.width ?? null,
    height: size?.height ?? null,
  };
}

function validateImage(
  file: FormDataEntryValue | null,
): { ok: true; file: File } | { ok: false; error: string } {
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No se recibió ninguna imagen." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      error: `La imagen supera el límite de ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB.`,
    };
  }
  if (!ALLOWED_IMAGE_MIME.has(file.type)) {
    return {
      ok: false,
      error: "Formato no soportado. Usa JPG, PNG, WebP, AVIF o GIF.",
    };
  }
  return { ok: true, file };
}

/* ----------------------------------------------------------------- banners */

export type BannerState = { error?: string; notice?: string };

export async function createBannerAction(
  _previous: BannerState,
  formData: FormData,
): Promise<BannerState> {
  try {
    await requireAdmin();
  } catch {
    return { error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  }

  const validation = validateImage(formData.get("image"));
  if (!validation.ok) return { error: validation.error };

  const buffer = Buffer.from(await validation.file.arrayBuffer());
  const size = readImageSize(buffer);
  const aspect = checkBannerAspect(size);

  const stored = await saveFile(buffer, {
    mime: validation.file.type,
    originalName: validation.file.name,
  });
  await recordMedia(stored, "banner", size, buffer);

  await banners.createBanner({
    title: String(formData.get("title") ?? ""),
    advertiser: String(formData.get("advertiser") ?? ""),
    imageKey: stored.key,
    imageUrl: stored.url,
    width: size?.width ?? null,
    height: size?.height ?? null,
    linkUrl: String(formData.get("linkUrl") ?? ""),
    position: String(formData.get("position") ?? "sidebar"),
    weight: Number(formData.get("weight") ?? 1),
    active: formData.get("active") !== null,
    startsAt: localInputToIso(String(formData.get("startsAt") ?? "")),
    endsAt: localInputToIso(String(formData.get("endsAt") ?? "")),
  });

  revalidatePath("/");
  revalidatePath("/admin/banners");

  return {
    notice: aspect.ok
      ? "Banner cargado y activo."
      : `Banner cargado. ${aspect.message}`,
  };
}

export async function updateBannerAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;

  await banners.updateBanner(id, {
    title: String(formData.get("title") ?? ""),
    advertiser: String(formData.get("advertiser") ?? ""),
    linkUrl: String(formData.get("linkUrl") ?? ""),
    position: String(formData.get("position") ?? "sidebar"),
    weight: Number(formData.get("weight") ?? 1),
    active: formData.get("active") !== null,
    startsAt: localInputToIso(String(formData.get("startsAt") ?? "")),
    endsAt: localInputToIso(String(formData.get("endsAt") ?? "")),
  });

  revalidatePath("/");
  revalidatePath("/admin/banners");
}

export async function toggleBannerAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (Number.isFinite(id)) await banners.toggleBanner(id);

  revalidatePath("/");
  revalidatePath("/admin/banners");
}

export async function deleteBannerAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;

  const removed = await banners.deleteBanner(id);
  // El archivo se borra junto con el registro para no dejar basura en disco.
  if (removed) await removeMedia(removed.imageKey);

  revalidatePath("/");
  revalidatePath("/admin/banners");
}

/* ----------------------------------------------------------------- ajustes */

export type SettingsState = { error?: string; notice?: string };

export async function saveSocialAction(
  _previous: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  try {
    await requireAdmin();
  } catch {
    return { error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  }

  const values: Partial<Record<SocialKey, string>> = {};
  const invalid: string[] = [];

  for (const network of SOCIAL_NETWORKS) {
    const raw = String(formData.get(network.key) ?? "").trim();
    if (raw && !/^https?:\/\/.+/i.test(raw)) {
      invalid.push(network.label);
      continue;
    }
    values[network.key] = raw;
  }

  await saveSocialSettings(values);
  revalidatePath("/", "layout");

  return invalid.length
    ? {
        error: `Estas direcciones se ignoraron por no empezar con https://: ${invalid.join(", ")}.`,
      }
    : { notice: "Redes sociales actualizadas." };
}

/* ---------------------------------------------------------------- usuarios */

export type UserActionState = {
  error?: string;
  notice?: string;
  /**
   * Credenciales recién asignadas. Se devuelven una sola vez, para que quien
   * dio de alta la cuenta pueda pasárselas a su dueño: después ya no hay forma
   * de recuperarlas, sólo de asignar otras.
   */
  credentials?: { username: string; password: string };
};

export async function createUserAction(
  _previous: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  try {
    await requireRole("admin");
  } catch (error) {
    return { error: describe(error) };
  }

  // Sin contraseña escrita se genera una: es lo más seguro y lo más cómodo.
  const typed = String(formData.get("password") ?? "").trim();
  const password = typed || users.suggestPassword();

  try {
    const user = await users.createUser({
      username: String(formData.get("username") ?? ""),
      name: String(formData.get("name") ?? ""),
      password,
      role: String(formData.get("role") ?? "editor"),
    });

    revalidatePath("/admin/usuarios");

    return {
      notice: `Cuenta creada para ${user.name}.`,
      credentials: { username: user.username, password },
    };
  } catch (error) {
    return { error: describe(error) };
  }
}

export async function manageUserAction(
  _previous: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  let me;
  try {
    me = await requireRole("admin");
  } catch (error) {
    return { error: describe(error) };
  }

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return { error: "Usuario no válido." };

  const intent = String(formData.get("intent") ?? "");
  const target = await users.getUserById(id);
  if (!target) return { error: "Ese usuario ya no existe." };

  // Nadie se cierra a sí mismo la puerta por accidente.
  if (me.id === id && (intent === "delete" || intent === "toggle")) {
    return { error: "No puedes desactivar ni eliminar tu propia cuenta." };
  }

  try {
    switch (intent) {
      case "update": {
        const updated = await users.updateUser(id, {
          name: String(formData.get("name") ?? ""),
          role: String(formData.get("role") ?? target.role),
        });
        revalidatePath("/admin/usuarios");
        return { notice: `${updated.name}: cambios guardados.` };
      }

      case "toggle": {
        const updated = await users.updateUser(id, { active: !target.active });
        revalidatePath("/admin/usuarios");
        return {
          notice: updated.active
            ? `${updated.name} puede entrar de nuevo.`
            : `${updated.name} ya no puede entrar.`,
        };
      }

      case "reset": {
        const typed = String(formData.get("password") ?? "").trim();
        const password = typed || users.suggestPassword();
        await users.setPassword(id, password);
        revalidatePath("/admin/usuarios");
        return {
          notice: `Contraseña nueva para ${target.name}.`,
          credentials: { username: target.username, password },
        };
      }

      case "delete": {
        await users.deleteUser(id);
        revalidatePath("/admin/usuarios");
        return { notice: `Se eliminó la cuenta de ${target.name}.` };
      }

      default:
        return { error: "Acción no reconocida." };
    }
  } catch (error) {
    return { error: describe(error) };
  }
}

/** Cambio de contraseña propio: exige la actual y renueva la sesión. */
export async function changeOwnPasswordAction(
  _previous: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  let me;
  try {
    me = await requireAdmin();
  } catch (error) {
    return { error: describe(error) };
  }

  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const repeat = String(formData.get("repeatPassword") ?? "");

  if (next !== repeat) return { error: "La contraseña nueva no coincide." };
  if (next === current) return { error: "La contraseña nueva es igual a la actual." };

  if (!(await users.authenticate({ username: me.username, password: current }))) {
    return { error: "Tu contraseña actual no es correcta." };
  }

  try {
    await users.setPassword(me.id, next);
  } catch (error) {
    return { error: describe(error) };
  }

  // setPassword invalidó la cookie anterior: se firma una nueva para no echar
  // de la sesión a quien acaba de cambiarla.
  const refreshed = await users.getUserById(me.id);
  if (refreshed) await createSession(refreshed);

  return { notice: "Contraseña actualizada." };
}

/* ---------------------------------------------------------------- imágenes */

/**
 * Borrado rápido desde la lista de notas, limitado a borradores.
 *
 * Una nota publicada ya tiene lectores y enlaces circulando: esa se elimina
 * desde el editor, donde hace falta abrirla y confirmarlo a conciencia.
 */
export async function deleteDraftAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;

  const note = await notes.getById(id);
  if (!note || note.status === "published") return;

  await notes.deleteNote(id);

  revalidatePath("/");
  revalidatePath("/admin/notas");
}

export type MediaState = { error?: string; notice?: string };

/** Sube una o varias imágenes a la galería. */
export async function uploadMediaAction(
  _previous: MediaState,
  formData: FormData,
): Promise<MediaState> {
  try {
    await requireAdmin();
  } catch (error) {
    return { error: describe(error) };
  }

  const entries = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (!entries.length) return { error: "No elegiste ninguna imagen." };

  let guardadas = 0;
  const fallos: string[] = [];

  for (const file of entries) {
    const validation = validateImage(file);
    if (!validation.ok) {
      fallos.push(`${file.name}: ${validation.error}`);
      continue;
    }

    try {
      const buffer = Buffer.from(await validation.file.arrayBuffer());
      const size = readImageSize(buffer);
      const stored = await saveFile(buffer, {
        mime: validation.file.type,
        originalName: validation.file.name,
      });
      await recordMedia(stored, "note", size, buffer);
      guardadas++;
    } catch (error) {
      fallos.push(`${file.name}: ${describe(error)}`);
    }
  }

  revalidatePath("/admin/imagenes");

  if (!guardadas) return { error: fallos.join(" · ") || "No se pudo guardar nada." };

  const notice =
    guardadas === 1 ? "Imagen guardada." : `${guardadas} imágenes guardadas.`;

  return fallos.length ? { notice, error: fallos.join(" · ") } : { notice };
}

/** Borra la imagen del disco y su registro. */
export async function deleteMediaAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const key = String(formData.get("key") ?? "");
  if (!key) return;

  await removeMedia(key);

  revalidatePath("/admin/imagenes");
  revalidatePath("/");
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : "Error desconocido.";
}
