// ============================================================
//  Efectos visuales: entrada animada, simulador de chat, código
//  que se escribe solo, luz que sigue al cursor, inclinación 3D,
//  barra de progreso, botón "subir", transición entre páginas y
//  aviso al enviar el formulario.
//
//  Todo respeta la preferencia "reducir movimiento" del sistema:
//  si está activa, no hay animaciones y el contenido se muestra
//  completo de inmediato.
// ============================================================
(function () {
  "use strict";

  const CONFIG = window.CONFIG || {};
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  // La clase fx-on la pone el script del <head>: preferencia del sistema o
  // el interruptor "Efectos" del pie de página (guardado en localStorage).
  const reduceMotion = !document.documentElement.classList.contains("fx-on");
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // ---------- Interruptor "Efectos" en el pie de página ----------
  const footer = $(".footer-inner");
  if (footer) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fx-toggle";
    btn.textContent = reduceMotion ? "✨ Efectos: desactivados" : "✨ Efectos: activados";
    btn.title = "Activar o desactivar las animaciones de esta página";
    btn.addEventListener("click", () => {
      try { localStorage.setItem("efectos", reduceMotion ? "on" : "off"); } catch (_) { /* sin almacenamiento */ }
      window.location.reload();
    });
    footer.appendChild(btn);
  }

  // ---------- Barra de progreso de lectura ----------
  const bar = document.createElement("div");
  bar.className = "scroll-progress";
  bar.setAttribute("aria-hidden", "true");
  document.body.appendChild(bar);
  const updateBar = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
  };
  updateBar();
  window.addEventListener("scroll", updateBar, { passive: true });
  window.addEventListener("resize", updateBar);

  // ---------- Botón "subir" ----------
  const topBtn = document.createElement("button");
  topBtn.className = "back-to-top";
  topBtn.type = "button";
  topBtn.setAttribute("aria-label", "Volver arriba");
  topBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  document.body.appendChild(topBtn);
  const toggleTop = () => topBtn.classList.toggle("show", window.scrollY > 600);
  toggleTop();
  window.addEventListener("scroll", toggleTop, { passive: true });
  topBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" }));

  // ---------- Fundido al cambiar de página ----------
  if (!reduceMotion) {
    document.addEventListener("click", (e) => {
      const a = e.target.closest("a[href]");
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (a.target === "_blank" || a.hasAttribute("download")) return;
      let url;
      try { url = new URL(a.href, window.location.href); } catch (_) { return; }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.hash) return; // ancla en la misma página
      e.preventDefault();
      document.body.classList.add("page-leave");
      setTimeout(() => { window.location.href = url.href; }, 180);
    });
    // Si el visitante vuelve con "atrás", quitar el fundido
    window.addEventListener("pageshow", () => document.body.classList.remove("page-leave"));
  }

  // ---------- Luz que sigue al cursor ----------
  if (finePointer && !reduceMotion) {
    $$(".card, .project, .step, .service-links a, .cta-inner, .about-stack, .contact-form, .chat-demo, .code-card")
      .forEach((el) => el.classList.add("spot"));
    document.addEventListener("pointermove", (e) => {
      const el = e.target.closest(".spot");
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    }, { passive: true });
  }

  // ---------- Inclinación 3D suave ----------
  if (finePointer && !reduceMotion) {
    $$(".code-card, .chat-demo").forEach((el) => {
      el.classList.add("tilt");
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(900px) rotateX(${(-y * 7).toFixed(2)}deg) rotateY(${(x * 7).toFixed(2)}deg)`;
      });
      el.addEventListener("pointerleave", () => { el.style.transform = ""; });
    });
  }

  // ---------- Código que se escribe solo (portada) ----------
  const SNIPPETS = [
`const proyecto = {
  cliente:  "tu negocio",
  objetivo: "vender más y
             trabajar menos",
  entrega:  "a tiempo",
};`,
`// inventario en varias sedes
const sedes = ["norte", "centro"];
const reporte = consolidar(sedes);
exportarExcel(reporte); // listo ✔`,
`// tienda Shopify
aplicarDescuento({
  cantidad: 12,
  regla: "por volumen",
}); // -8% ✔`,
  ];
  const pre = $(".code-card pre");
  if (pre && !reduceMotion) {
    const text = document.createElement("span");
    const cursor = document.createElement("span");
    cursor.className = "code-cursor";
    cursor.textContent = "▍";
    pre.textContent = "";
    pre.append(text, cursor);
    const type = async (s) => {
      for (const ch of s) {
        text.textContent += ch;
        await sleep(ch === "\n" ? 110 : 26 + Math.random() * 38);
      }
    };
    const erase = async () => {
      while (text.textContent.length) {
        text.textContent = text.textContent.slice(0, -3);
        await sleep(12);
      }
    };
    (async () => {
      let i = 0;
      for (;;) {
        await type(SNIPPETS[i]);
        await sleep(3400);
        await erase();
        i = (i + 1) % SNIPPETS.length;
      }
    })();
  }

  // ---------- Simulador de chat ----------
  // Cada conversación se identifica con data-chat="..." en el HTML.
  const CHATS = {
    inicio: [
      { from: "cliente", text: "Hola Andrés 👋 Tengo una tienda con dos sedes y el inventario lo llevo en Excel… se me descuadra todo." },
      { from: "yo", text: "¡Hola! Tranquilo, eso se resuelve. ¿Con qué sistema facturas hoy?" },
      { from: "cliente", text: "Con un programa viejo. Y los conteos los hacemos a mano cada mes 😩" },
      { from: "yo", text: "Perfecto. Puedo conectarme a tu sistema, consolidar las dos sedes y que los reportes salgan solos." },
      { from: "yo", text: "Hoy mismo te envío una propuesta con alcance, tiempos y costo 📄" },
      { from: "cliente", text: "¡De una! 🙌" },
    ],
    proceso: [
      { from: "cliente", text: "¿Cómo funciona si quiero trabajar contigo?" },
      { from: "yo", text: "Primero conversamos: me cuentas tu negocio y qué te quita tiempo. Sin tecnicismos." },
      { from: "yo", text: "Luego te mando una propuesta por escrito: qué incluye, cuánto tarda y cuánto cuesta." },
      { from: "cliente", text: "¿Y veo avances o me entero al final?" },
      { from: "yo", text: "Ves avances desde el inicio. Entrego por partes y ajustamos sobre la marcha." },
      { from: "yo", text: "Al final publico el proyecto, te enseño a usarlo y sigo disponible para mejoras ✅" },
      { from: "cliente", text: "Me gusta. ¿Por dónde empezamos?" },
      { from: "yo", text: "Por el paso 01: escríbeme 😉" },
    ],
  };

  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const hora = () => new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

  $$(".chat-demo").forEach((box) => {
    const script = CHATS[box.dataset.chat];
    const body = $(".chat-body", box);
    const status = $(".chat-status", box);
    if (!script || !body) return;

    if (CONFIG.foto) {
      $$(".chat-avatar-me", box).forEach((a) => { a.innerHTML = `<img src="${CONFIG.foto}" alt="">`; });
    }

    const bubble = (m) => {
      const el = document.createElement("div");
      el.className = `msg msg-${m.from}`;
      el.innerHTML = `<span class="msg-text">${esc(m.text)}</span>` +
        `<span class="msg-meta">${hora()}${m.from === "yo" ? ' <i class="ticks">✓✓</i>' : ""}</span>`;
      return el;
    };
    const typing = (from) => {
      const el = document.createElement("div");
      el.className = `msg msg-${from} msg-typing`;
      el.innerHTML = "<i></i><i></i><i></i>";
      return el;
    };
    const scrollDown = () => { body.scrollTop = body.scrollHeight; };

    if (reduceMotion) {
      script.forEach((m) => body.appendChild(bubble(m)));
      scrollDown();
      return;
    }

    let started = false;
    const play = async () => {
      if (started) return;
      started = true;
      for (;;) {
        body.innerHTML = "";
        for (const m of script) {
          const t = typing(m.from);
          body.appendChild(t);
          scrollDown();
          if (status) status.textContent = m.from === "yo" ? "escribiendo…" : "en línea";
          await sleep(650 + Math.min(1500, m.text.length * 20));
          t.replaceWith(bubble(m));
          if (status) status.textContent = "en línea";
          scrollDown();
          await sleep(550);
        }
        await sleep(5500);
      }
    };

    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        if (entries.some((x) => x.isIntersecting)) { play(); io.disconnect(); }
      }, { threshold: 0.3 });
      io.observe(box);
    } else {
      play();
    }
  });

  // ---------- Aviso al enviar el formulario ----------
  let toastTimer;
  const toast = (msg) => {
    let t = $(".toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "toast";
      t.setAttribute("role", "status");
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
  };
  const form = $("#contact-form");
  if (form) {
    // main.js valida primero; si dejó el error visible, no avisamos.
    form.addEventListener("submit", () => {
      const err = $("#form-error");
      if (err && !err.hidden) return;
      toast((CONFIG.whatsapp || "").trim() ? "Abriendo WhatsApp con tu mensaje…" : "Abriendo tu correo con el mensaje…");
    });
  }

  // ---------- Lluvia de números dorados ----------
  // Se dibuja detrás del contenido del hero de la portada y de cualquier
  // sección que lleve la clase "rain-bg". Se detiene cuando la pestaña
  // no está visible.
  if (!reduceMotion) {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    $$(".hero, .rain-bg").forEach((host) => {
      const canvas = document.createElement("canvas");
      canvas.className = "rain";
      canvas.setAttribute("aria-hidden", "true");
      host.appendChild(canvas);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const CHARS = "0123456789";
      const fontSize = coarse ? 14 : 16;
      const fps = coarse ? 16 : 24;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      let w = 0, h = 0, cols = 0, drops = [];

      const resize = () => {
        const r = host.getBoundingClientRect();
        w = Math.max(1, Math.round(r.width));
        h = Math.max(1, Math.round(r.height));
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + "px";
        canvas.style.height = h + "px";
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.font = `${fontSize}px "JetBrains Mono", ui-monospace, Consolas, monospace`;
        cols = Math.ceil(w / fontSize);
        drops = Array.from({ length: cols }, () => -Math.random() * 60);
      };
      resize();
      window.addEventListener("resize", resize);

      let last = 0;
      let running = true;
      const frame = (t) => {
        if (!running) return;
        requestAnimationFrame(frame);
        if (t - last < 1000 / fps) return;
        last = t;
        // Desvanece lo anterior hacia transparente (no hacia negro), así se
        // sigue viendo el fondo del hero.
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = "rgba(0, 0, 0, 0.16)";
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = "source-over";
        for (let i = 0; i < cols; i++) {
          const ch = CHARS[(Math.random() * CHARS.length) | 0];
          const x = i * fontSize;
          const y = drops[i] * fontSize;
          ctx.fillStyle = Math.random() < 0.07 ? "#ffe58a" : "rgba(242, 201, 76, 0.75)";
          ctx.fillText(ch, x, y);
          if (y > h && Math.random() > 0.975) drops[i] = 0;
          drops[i] += 1;
        }
      };
      requestAnimationFrame(frame);
      document.addEventListener("visibilitychange", () => {
        const wasRunning = running;
        running = !document.hidden;
        if (running && !wasRunning) requestAnimationFrame(frame);
      });
    });
  }
})();
