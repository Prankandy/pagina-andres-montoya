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

// Al pegar en Vercel a veces se cuela un espacio o un salto de línea.
const token = () => (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const chatId = () => (process.env.TELEGRAM_CHAT_ID || "").trim();

async function enviar(texto, { silencioso }) {
  const resp = await fetch(`https://api.telegram.org/bot${token()}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId(),
      text: texto,
      parse_mode: "HTML",
      disable_notification: silencioso,
      link_preview_options: { is_disabled: true },
    }),
  });
  if (resp.ok) return;

  const motivo = (await resp.json().catch(() => ({}))).description || `error ${resp.status}`;
  const pista = resp.status === 401 || resp.status === 404 ? " (revisa TELEGRAM_BOT_TOKEN en Vercel)"
    : /chat not found/i.test(motivo) ? " (revisa TELEGRAM_CHAT_ID y que le hayas escrito al bot)"
    : "";
  throw new Error(`Telegram: ${motivo}${pista}`);
}

/**
 * Avisa de los leads nuevos. Devuelve { enviados, error }; error explica
 * por qué no salió algún mensaje (para mostrarlo en el panel).
 */
export async function avisarLeads(leads) {
  if (!leads.length) return { enviados: 0, error: null };
  if (!token() || !chatId()) {
    return { enviados: 0, error: "Faltan TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID en Vercel (o falta redesplegar)." };
  }

  const mensajes = leads.length > MAX_INDIVIDUALES
    ? [{ texto: resumen(leads), silencioso: !leads.some(esUrgente) }]
    : leads.map((lead) => ({ texto: tarjeta(lead), silencioso: !esUrgente(lead) }));

  let enviados = 0;
  let error = null;
  for (const m of mensajes) { // uno tras otro: Telegram limita las ráfagas al mismo chat
    try {
      await enviar(m.texto, m);
      enviados++;
    } catch (err) {
      error = err.message;
      console.error("Alerta de Telegram no enviada:", err.message);
    }
  }
  return { enviados, error };
}
