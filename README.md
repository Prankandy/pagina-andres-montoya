# Página personal — Andrés F. Montoya

Sitio de presentación, catálogo de servicios y contacto para desarrollo de software.
Es un sitio estático multipágina: **HTML + CSS + JS, sin frameworks ni paso de build**.
Incluye un panel privado de leads (`/admin`) que usa funciones de Vercel y Supabase.

## Estructura

```
Pagina Andres F. Montoya/
├── index.html          # Portada: presentación, accesos a servicios, resumen y llamado a contacto
├── sobre-mi.html       # Quién soy y tecnologías
├── servicios.html      # Catálogo de servicios por grupos + sistema de facturación
├── facturacion-electronica.html  # Página de especialidad (DIAN, RADIAN, soporte, integraciones), pensada para buscadores
├── proyectos.html      # Trabajos recientes
├── proceso.html        # Cómo trabajamos + preguntas frecuentes
├── contacto.html       # Enlaces directos y formulario
├── css/styles.css      # Estilos (tema oscuro, acento dorado, responsive)
├── js/config.js        # ⭐ TUS DATOS: WhatsApp, correo, GitHub, LinkedIn, ubicación, foto
├── js/main.js          # Menú móvil, datos de contacto, formulario
├── js/effects.js       # Animaciones, chat simulado y efectos (se apagan con "reducir movimiento")
├── assets/favicon.svg  # Ícono de la pestaña
├── robots.txt          # Permite indexar el sitio y apunta al sitemap
├── sitemap.xml         # Mapa del sitio para Google (URLs limpias de Vercel)
├── assets/og.png       # Imagen de vista previa al compartir el enlace (1200×630)
├── vercel.json         # Configuración para publicar en Vercel (URLs limpias: /servicios, /contacto…)
├── admin.html          # Panel privado de leads (no aparece en el menú ni en buscadores)
├── css/admin.css       # Estilos propios del panel
├── js/admin.js         # Panel: sesión, tabla, filtros, estados y plantillas de contacto
├── api/                # Funciones de Vercel (servidor)
│   ├── login.js        #   POST: valida la contraseña y entrega un token de sesión
│   ├── leads.js        #   GET: lista con filtros · PATCH: cambia el estado
│   ├── trigger-scraper.js  # POST: corre el rastreo y guarda los leads nuevos
│   └── _lib/           #   Supabase, sesión, Telegram, lector de Reddit (scraper.js) y filtro con IA (ai-filter.js)
├── supabase/schema.sql # Tablas leads y revisados: pegar en el SQL Editor de Supabase
├── supabase/cron.sql   # Radar cada 5 minutos con Supabase Cron
├── package.json        # Única dependencia: @supabase/supabase-js (la usan las funciones)
└── README.md
```

## Cómo verla

Abre `index.html` en el navegador, usa la extensión **Live Server** de VS Code, o desde esta carpeta:

```
npx -y serve -l 3000 .
```

## Qué editar primero

1. **`js/config.js`** — pon tu número de WhatsApp (formato `573001234567`), tu correo,
   LinkedIn y, si quieres, la ruta a tu foto (`assets/foto.jpg`). Los enlaces vacíos se ocultan solos.
2. **Textos** — cada página es un archivo independiente; edita el que corresponda.
3. **Cabecera y pie** — están repetidos en cada página (marcados con un comentario).
   Si agregas o renombras una página, actualiza el menú en las seis.
   El enlace de la página actual lleva `aria-current="page"`; así se marca como activo.
4. Para cambiar el color de acento, edita `--accent` al inicio de `css/styles.css`.

## Animaciones y efectos

Los efectos (chat simulado, código que se escribe solo, lluvia de números dorados,
luz que sigue al cursor, cinta de tecnologías, transiciones) viven en `js/effects.js`.

- Respetan la preferencia **"reducir movimiento"** del sistema: si está activa, la página
  se muestra completa y quieta.
- **Ojo en este PC:** Windows tiene desactivados los "Efectos de animación"
  (Configuración → Accesibilidad → Efectos visuales), Brave/Chrome no mostrarán las animaciones
  hasta que actives ese ajuste.
- Para poner la lluvia de números en otra sección, agrégale la clase `rain-bg`.
- Las conversaciones del chat se editan en `CHATS` dentro de `js/effects.js`.

## Formulario de contacto

No necesita servidor. Al enviar, arma el mensaje y abre **WhatsApp** (si configuraste el número)
o el **correo** del visitante con todo listo. No guarda datos de nadie.

Si más adelante quieres recibir los mensajes en tu bandeja sin que el visitante abra nada,
puedes conectar el formulario a un servicio gratuito como [Web3Forms](https://web3forms.com)
o [Formspree](https://formspree.io) cambiando el `submit` en `js/main.js`.

## Panel de leads (`/admin`)

Lista de personas y negocios que pidieron ayuda, con pestañas (Todos, Soporte hoy, Proyectos dev),
filtro por estado, selector para pasar cada lead de NUEVO a CONTACTADO o CERRADO, y un botón que copia
una plantilla de mensaje y abre WhatsApp (si hay teléfono) o el enlace del cliente.

**Cómo está protegido:** el navegador nunca ve las claves. La contraseña y la clave de Supabase viven
en Vercel; `admin.js` solo guarda en `sessionStorage` un token firmado que vence a las 12 horas.
La tabla tiene RLS activo y sin políticas, así que la clave pública de Supabase no puede leerla.

**Puesta en marcha (una sola vez):**

1. En Supabase → **SQL Editor** → New query, pega `supabase/schema.sql` y pulsa **Run**.
2. En Vercel → el proyecto → **Settings → Environment Variables**, agrega:

   | Variable | Valor |
   | --- | --- |
   | `SUPABASE_URL` | `https://huyjdlocyvgyprmkovvj.supabase.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → **Secret key** (`sb_secret_…`) |
   | `ADMIN_PASSWORD` | La contraseña del panel. Usa una larga (4 o más palabras). |
   | `TELEGRAM_BOT_TOKEN` | Token del bot (@BotFather). Opcional: sin él no hay alertas. |
   | `TELEGRAM_CHAT_ID` | Tu chat con el bot (número). Opcional, va junto con el token. |
   | `GEMINI_API_KEY` | aistudio.google.com → Get API key (plan gratuito). La usa el filtro con IA del radar. |
   | `GEMINI_MODEL` | Opcional. Por defecto `gemini-flash-lite-latest`, que Google actualiza solo. |
   | `CRON_SECRET` | La clave que genera `supabase/cron.sql` (paso 3). Permite que Supabase Cron corra el radar. |

   La clave `sb_publishable_…` **no** sirve aquí. La secret key no va en ningún archivo del repositorio.
3. Publica (`git push`) y entra a <https://andresfmontoya.vercel.app/admin>.

**El radar (Reddit + IA):** cada ronda (botón "Buscar leads ahora" o Supabase Cron cada 5 minutos)
hace esto en `api/trigger-scraper.js`:

1. Lee por RSS las publicaciones de las últimas 24 h de r/medellin y r/colombia (`api/_lib/scraper.js`).
   Reddit bloquea los feeds `.json` sin cuenta y permite ~1 consulta por minuto: una sola por ronda.
2. Descarta las que ya se revisaron (tabla `revisados`) o que repiten el texto de un lead (huella).
3. Evalúa las nuevas con Gemini en su plan gratuito (`api/_lib/ai-filter.js`): ¿es un pedido real?,
   categoría (soporte inmediato o proyecto), urgencia y resumen de una frase. Respuesta en JSON
   forzado con `responseSchema`. De a una y máximo 8 por ronda, porque el plan gratuito limita las
   consultas por minuto; si Gemini pide esperar o falla la red, la ronda se detiene y esas
   publicaciones se reintentan en la siguiente (no se pierden). Ojo: en el plan gratuito Google
   puede usar lo que se le envía para mejorar sus productos; aquí solo van publicaciones públicas de Reddit.
4. Guarda los pedidos reales como leads (con su resumen) y avisa por Telegram.

Qué cuenta como pedido se ajusta en el texto `SISTEMA` de `api/_lib/ai-filter.js`; los subreddits, en
`SUBREDDITS` de `api/_lib/scraper.js`. Las publicaciones descartadas quedan en `revisados` con su resumen,
útil para revisar si el filtro deja pasar o descarta de más:
`select resumen, url from revisados where not es_lead order by revisado_en desc limit 50;`

Para borrar los leads de prueba de la versión simulada: `delete from public.leads where fuente = 'simulado';`

**Plantillas de mensaje:** se editan en `PLANTILLAS`, al inicio de `js/admin.js`.

**Alertas a Telegram** (`api/_lib/telegram.js`): cada lead nuevo llega como tarjeta al bot
@AndresF_Montoya_Bot. Los de urgencia alta suenan; los demás llegan en silencio. Si entran más de
5 a la vez, llega un solo resumen. Si Telegram falla, el lead se guarda igual.

**Duplicados:** un lead no entra dos veces si tiene la misma url o el mismo texto (columna `huella`:
hash del texto sin tildes, mayúsculas ni signos; los textos de menos de 40 letras no llevan huella).
Si actualizas desde una versión anterior, vuelve a correr `supabase/schema.sql`: solo agrega lo que falta.

**Probarlo en tu PC:** el panel necesita las funciones de `/api`, que `npx serve` no ejecuta.
Usa `npx vercel dev` (pide iniciar sesión en Vercel) o pruébalo directamente en el sitio publicado.

## Publicar gratis en Vercel

1. Sigue la guía paso a paso en **[DESPLIEGUE.md](DESPLIEGUE.md)** (el repositorio local ya está listo).
2. Entra a <https://vercel.com>, **Add New → Project**, elige el repositorio.
3. Framework: **Other**. No hay comando de build. Deploy.
4. (Opcional) Conecta tu dominio en **Settings → Domains**.

Gracias a `cleanUrls` en `vercel.json`, las páginas quedan como `/servicios`, `/contacto`, etc.
También funciona en Netlify o GitHub Pages sin cambios.

El sitio está publicado en <https://andresfmontoya.vercel.app>. Las etiquetas `canonical`, `og:url`
y `og:image` de cada página ya apuntan ahí; si cambias de dominio, reemplázalo en las 7 páginas,
en `sitemap.xml` y en `robots.txt`.
