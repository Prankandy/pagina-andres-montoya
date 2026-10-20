// ============================================================
//  Lector local del radar. Reddit bloquea las consultas desde los
//  servidores de Vercel, así que este script descarga los feeds
//  desde este PC (como cualquier lector de feeds) y se los envía a
//  /api/trigger-scraper, que hace el resto: duplicados, Gemini,
//  Supabase y Telegram.
//
//  Fuentes: Reddit, Freelancer.com y las alertas de Google que haya
//  en tools/.env.radar. Ese archivo (fuera de git) lleva:
//    CRON_SECRET=...                       (la misma clave que en Vercel)
//    ALERTA=https://www.google.com/alerts/feeds/...   (una línea por alerta, opcional)
//
//  Lo ejecuta el Programador de tareas cada 5 minutos (instalar-radar.ps1)
//  y deja un registro de cada ronda en tools/radar-local.log.
// ============================================================
import { appendFileSync, readFileSync, renameSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AGENTE, URL_FREELANCER, URL_RSS } from "../api/_lib/scraper.js";

const SITIO = process.env.RADAR_SITIO || "https://andresfmontoya.vercel.app";
const aqui = path.dirname(fileURLToPath(import.meta.url));
const REGISTRO = path.join(aqui, "radar-local.log");

function registrar(linea) {
  const texto = `${new Date().toLocaleString("sv-SE", { timeZone: "America/Bogota" })}  ${linea}`;
  try {
    if (statSync(REGISTRO).size > 1_000_000) renameSync(REGISTRO, `${REGISTRO}.1`); // no crece sin fin
  } catch { /* todavía no existe */ }
  appendFileSync(REGISTRO, `${texto}\n`);
  console.log(texto);
}

function leerConfig() {
  let env = "";
  try { env = readFileSync(path.join(aqui, ".env.radar"), "utf8"); } catch { /* no existe */ }
  const clave = (env.match(/^CRON_SECRET=(.+)$/m) || [])[1]?.trim() || null;
  const alertas = [...env.matchAll(/^ALERTA=(\S+)\s*$/gm)].map((m) => m[1]).filter((u) => /^https:\/\//.test(u));
  return { clave, alertas };
}

const { clave, alertas } = leerConfig();
if (!clave) {
  registrar("ERROR: falta tools/.env.radar con la línea CRON_SECRET=...");
  process.exit(1);
}

// 1) Descargar los feeds desde este PC (todos a la vez: son sitios distintos).
const fuentes = [
  { tipo: "reddit", nombre: "Reddit", url: URL_RSS },
  { tipo: "freelancer", nombre: "Freelancer", url: URL_FREELANCER },
  ...alertas.map((url, i) => ({ tipo: "alerta", nombre: `Alerta ${i + 1}`, url })),
];
const fallos = [];
const feeds = (await Promise.all(fuentes.map(async ({ tipo, nombre, url }) => {
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": AGENTE, Accept: "application/atom+xml, application/rss+xml, text/xml" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!resp.ok) { fallos.push(`${nombre}: ${resp.status}${resp.status === 429 ? " (pidió esperar)" : ""}`); return null; }
    return { tipo, xml: await resp.text() };
  } catch (err) {
    fallos.push(`${nombre}: sin conexión (${err.message})`);
    return null;
  }
}))).filter(Boolean);

if (!feeds.length) {
  registrar(`Ninguna fuente respondió (${fallos.join(" · ")}); se reintenta en la próxima ronda.`);
  process.exit(0);
}

// 2) Enviarlos al radar en Vercel.
try {
  const resp = await fetch(`${SITIO}/api/trigger-scraper`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${clave}` },
    body: JSON.stringify({ feeds }),
    signal: AbortSignal.timeout(90_000),
  });
  const datos = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const pista = resp.status === 401 ? " (la clave de tools/.env.radar no coincide con CRON_SECRET en Vercel)" : "";
    registrar(`El servidor respondió ${resp.status}: ${datos.error || "sin detalle"}${pista}`);
    process.exit(1);
  }
  const quedan = datos.pendientes - datos.evaluados;
  const n = (cantidad, uno, varios) => `${cantidad} ${cantidad === 1 ? uno : varios}`;
  const detalle = Object.entries(datos.porFuente || {}).map(([tipo, cant]) => `${tipo} ${cant}`).join(", ");
  registrar(`${n(datos.leidos, "leída", "leídas")}${detalle ? ` (${detalle})` : ""}`
    + ` · ${n(datos.evaluados, "evaluada", "evaluadas")} con IA · ${n(datos.nuevos, "lead nuevo", "leads nuevos")}`
    + `${quedan > 0 ? ` · ${quedan} para la próxima ronda` : ""}`
    + `${fallos.length ? ` · sin respuesta: ${fallos.join(", ")}` : ""}`
    + `${datos.errores?.length ? ` · ${datos.errores.join(" | ")}` : ""}`
    + `${datos.nuevos && datos.errorTelegram ? ` · Telegram: ${datos.errorTelegram}` : ""}`);
} catch (err) {
  registrar(`No se pudo contactar el radar en ${SITIO} (${err.message}).`);
  process.exit(1);
}
