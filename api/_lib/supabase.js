// ============================================================
//  Cliente de Supabase y consultas de la tabla leads.
//  SOLO SERVIDOR: lo usan las funciones de /api. Usa la clave
//  service_role, que nunca debe ir en los archivos de js/.
// ============================================================
import { createClient } from "@supabase/supabase-js";

export const ESTADOS = ["NUEVO", "CONTACTADO", "CERRADO"];
export const CATEGORIAS = ["soporte", "desarrollo"];

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

/** Cambia el estado de un lead. Devuelve el lead actualizado, o null si no existe. */
export async function actualizarEstado(id, estado) {
  const { data, error } = await supabase()
    .from("leads")
    .update({ estado, actualizado_en: new Date().toISOString() })
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Guarda leads capturados por el rastreo. Los que ya existen (misma url)
 * se ignoran, así que se puede correr varias veces. Devuelve solo los nuevos.
 */
export async function insertarLeads(leads) {
  if (!leads.length) return [];
  const { data, error } = await supabase()
    .from("leads")
    .upsert(leads, { onConflict: "url", ignoreDuplicates: true })
    .select();
  if (error) throw error;
  return data;
}
