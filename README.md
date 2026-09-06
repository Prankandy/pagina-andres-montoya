# Página personal — Andrés F. Montoya

Sitio de presentación, catálogo de servicios y contacto para desarrollo de software.
Es un sitio estático multipágina: **HTML + CSS + JS, sin frameworks ni paso de build**.

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
- En el pie de página hay un interruptor **"✨ Efectos"** que permite forzarlos o apagarlos
  en ese navegador (se guarda en `localStorage`).
- **Ojo en este PC:** Windows tiene desactivados los "Efectos de animación"
  (Configuración → Accesibilidad → Efectos visuales), por eso Brave/Chrome no muestran las
  animaciones hasta que actives ese ajuste o uses el interruptor del pie.
- Para poner la lluvia de números en otra sección, agrégale la clase `rain-bg`.
- Las conversaciones del chat se editan en `CHATS` dentro de `js/effects.js`.

## Formulario de contacto

No necesita servidor. Al enviar, arma el mensaje y abre **WhatsApp** (si configuraste el número)
o el **correo** del visitante con todo listo. No guarda datos de nadie.

Si más adelante quieres recibir los mensajes en tu bandeja sin que el visitante abra nada,
puedes conectar el formulario a un servicio gratuito como [Web3Forms](https://web3forms.com)
o [Formspree](https://formspree.io) cambiando el `submit` en `js/main.js`.

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
