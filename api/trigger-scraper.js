// POST /api/trigger-scraper   { feeds?: [{ tipo, xml }], rss? }
//   →  { leidos, porFuente, pendientes, evaluados, nuevos, alertas, errorTelegram, errores, leads }
// Una ronda del radar: lee las fuentes, descarta lo ya revisado (por url o huella),
// clasifica lo nuevo con Gemini, guarda los pedidos reales y avisa por Telegram.
// Reddit bloquea las consultas desde Vercel, así que el lector del PC
// (tools/radar-local.mjs, con CRON_SECRET) envía los feeds ya descargados:
// tipo "reddit", "alerta" (Google Alerts) o "freelancer". `rss` = un feed de Reddit
// (versión anterior del lector). Sin feeds (botón del panel), el servidor intenta
// descargar Reddit él mismo.
import { clasificarConGemini } from "./_lib/ai-filter.js";
import { exigirSesionOCron } from "./_lib/auth.js";
import { TIPOS_FEED, leerReddit, parsearFeed, textoDe } from "./_lib/scraper.js";
import { huellaDe, insertarLeads, marcarRevisados, postsSinRevisar } from "./_lib/supabase.js";
import { avisarLeads } from "./_lib/telegram.js";

// El plan gratuito de Gemini permite ~10 consultas por minuto: de a una y hasta 8 por
// ronda. Lo que sobre se evalúa en la siguiente (cada 5 minutos con el lector del PC).
const MAX_EVALUAR = 8;
const LIMITE_MS = 40_000;  // deja margen dentro de los 60 s que dura como máximo la función
const MAX_XML = 3_000_000; // el feed de Reddit (100 publicaciones) pesa ~200 KB
const MAX_FEEDS = 12;

const fechaDe = (post) => Date.parse(post.publicado) || 0;

async function leerFuentes(feeds) {
  if (!feeds) return { posts: (await leerReddit()).map((p) => ({ ...p, tipo: "reddit" })), errores: [] };
  const posts = [];
  const errores = [];
  for (const { tipo, xml } of feeds) {
    try {
      posts.push(...parsearFeed(tipo, xml).map((p) => ({ ...p, tipo })));
    } catch (err) {
      errores.push(`No se pudo leer un feed de tipo ${tipo}: ${err.message}`);
    }
  }
  return { posts, errores };
}

async function correrRadar(feeds) {
  const inicio = Date.now();
  const errores = [];

  let posts = [];
  try {
    const leido = await leerFuentes(feeds);
    errores.push(...leido.errores);
    // Sin repetidos dentro de la misma ronda (p. ej. dos alertas que traen la misma página),
    // y lo más nuevo primero: si hay más de MAX_EVALUAR, lo reciente no espera.
    const vistos = new Set();
    posts = leido.posts
      .filter((p) => !vistos.has(p.url) && vistos.add(p.url))
      .sort((a, b) => fechaDe(b) - fechaDe(a))
      .map((p) => ({ ...p, huella: huellaDe(textoDe(p)) }));
  } catch (err) {
    errores.push(err.message);
  }

  const porFuente = {};
  for (const { tipo } of posts) porFuente[tipo] = (porFuente[tipo] || 0) + 1;

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
    nombre: post.nombre,
    necesidad: textoDe(post),
    resumen: ia.resumen,
    categoria: ia.categoria === "IMMEDIATE" ? "soporte" : "desarrollo",
    urgencia: ia.urgente ? "alta" : "media",
    fuente: post.fuente,
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
    porFuente,
    pendientes: pendientes.length,
    evaluados: evaluados.length,
    nuevos: nuevos.length,
    alertas,
    errorTelegram,
    errores: [...new Set(errores)].slice(0, 3),
    leads: nuevos,
  };
}

// Valida lo que envía el lector del PC. Devuelve los feeds, null (sin feeds) o un texto de error.
function feedsDelCuerpo(body) {
  const { rss, feeds } = body || {};
  const lista = feeds !== undefined ? feeds : rss !== undefined ? [{ tipo: "reddit", xml: rss }] : null;
  if (lista === null) return null;
  if (!Array.isArray(lista) || !lista.length || lista.length > MAX_FEEDS) return `Envía entre 1 y ${MAX_FEEDS} feeds.`;
  for (const f of lista) {
    if (!f || !TIPOS_FEED.includes(f.tipo)) return `Tipo de feed no válido. Usa: ${TIPOS_FEED.join(", ")}.`;
    if (typeof f.xml !== "string" || f.xml.length > MAX_XML || !/<feed|<rss/.test(f.xml)) {
      return "Cada feed debe ser un RSS o Atom (y el de Reddit, el feed RSS de Reddit).";
    }
  }
  return lista;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido." });
  }

  try {
    if (!exigirSesionOCron(req, res)) return;
    const feeds = feedsDelCuerpo(req.body);
    if (typeof feeds === "string") return res.status(400).json({ error: feeds });
    return res.status(200).json(await correrRadar(feeds));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Error interno." });
  }
}
