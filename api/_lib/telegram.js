// ============================================================
//  Alertas a Telegram cuando entran leads nuevos.
//  Lo urgente suena; lo demás llega en silencio para revisarlo
//  durante el día. Sin TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID no
//  envía nada, y un fallo de Telegram nunca frena el guardado.
// ============================================================

const PANEL = "https://andresfmontoya.vercel.app/admin";
const MAX_INDIVIDUALES = 5; // con más leads a la vez llega un solo resumen

const escapar = (texto) =>
  String(texto ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const recortar = (texto, max) => (texto.length > max ? `${texto.slice(0, max - 1).trimEnd()}…` : texto);

const esUrgente = (lead) => lead.urgencia === "alta";

function tarjeta(lead) {
  const titulo = lead.categoria === "soporte" ? "SOPORTE" : "DESARROLLO";
  const lineas = [
    `${esUrgente(lead) ? "🔴" : "🟡"} <b>${titulo}</b> · urgencia ${escapar(lead.urgencia)}`,
    `<b>${escapar(lead.nombre)}</b>`,
    `«${escapar(recortar(lead.necesidad, 400))}»`,
  ];
  const origen = [escapar(lead.fuente || "sin fuente")];
  if (/^https?:\/\//.test(lead.url || "") && lead.fuente !== "simulado") {
    origen.push(`<a href="${escapar(lead.url)}">ver publicación</a>`);
  }
  if (lead.telefono) origen.push(`+${escapar(lead.telefono)}`);
  lineas.push(origen.join(" · "), `<a href="${PANEL}">Abrir panel</a>`);
  return lineas.join("\n");
}

function resumen(leads) {
  const urgentes = leads.filter(esUrgente).length;
  const lineas = leads.slice(0, 15).map((l) =>
    `${esUrgente(l) ? "🔴" : "🟡"} <b>${escapar(l.nombre)}</b>: ${escapar(recortar(l.necesidad, 90))}`);
  if (leads.length > 15) lineas.push(`… y ${leads.length - 15} más`);
  const titulo = `<b>${leads.length} leads nuevos</b> (${urgentes} ${urgentes === 1 ? "urgente" : "urgentes"})`;
  return [titulo, ...lineas, `<a href="${PANEL}">Abrir panel</a>`].join("\n");
}

async function enviar(texto, { silencioso }) {
  const resp = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text: texto,
      parse_mode: "HTML",
      disable_notification: silencioso,
      link_preview_options: { is_disabled: true },
    }),
  });
  if (!resp.ok) throw new Error(`Telegram respondió ${resp.status}: ${await resp.text()}`);
}

/** Avisa de los leads nuevos. Devuelve cuántos mensajes salieron (0 si no está configurado). */
export async function avisarLeads(leads) {
  if (!leads.length || !process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) return 0;

  const mensajes = leads.length > MAX_INDIVIDUALES
    ? [{ texto: resumen(leads), silencioso: !leads.some(esUrgente) }]
    : leads.map((lead) => ({ texto: tarjeta(lead), silencioso: !esUrgente(lead) }));

  let enviados = 0;
  for (const m of mensajes) { // uno tras otro: Telegram limita las ráfagas al mismo chat
    try {
      await enviar(m.texto, m);
      enviados++;
    } catch (err) {
      console.error("Alerta de Telegram no enviada:", err.message);
    }
  }
  return enviados;
}
