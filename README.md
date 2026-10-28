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
   En `analytics` va el ID de medición de Google Analytics 4 (`G-…`): con él, la página mide visitas y
   cuenta como contacto (`generate_lead`) cada clic en WhatsApp o correo y cada envío del formulario.
   Vacío = sin analítica. Nunca se carga en `/admin`. Si cambias el WhatsApp o el correo, cámbialos
   también en los datos estructurados de `index.html` (bloque `ProfessionalService`).
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
una plantilla de mensaje y abre WhatsApp (si hay teléfono) o el enlace del cliente. Además:

- **Contadores** de nuevos, contactados y cerrados (con el % cerrado) de la pestaña actual.
- **Notas** de seguimiento por lead ("Agregar nota"; Ctrl + Enter guarda, Esc cancela). Hasta 2000 caracteres.
- **Agregar lead** a mano (texto, enlace, quién y categoría o "que decida la IA"): para pedidos que ves en
  Facebook, WhatsApp, LinkedIn o Workana, donde no se puede automatizar. Gemini le pone resumen y categoría.
- **Marcador "Enviar al radar"**: en el formulario de captura hay un botón para arrastrar a la barra de
  favoritos. En cualquier página, selecciona el pedido y pulsa el favorito: se abre el panel con el texto y
  el enlace listos (en una pestaña que se reutiliza). El texto viaja en el `#` de la dirección, que el
  navegador no envía al servidor.
- **Exportar CSV** de lo que se ve con los filtros actuales. Usa `;` y UTF-8 con BOM para que Excel en
  español lo abra en columnas y con tildes; los textos que empiezan con `=`, `+`, `-` o `@` se guardan
  con `'` delante para que Excel no los ejecute como fórmulas.

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

**Lector local (Reddit bloquea a Vercel):** desde el 2026-10-20 Reddit responde 403 a las consultas
que salen de los servidores de Vercel, pero no a una conexión de casa. Por eso el feed lo descarga
`tools/radar-local.mjs` desde el PC y lo envía a `/api/trigger-scraper` (con `CRON_SECRET`); el
servidor hace todo lo demás. Lo corre el Programador de tareas de Windows cada 5 minutos y al iniciar
sesión, sin abrir ventanas. Solo trabaja con el PC encendido; al encenderlo se pone al día con las
últimas ~20 horas.

- Clave: `tools/.env.radar` (fuera de git) con `CRON_SECRET=...`, la misma que en Vercel.
- Fuentes que descarga: Reddit, Freelancer.com y cada alerta de Google que agregues en
  `tools/.env.radar` como `ALERTA=<enlace RSS>` (una línea por alerta). Para crearla: en
  google.com/alerts escribe la búsqueda (p. ej. `"necesito página web" Medellín`), en "Mostrar
  opciones" elige **Enviar a: Feed RSS**, crea la alerta y copia el enlace del ícono RSS.
- Freelancer.com es global y casi todo en inglés: solo pasan a la IA los proyectos en español y del
  rubro (web, tiendas, sistemas, facturación, integraciones…). Allí se cotiza dentro de la plataforma:
  su plantilla de propuesta no incluye WhatsApp (Freelancer no permite compartir contacto antes de adjudicar).
- Instalar: `powershell -ExecutionPolicy Bypass -File tools\instalar-radar.ps1`
- Registro de cada ronda: `tools/radar-local.log`
- Quitar: `Unregister-ScheduledTask -TaskName "Radar de leads" -Confirm:$false`
- El cron de Supabase (`supabase/cron.sql`) queda pausado: `select cron.unschedule('radar-reddit');`.
  Sirve de nuevo si algún día Reddit aprueba una app con su API oficial.

**El radar (Reddit + IA):** cada ronda (lector del PC, o el botón "Buscar leads ahora", que intenta
descargar desde Vercel) hace esto en `api/trigger-scraper.js`:

1. Lee por RSS las publicaciones de las últimas 24 h (`api/_lib/scraper.js`) de r/medellin, r/colombia,
   r/Bogota, r/ColombiaReddit, r/Barranquilla, r/bucaramanga, r/cartagena, r/Pereira y r/EmprendedorES.
   Reddit bloquea los feeds `.json` sin cuenta y permite ~1 consulta por minuto: todas van en una sola
   consulta por ronda (las 100 publicaciones más nuevas). Se evitan comunidades de programadores: ahí
   no escriben clientes y solo gastarían cuota de la IA.
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
y `og:image` de cada página ya apuntan ahí; si cambias de dominio, reemplázalo en las 7 páginas
(incluidos los datos estructurados JSON-LD de `index.html` y `facturacion-electronica.html`),
en `sitemap.xml` y en `robots.txt`.

**SEO:** cada página tiene un solo H1 con su servicio y la ciudad, título de ≤ 65 caracteres y
descripción de ≤ 160 (Google corta lo que pase de ahí). La portada declara el negocio como
`ProfessionalService` con zona de servicio Medellín, Valle de Aburrá y Colombia: mantén nombre,
teléfono y zona iguales en Google Business Profile. Al cambiar páginas, actualiza `<lastmod>` en
`sitemap.xml`.
