// GET   /api/leads?categoria=soporte|desarrollo&estado=NUEVO|CONTACTADO|CERRADO
//         →  { leads, conteos }   (conteos por estado, con el filtro de categoría)
// PATCH /api/leads  { id, estado?, notas? }  →  { lead }
// Ambos requieren la sesión del panel (Authorization: Bearer <token>).
import { exigirSesion } from "./_lib/auth.js";
import { CATEGORIAS, ESTADOS, actualizarLead, contarPorEstado, obtenerLeads } from "./_lib/supabase.js";

const MAX_NOTAS = 2000;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  try {
    if (!exigirSesion(req, res)) return;

    if (req.method === "GET") {
      const { categoria, estado } = req.query;
      if (categoria && !CATEGORIAS.includes(categoria)) {
        return res.status(400).json({ error: `Categoría no válida. Usa: ${CATEGORIAS.join(", ")}.` });
      }
      if (estado && !ESTADOS.includes(estado)) {
        return res.status(400).json({ error: `Estado no válido. Usa: ${ESTADOS.join(", ")}.` });
      }
      const [leads, conteos] = await Promise.all([
        obtenerLeads({ categoria, estado }),
        // Si los contadores fallan (p. ej. falta correr schema.sql), la lista se muestra igual.
        contarPorEstado({ categoria }).catch((err) => { console.error(err); return null; }),
      ]);
      return res.status(200).json({ leads, conteos });
    }

    if (req.method === "PATCH") {
      const { id, estado, notas } = req.body || {};
      const cambios = {};
      if (estado !== undefined) {
        if (!ESTADOS.includes(estado)) {
          return res.status(400).json({ error: `Estado no válido. Usa: ${ESTADOS.join(", ")}.` });
        }
        cambios.estado = estado;
      }
      if (notas !== undefined) {
        if (notas !== null && typeof notas !== "string") {
          return res.status(400).json({ error: "Las notas deben ser texto." });
        }
        const limpias = (notas || "").trim();
        if (limpias.length > MAX_NOTAS) {
          return res.status(400).json({ error: `Las notas no pueden pasar de ${MAX_NOTAS} caracteres.` });
        }
        cambios.notas = limpias || null;
      }
      if (!id || !Object.keys(cambios).length) {
        return res.status(400).json({ error: "Envía el id del lead y el estado o las notas." });
      }
      const lead = await actualizarLead(id, cambios);
      if (!lead) return res.status(404).json({ error: "Ese lead no existe." });
      return res.status(200).json({ lead });
    }

    res.setHeader("Allow", "GET, PATCH");
    return res.status(405).json({ error: "Método no permitido." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Error interno." });
  }
}
