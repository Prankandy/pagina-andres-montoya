// GET   /api/leads?categoria=soporte|desarrollo&estado=NUEVO|CONTACTADO|CERRADO
//         →  { leads, conteos }   (conteos por estado, con el filtro de categoría)
// POST  /api/leads  { necesidad, url?, nombre?, categoria? }  →  201 { lead, aviso? }
//         Captura manual (botón "Agregar lead" o marcador "Enviar al radar"):
//         Gemini pone resumen, categoría (si es "auto") y urgencia.
// PATCH /api/leads  { id, estado?, notas? }  →  { lead }
// Todos requieren la sesión del panel (Authorization: Bearer <token>).
import { clasificarConGemini } from "./_lib/ai-filter.js";
import { exigirSesion } from "./_lib/auth.js";
import {
  CATEGORIAS, ESTADOS, actualizarLead, buscarLead, contarPorEstado, huellaDe, insertarLeads, obtenerLeads,
} from "./_lib/supabase.js";

const MAX_NOTAS = 2000;
const MAX_TEXTO = 5000;

function hostDe(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

async function capturar(body, res) {
  const { necesidad, url, nombre, categoria = "auto" } = body || {};
  const texto = typeof necesidad === "string" ? necesidad.trim() : "";
  if (texto.length < 10 || texto.length > MAX_TEXTO) {
    return res.status(400).json({ error: `Pega el texto del pedido (entre 10 y ${MAX_TEXTO} caracteres).` });
  }
  const enlace = typeof url === "string" && url.trim() ? url.trim() : null;
  if (enlace && (!/^https?:\/\//i.test(enlace) || enlace.length > 2000 || !hostDe(enlace))) {
    return res.status(400).json({ error: "El enlace debe empezar con http:// o https://." });
  }
  if (nombre !== undefined && nombre !== null && (typeof nombre !== "string" || nombre.length > 120)) {
    return res.status(400).json({ error: "El nombre debe ser un texto de hasta 120 caracteres." });
  }
  if (categoria !== "auto" && !CATEGORIAS.includes(categoria)) {
    return res.status(400).json({ error: `Categoría no válida. Usa: auto, ${CATEGORIAS.join(", ")}.` });
  }

  const huella = huellaDe(texto);
  const existente = await buscarLead({ url: enlace, huella });
  if (existente && huella && existente.huella === huella) {
    return res.status(409).json({ error: "Ese pedido ya está en el panel.", lead: existente });
  }
  // Misma página pero otro pedido (p. ej. un grupo de Facebook): se guarda aparte.
  const urlFinal = existente && enlace ? `${enlace}#radar-${Date.now().toString(36)}` : enlace;

  const host = hostDe(enlace);
  const ia = await clasificarConGemini({ contexto: `Captura manual${host ? ` desde ${host}` : ""}`, titulo: "Texto copiado a mano", cuerpo: texto });
  const [lead] = await insertarLeads([{
    nombre: (nombre || "").trim() || host || "Captura manual",
    necesidad: texto,
    resumen: ia.error ? null : ia.resumen || null,
    categoria: categoria !== "auto" ? categoria : ia.categoria === "IMMEDIATE" ? "soporte" : "desarrollo",
    urgencia: !ia.error && ia.urgente ? "alta" : "media",
    fuente: host ? `manual · ${host}` : "manual",
    url: urlFinal,
    telefono: null,
    huella,
  }]);
  if (!lead) return res.status(409).json({ error: "Ese pedido ya está en el panel." });

  let aviso = null;
  if (ia.error) aviso = `Guardado sin resumen: ${ia.error}`;
  else if (!ia.es_pedido_real) aviso = "Guardado. Ojo: la IA no lo ve como un pedido de tus servicios.";
  return res.status(201).json({ lead, aviso });
}

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

    if (req.method === "POST") return await capturar(req.body, res);

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

    res.setHeader("Allow", "GET, POST, PATCH");
    return res.status(405).json({ error: "Método no permitido." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Error interno." });
  }
}
