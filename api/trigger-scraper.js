// POST /api/trigger-scraper   { rss? }
//   →  { leidos, pendientes, evaluados, nuevos, alertas, errorTelegram, errores, leads }
// Una ronda del radar: lee Reddit, descarta lo ya revisado (por url o huella),
// clasifica lo nuevo con Gemini, guarda los pedidos reales y avisa por Telegram.
// Reddit bloquea las consultas desde Vercel, así que el lector del PC
// (tools/radar-local.mjs, con CRON_SECRET) envía el feed ya descargado en `rss`.
// Sin `rss` (botón del panel), el servidor intenta descargarlo él mismo.
import { clasificarConGemini } from "./_lib/ai-filter.js";
import { exigirSesionOCron } from "./_lib/auth.js";
import { leerReddit, parsearRss, textoDe } from "./_lib/scraper.js";
import { huellaDe, insertarLeads, marcarRevisados, postsSinRevisar } from "./_lib/supabase.js";
import { avisarLeads } from "./_lib/telegram.js";

// El plan gratuito de Gemini permite ~10 consultas por minuto: de a una y hasta 8 por
// ronda. Lo que sobre se evalúa en la siguiente (cada 5 minutos con el cron).
const MAX_EVALUAR = 8;
const LIMITE_MS = 40_000; // deja margen dentro de los 60 s que dura como máximo la función
const MAX_RSS = 3_000_000; // el feed de 100 publicaciones pesa ~200 KB

async function correrRadar({ rss } = {}) {
  const inicio = Date.now();
  const errores = [];

  let posts = [];
  try {
    const leidos = rss ? parsearRss(rss) : await leerReddit();
    posts = leidos.map((p) => ({ ...p, huella: huellaDe(textoDe(p)) }));
  } catch (err) {
    errores.push(err.message);
  }

  // Lo más nuevo primero: si hay más de MAX_EVALUAR, lo reciente no espera.
  const pendientes = await postsSinRevisar(posts);
  const evaluados = [];
  for (const post of pendientes.slice(0, MAX_EVALUAR)) {
    if (Date.now() - inicio > LIMITE_MS) break;
    const ia = await clasificarConGemini(post);
    if (ia.error) {
      errores.push(ia.error); // no se marca como revisada: se reintenta en la próxima ronda
      break;                  // cuota, red o clave: seguir solo gastaría tiempo
    }
    evaluados.push({ post, ia });
  }

  const esLead = ({ ia }) => ia.es_pedido_real && ia.categoria !== "NINGUNA";
  const nuevos = await insertarLeads(evaluados.filter(esLead).map(({ post, ia }) => ({
    nombre: post.autor,
    necesidad: textoDe(post),
    resumen: ia.resumen,
    categoria: ia.categoria === "IMMEDIATE" ? "soporte" : "desarrollo",
    urgencia: ia.urgente ? "alta" : "media",
    fuente: `reddit r/${post.subreddit}`,
    url: post.url,
    telefono: null,
    huella: post.huella,
  })));

  // Después de guardar los leads: si algo falla antes, la publicación se reevalúa.
  await marcarRevisados(evaluados.map(({ post, ia }) => ({
    url: post.url, huella: post.huella, es_lead: esLead({ ia }), resumen: ia.resumen,
  })));

  const { enviados: alertas, error: errorTelegram } = await avisarLeads(nuevos);
  return {
    leidos: posts.length,
    pendientes: pendientes.length,
    evaluados: evaluados.length,
    nuevos: nuevos.length,
    alertas,
    errorTelegram,
    errores: [...new Set(errores)].slice(0, 3),
    leads: nuevos,
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido." });
  }

  try {
    if (!exigirSesionOCron(req, res)) return;
    const { rss } = req.body || {};
    if (rss !== undefined && (typeof rss !== "string" || rss.length > MAX_RSS || !rss.includes("<feed"))) {
      return res.status(400).json({ error: "El campo rss debe ser el feed RSS de Reddit." });
    }
    return res.status(200).json(await correrRadar({ rss }));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Error interno." });
  }
}
