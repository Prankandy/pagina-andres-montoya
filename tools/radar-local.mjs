// ============================================================
//  Lector local del radar. Reddit bloquea las consultas desde los
//  servidores de Vercel, así que este script descarga el RSS desde
//  este PC (como cualquier lector de feeds) y se lo envía a
//  /api/trigger-scraper, que hace el resto: duplicados, Gemini,
//  Supabase y Telegram.
//
//  Lo ejecuta el Programador de tareas cada 5 minutos (instalar-radar.ps1).
//  Necesita tools/.env.radar con la misma clave que CRON_SECRET en Vercel:
//    CRON_SECRET=...
//  Deja un registro de cada ronda en tools/radar-local.log.
// ============================================================
import { appendFileSync, readFileSync, renameSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AGENTE, URL_RSS } from "../api/_lib/scraper.js";

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

function leerClave() {
  try {
    const env = readFileSync(path.join(aqui, ".env.radar"), "utf8");
    return (env.match(/^CRON_SECRET=(.+)$/m) || [])[1]?.trim() || null;
  } catch {
    return null;
  }
}

const clave = leerClave();
if (!clave) {
  registrar("ERROR: falta tools/.env.radar con la línea CRON_SECRET=...");
  process.exit(1);
}

// 1) Descargar el feed desde este PC.
let rss;
try {
  const resp = await fetch(URL_RSS, {
    headers: { "User-Agent": AGENTE, Accept: "application/atom+xml" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!resp.ok) {
    registrar(`Reddit respondió ${resp.status}${resp.status === 429 ? " (pidió esperar)" : ""}; se reintenta en la próxima ronda.`);
    process.exit(0);
  }
  rss = await resp.text();
} catch (err) {
  registrar(`Sin conexión con Reddit (${err.message}); se reintenta en la próxima ronda.`);
  process.exit(0);
}

// 2) Enviarlo al radar en Vercel.
try {
  const resp = await fetch(`${SITIO}/api/trigger-scraper`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${clave}` },
    body: JSON.stringify({ rss }),
    signal: AbortSignal.timeout(90_000),
  });
  const datos = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const pista = resp.status === 401 ? " (la clave de tools/.env.radar no coincide con CRON_SECRET en Vercel)" : "";
    registrar(`El servidor respondió ${resp.status}: ${datos.error || "sin detalle"}${pista}`);
    process.exit(1);
  }
  const quedan = datos.pendientes - datos.evaluados;
  registrar(`${datos.leidos} leídas · ${datos.evaluados} evaluadas con IA · ${datos.nuevos} leads nuevos`
    + `${quedan > 0 ? ` · ${quedan} para la próxima ronda` : ""}`
    + `${datos.errores?.length ? ` · ${datos.errores.join(" | ")}` : ""}`
    + `${datos.nuevos && datos.errorTelegram ? ` · Telegram: ${datos.errorTelegram}` : ""}`);
} catch (err) {
  registrar(`No se pudo contactar el radar en ${SITIO} (${err.message}).`);
  process.exit(1);
}
