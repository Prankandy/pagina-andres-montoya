// ============================================================
//  Cliente de Supabase y consultas de la tabla leads.
//  SOLO SERVIDOR: lo usan las funciones de /api. Usa la clave
//  service_role, que nunca debe ir en los archivos de js/.
// ============================================================
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const ESTADOS = ["NUEVO", "CONTACTADO", "CERRADO"];
export const CATEGORIAS = ["soporte", "desarrollo"];
export const URGENCIAS = ["alta", "media", "baja"];

let cliente;

export function supabase() {
  if (!cliente) {
    const url = process.env.SUPABASE_URL;
    const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !clave) {
      throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en las variables de entorno de Vercel.");
    }
    cliente = createClient(url, clave, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cliente;
}

/** Leads del más reciente al más antiguo. Filtros opcionales: categoria, estado. */
export async function obtenerLeads({ categoria, estado } = {}) {
  let consulta = supabase()
    .from("leads")
    .select("*")
    .order("creado_en", { ascending: false })
    .limit(500);
  if (categoria) consulta = consulta.eq("categoria", categoria);
  if (estado) consulta = consulta.eq("estado", estado);

  const { data, error } = await consulta;
  if (error) throw error;
  return data;
}

/** Cambia el estado y/o las notas de un lead. Devuelve el lead actualizado, o null si no existe. */
export async function actualizarLead(id, cambios) {
  const { data, error } = await supabase()
    .from("leads")
    .update({ ...cambios, actualizado_en: new Date().toISOString() })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Cuántos leads hay en cada estado: { NUEVO, CONTACTADO, CERRADO }. Filtro opcional: categoria. */
export async function contarPorEstado({ categoria } = {}) {
  const { data, error } = await supabase().rpc("conteo_leads", { cat: categoria || null });
  if (error) throw error;
  const conteo = Object.fromEntries(ESTADOS.map((e) => [e, 0]));
  for (const { estado_lead, cantidad } of data) {
    if (estado_lead in conteo) conteo[estado_lead] = Number(cantidad);
  }
  return conteo;
}

/**
 * Huella del pedido: el texto sin tildes, mayúsculas ni signos. Así el mismo
 * pedido publicado en varios sitios entra una sola vez. Los textos cortos no
 * llevan huella: dos personas distintas pueden escribir "necesito ayuda urgente".
 */
export function huellaDe(texto) {
  const limpio = String(texto || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return limpio.length >= 40 ? createHash("sha256").update(limpio).digest("hex") : null;
}

/**
 * Guarda leads capturados por el rastreo. Los repetidos (misma url o misma
 * huella) se ignoran, así que se puede correr varias veces. Devuelve solo los nuevos.
 */
export async function insertarLeads(leads) {
  if (!leads.length) return [];
  const filas = leads.map((lead) => ({ ...lead, huella: lead.huella ?? huellaDe(lead.necesidad) }));
  const { data, error } = await supabase().rpc("insertar_leads", { filas });
  if (error) throw error;
  return data;
}

/** De estas publicaciones ({ url, huella, ... }), las que nadie ha revisado todavía. */
export async function postsSinRevisar(posts) {
  if (!posts.length) return [];
  const { data, error } = await supabase().rpc("posts_sin_revisar", {
    posts: posts.map(({ url, huella }) => ({ url, huella })),
  });
  if (error) throw error;
  const pendientes = new Set(data.map((fila) => fila.pendiente));
  return posts.filter((p) => pendientes.has(p.url));
}

/** Anota las publicaciones que ya evaluó la IA (lead o no), para no evaluarlas de nuevo. */
export async function marcarRevisados(filas) {
  if (!filas.length) return;
  const { error } = await supabase()
    .from("revisados")
    .upsert(filas, { onConflict: "url", ignoreDuplicates: true });
  if (error) throw error;
}
