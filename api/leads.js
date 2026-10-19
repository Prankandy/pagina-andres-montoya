// GET   /api/leads?categoria=soporte|desarrollo&estado=NUEVO|CONTACTADO|CERRADO  →  { leads }
// PATCH /api/leads  { id, estado }  →  { lead }
// Ambos requieren la sesión del panel (Authorization: Bearer <token>).
import { exigirSesion } from "./_lib/auth.js";
import { CATEGORIAS, ESTADOS, actualizarEstado, obtenerLeads } from "./_lib/supabase.js";

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
      const leads = await obtenerLeads({ categoria, estado });
      return res.status(200).json({ leads });
    }

    if (req.method === "PATCH") {
      const { id, estado } = req.body || {};
      if (!id || !ESTADOS.includes(estado)) {
        return res.status(400).json({ error: `Envía el id del lead y un estado: ${ESTADOS.join(", ")}.` });
      }
      const lead = await actualizarEstado(id, estado);
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
