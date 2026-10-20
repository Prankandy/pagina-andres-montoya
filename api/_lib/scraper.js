// ============================================================
//  Rastreo de Reddit: publicaciones nuevas de r/medellin y
//  r/colombia por RSS. Desde 2026 Reddit responde 403 a los
//  feeds .json sin cuenta; el RSS sigue abierto, pero permite
//  ~1 consulta por minuto, así que se hace una sola por ronda.
// ============================================================

const SUBREDDITS = ["medellin", "colombia"];
const VENTANA_HORAS = 24; // solo publicaciones recientes: un pedido viejo ya no es oportunidad
const AGENTE = "web:andresfmontoya-radar:v1.0 (contacto: andresfmontoya.vercel.app)";
const IGNORAR_AUTORES = new Set(["AutoModerator"]);

const ENTIDADES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodificar(texto) {
  return texto.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (todo, ent) => {
    if (ent[0] !== "#") return ENTIDADES[ent.toLowerCase()] ?? todo;
    const n = ent[1].toLowerCase() === "x" ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : todo;
  });
}

const etiqueta = (xml, nombre) => (xml.match(new RegExp(`<${nombre}[^>]*>([\\s\\S]*?)</${nombre}>`)) || [])[1] || "";
const atributo = (xml, nombre, attr) => (xml.match(new RegExp(`<${nombre}[^>]*\\b${attr}="([^"]*)"`)) || [])[1] || "";

// El texto de la publicación viene como HTML escapado dentro de <content>.
function cuerpoDe(contenido) {
  const html = decodificar(contenido);
  const md = html.match(/<div class="md">([\s\S]*?)<\/div>\s*<!-- SC_ON -->/);
  if (!md) return ""; // publicación de solo enlace o imagen
  const texto = md[1].replace(/<br\s*\/?>|<\/p>|<\/li>/gi, "\n").replace(/<[^>]+>/g, "");
  return decodificar(texto).replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Lee las publicaciones nuevas. Devuelve [{ url, autor, subreddit, titulo, cuerpo, publicado }]
 * de las últimas VENTANA_HORAS. Lanza un error con el motivo si Reddit no responde.
 */
export async function leerReddit() {
  const resp = await fetch(`https://www.reddit.com/r/${SUBREDDITS.join("+")}/new/.rss?limit=100`, {
    headers: { "User-Agent": AGENTE, Accept: "application/atom+xml" },
    signal: AbortSignal.timeout(15000),
  });
  if (resp.status === 429) throw new Error("Reddit pidió esperar (429); la próxima ronda lo intenta de nuevo.");
  if (!resp.ok) {
    throw new Error(`Reddit respondió ${resp.status}${resp.status === 403 ? " (bloqueó la consulta desde este servidor)" : ""}.`);
  }

  const xml = await resp.text();
  const desde = Date.now() - VENTANA_HORAS * 3600 * 1000;

  return xml.split("<entry>").slice(1)
    .map((entrada) => ({
      url: atributo(entrada, "link", "href"),
      autor: decodificar(etiqueta(etiqueta(entrada, "author"), "name")).replace(/^\/u\//, ""),
      subreddit: atributo(entrada, "category", "term"),
      titulo: decodificar(etiqueta(entrada, "title")).trim(),
      cuerpo: cuerpoDe(etiqueta(entrada, "content")),
      publicado: etiqueta(entrada, "published"),
    }))
    .filter((p) => /^https:\/\/www\.reddit\.com\//.test(p.url) && p.titulo
      && !IGNORAR_AUTORES.has(p.autor) && Date.parse(p.publicado) >= desde);
}

/** Título y cuerpo juntos: es lo que se guarda como "necesidad" y lo que lleva la huella. */
export const textoDe = (post) => (post.cuerpo ? `${post.titulo}\n\n${post.cuerpo}` : post.titulo);
