// POST /api/trigger-scraper
//   →  { leidos, pendientes, evaluados, nuevos, alertas, errorTelegram, errores, leads }
// Una ronda del radar: lee Reddit, descarta lo ya revisado (por url o huella),
// clasifica lo nuevo con Gemini, guarda los pedidos reales y avisa por Telegram.
// Lo llama el botón del panel (sesión) o Supabase Cron cada 5 minutos (CRON_SECRET).
import { clasificarConGemini } from "./_lib/ai-filter.js";
import { exigirSesionOCron } from "./_lib/auth.js";
import { leerReddit, textoDe } from "./_lib/scraper.js";
import { huellaDe, insertarLeads, marcarRevisados, postsSinRevisar } from "./_lib/supabase.js";
import { avisarLeads } from "./_lib/telegram.js";

// El plan gratuito de Gemini permite ~10 consultas por minuto: de a una y hasta 8 por
// ronda. Lo que sobre se evalúa en la siguiente (cada 5 minutos con el cron).
const MAX_EVALUAR = 8;
const LIMITE_MS = 40_000; // deja margen dentro de los 60 s que dura como máximo la función

async function correrRadar() {
  const inicio = Date.now();
  const errores = [];

  let posts = [];
  try {
    posts = (await leerReddit()).map((p) => ({ ...p, huella: huellaDe(textoDe(p)) }));
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
    return res.status(200).json(await correrRadar());
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Error interno." });
  }
}
