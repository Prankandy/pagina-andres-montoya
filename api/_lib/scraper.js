// ============================================================
//  Fuentes del radar. Cada una se lee por RSS y se convierte al
//  mismo formato: { url, nombre, fuente, contexto, titulo, cuerpo, publicado }.
//
//  - Reddit: comunidades de Colombia y de emprendedores. Responde 403
//    a los feeds .json sin cuenta y a las consultas desde Vercel; el
//    RSS sigue abierto (~1 consulta por minuto) desde una conexión de casa.
//  - Google Alerts: alertas del usuario con entrega por RSS.
//  - Freelancer.com: RSS público de proyectos nuevos (global).
//
//  Los feeds los descarga tools/radar-local.mjs desde el PC y los envía
//  ya descargados; aquí solo se interpretan (parsearFeed).
// ============================================================

// Donde escriben posibles clientes (no comunidades de programadores). Verificadas por
// actividad el 2026-10-19; r/ColombiaReddit es la más ruidosa (política y noticias).
const SUBREDDITS = [
  "medellin", "colombia", "Bogota", "ColombiaReddit", "Barranquilla",
  "bucaramanga", "cartagena", "Pereira", "EmprendedorES",
];
const VENTANA_HORAS = 24; // solo publicaciones recientes: un pedido viejo ya no es oportunidad
export const AGENTE = "web:andresfmontoya-radar:v1.0 (contacto: andresfmontoya.vercel.app)";
export const URL_RSS = `https://www.reddit.com/r/${SUBREDDITS.join("+")}/new/.rss?limit=100`;
export const URL_FREELANCER = "https://www.freelancer.com/rss.xml";
const IGNORAR_AUTORES = new Set(["AutoModerator"]);

// ---------- Utilidades de XML ----------
// Entidades con nombre que aparecen en estos feeds (Freelancer usa &oacute;, &ntilde;…).
const ENTIDADES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", uuml: "ü",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Ntilde: "Ñ", Uuml: "Ü",
  iexcl: "¡", iquest: "¿", ordm: "º", ordf: "ª", deg: "°", euro: "€", laquo: "«", raquo: "»",
  hellip: "…", ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
  middot: "·", bull: "•", copy: "©", reg: "®", trade: "™",
};

function decodificar(texto) {
  return texto.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (todo, ent) => {
    if (ent[0] !== "#") return ENTIDADES[ent] ?? ENTIDADES[ent.toLowerCase()] ?? todo;
    const n = ent[1].toLowerCase() === "x" ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : todo;
  });
}

const etiqueta = (xml, nombre) => (xml.match(new RegExp(`<${nombre}[^>]*>([\\s\\S]*?)</${nombre}>`)) || [])[1] || "";
const atributo = (xml, nombre, attr) => (xml.match(new RegExp(`<${nombre}[^>]*\\b${attr}="([^"]*)"`)) || [])[1] || "";
const sinCdata = (texto) => texto.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1");
const entradas = (xml) => xml.split("<entry>").slice(1).map((e) => e.split("</entry>")[0]);

// HTML (escapado o no) → texto plano en una sola pieza.
function textoPlano(html) {
  const sinEtiquetas = decodificar(sinCdata(html)).replace(/<br\s*\/?>|<\/p>|<\/li>/gi, "\n").replace(/<[^>]+>/g, "");
  return decodificar(sinEtiquetas).replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

const reciente = (fecha) => Date.parse(fecha) >= Date.now() - VENTANA_HORAS * 3600 * 1000;

function hostDe(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

// ---------- Reddit ----------
// El texto de la publicación viene como HTML escapado dentro de <content>.
function cuerpoReddit(contenido) {
  const md = decodificar(contenido).match(/<div class="md">([\s\S]*?)<\/div>\s*<!-- SC_ON -->/);
  return md ? textoPlano(md[1]) : ""; // sin cuerpo: publicación de solo enlace o imagen
}

/** Descarga el feed de Reddit desde este servidor. Lanza un error con el motivo si no responde. */
export async function leerReddit() {
  const resp = await fetch(URL_RSS, {
    headers: { "User-Agent": AGENTE, Accept: "application/atom+xml" },
    signal: AbortSignal.timeout(15000),
  });
  if (resp.status === 429) throw new Error("Reddit pidió esperar (429); la próxima ronda lo intenta de nuevo.");
  if (resp.status === 403) {
    throw new Error("Reddit respondió 403: bloquea las consultas desde los servidores de Vercel. El lector de tu PC (tools/radar-local.mjs) envía el feed cada 5 minutos.");
  }
  if (!resp.ok) throw new Error(`Reddit respondió ${resp.status}.`);
  return parsearRss(await resp.text());
}

/** RSS de Reddit → publicaciones recientes con enlace de reddit.com. */
export function parsearRss(xml) {
  return entradas(xml)
    .map((e) => {
      const subreddit = atributo(e, "category", "term");
      return {
        url: atributo(e, "link", "href"),
        nombre: decodificar(etiqueta(etiqueta(e, "author"), "name")).replace(/^\/u\//, ""),
        fuente: `reddit r/${subreddit}`,
        contexto: `Reddit, comunidad r/${subreddit}`,
        titulo: decodificar(etiqueta(e, "title")).trim(),
        cuerpo: cuerpoReddit(etiqueta(e, "content")),
        publicado: etiqueta(e, "published"),
      };
    })
    .filter((p) => /^https:\/\/www\.reddit\.com\//.test(p.url) && p.titulo
      && !IGNORAR_AUTORES.has(p.nombre) && reciente(p.publicado));
}

// ---------- Google Alerts ----------
// Los enlaces pasan por google.com/url?...&url=DESTINO: se guarda el destino real.
function destinoGoogle(href) {
  try {
    const url = new URL(href);
    return /(^|\.)google\.[a-z.]+$/.test(url.hostname) && url.searchParams.get("url") ? url.searchParams.get("url") : href;
  } catch { return ""; }
}

/** RSS de una alerta de Google → fragmentos recientes de páginas web. */
export function parsearAlerta(xml) {
  const consulta = textoPlano(etiqueta(xml.split("<entry>")[0], "title")).replace(/^Google Alert\s*-\s*/i, "");
  return entradas(xml)
    .map((e) => {
      const url = destinoGoogle(decodificar(atributo(e, "link", "href")));
      const host = hostDe(url);
      return {
        url,
        nombre: host || "Página web",
        fuente: `google alerts · ${host}`,
        contexto: `Google Alerts (búsqueda: ${consulta}): fragmento de una página web de ${host}`,
        titulo: textoPlano(etiqueta(e, "title")),
        cuerpo: textoPlano(etiqueta(e, "content")),
        publicado: etiqueta(e, "published") || etiqueta(e, "updated"),
      };
    })
    .filter((p) => /^https?:\/\//.test(p.url) && p.titulo && reciente(p.publicado));
}

// ---------- Freelancer.com ----------
// El feed es global y casi todo en inglés. Para no gastar la cuota gratuita de la IA,
// solo pasan proyectos escritos en español y de los servicios de Andrés.
const MARCAS_ES = /\b(que|para|con|una|los|las|del|por|necesito|necesitamos|busco|buscamos|empresa|nuestro|nuestra)\b/g;
const MARCAS_EN = /\b(the|and|for|with|you|our|we|to|of|is|are|need)\b/g;
const RUBRO = /p[aá]gina|sitio web|\bweb\b|tienda|shopify|woocommerce|wordpress|e-?commerce|\bapp\b|aplicaci[oó]n|sistema|software|inventario|factura|\bpos\b|punto de venta|integraci[oó]n|\bapi\b|excel|automatiz|base de datos|programa|desarroll|php|javascript|react|node|python/i;

export function pareceEspanol(texto) {
  const t = texto.toLowerCase();
  const es = (t.match(MARCAS_ES) || []).length;
  return es >= 3 && es > (t.match(MARCAS_EN) || []).length;
}

/** RSS de Freelancer.com → proyectos en español y del rubro. */
export function parsearFreelancer(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
    .map(([, i]) => ({
      url: textoPlano(etiqueta(i, "link")),
      nombre: "Proyecto en Freelancer",
      fuente: "freelancer.com",
      contexto: "Freelancer.com: proyecto remoto publicado por un cliente; se cotiza dentro de la plataforma",
      titulo: textoPlano(etiqueta(i, "title")),
      cuerpo: textoPlano(etiqueta(i, "description")),
      publicado: etiqueta(i, "pubDate").trim(),
    }))
    .filter((p) => /^https:\/\/www\.freelancer\.com\//.test(p.url) && p.titulo && reciente(p.publicado)
      && pareceEspanol(`${p.titulo} ${p.cuerpo}`) && RUBRO.test(`${p.titulo} ${p.cuerpo}`));
}

// ---------- Todas ----------
const LECTORES = { reddit: parsearRss, alerta: parsearAlerta, freelancer: parsearFreelancer };
export const TIPOS_FEED = Object.keys(LECTORES);

/** Interpreta un feed según su tipo (reddit | alerta | freelancer). */
export const parsearFeed = (tipo, xml) => LECTORES[tipo](xml);

/** Título y cuerpo juntos: es lo que se guarda como "necesidad" y lo que lleva la huella. */
export const textoDe = (post) => (post.cuerpo ? `${post.titulo}\n\n${post.cuerpo}` : post.titulo);
