// POST /api/trigger-scraper  →  { revisados, nuevos, alertas, errorTelegram, leads }
// Corre una ronda del rastreo (por ahora simulado, ver _lib/scraper.js),
// guarda en Supabase solo los leads que no existían y avisa por Telegram.
import { exigirSesion } from "./_lib/auth.js";
import { buscarNecesidades } from "./_lib/scraper.js";
import { insertarLeads } from "./_lib/supabase.js";
import { avisarLeads } from "./_lib/telegram.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido." });
  }

  try {
    if (!exigirSesion(req, res)) return;

    const encontrados = await buscarNecesidades();
    const nuevos = await insertarLeads(encontrados);
    const { enviados: alertas, error: errorTelegram } = await avisarLeads(nuevos);
    return res.status(200).json({ revisados: encontrados.length, nuevos: nuevos.length, alertas, errorTelegram, leads: nuevos });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Error interno." });
  }
}
