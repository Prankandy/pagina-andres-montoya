// ============================================================
//  Comportamiento común a todas las páginas: menú, animaciones,
//  datos de contacto (config.js) y formulario de contacto.
// ============================================================
(function () {
  "use strict";

  const CONFIG = window.CONFIG || {};
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  // ---------- Año del pie de página ----------
  const year = $("#year");
  if (year) year.textContent = new Date().getFullYear();

  // ---------- Cabecera: línea inferior al hacer scroll ----------
  const header = $(".site-header");
  if (header) {
    const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  // ---------- Menú móvil ----------
  const toggle = $(".nav-toggle");
  const nav = $("#site-nav");
  if (toggle && nav) {
    const setOpen = (open) => {
      nav.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
    };
    toggle.addEventListener("click", () => setOpen(!nav.classList.contains("open")));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
  }

  // ---------- Animación de aparición ----------
  const reveals = $$(".reveal");
  // Misma regla que effects.js: la clase fx-on la pone el script del <head>
  // (preferencia del sistema o interruptor "Efectos" del pie de página).
  const reduceMotion = !document.documentElement.classList.contains("fx-on");
  if (!reduceMotion && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in");
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12 });
    reveals.forEach((el, i) => {
      el.style.transitionDelay = `${(i % 4) * 60}ms`;
      io.observe(el);
    });
  } else {
    reveals.forEach((el) => el.classList.add("in"));
  }

  // ---------- Datos de contacto desde config.js ----------
  const hideItem = (link) => {
    const li = link.closest("li");
    if (li) li.hidden = true; else link.hidden = true;
  };

  $$("[data-contact]").forEach((link) => {
    const kind = link.dataset.contact;
    const value = (CONFIG[kind] || "").trim();
    if (!value) { hideItem(link); return; }

    switch (kind) {
      case "whatsapp":
        link.href = "https://wa.me/" + value.replace(/\D/g, "");
        break;
      case "email": {
        link.href = "mailto:" + value;
        const label = $('[data-contact-label="email"]', link);
        if (label) label.textContent = value;
        break;
      }
      default:
        link.href = value;
    }
  });

  $$("[data-config]").forEach((el) => {
    const value = (CONFIG[el.dataset.config] || "").trim();
    if (value) el.textContent = value; else el.hidden = true;
  });

  // Foto de perfil (si está configurada): avatar de la portada y logo de la cabecera
  if (CONFIG.foto) {
    const img = new Image();
    img.src = CONFIG.foto;
    img.alt = "";
    img.onload = () => {
      const avatar = $("#avatar");
      if (avatar) { avatar.innerHTML = ""; avatar.appendChild(img); }
      $$(".brand-mark").forEach((mark) => {
        mark.classList.add("has-photo");
        mark.innerHTML = "";
        mark.appendChild(img.cloneNode());
      });
    };
  }

  // ---------- Formulario de contacto ----------
  const form = $("#contact-form");
  if (form) {
    const submit = $("#form-submit");
    const note = $("#form-note");
    const error = $("#form-error");
    const useWhatsApp = Boolean((CONFIG.whatsapp || "").trim());
    const useEmail = Boolean((CONFIG.email || "").trim());

    if (useWhatsApp) {
      submit.textContent = "Enviar por WhatsApp";
      note.textContent = "Al enviar se abre WhatsApp con el mensaje listo. No guardo tus datos.";
    } else if (useEmail) {
      submit.textContent = "Enviar por correo";
      note.textContent = "Al enviar se abre tu aplicación de correo con el mensaje listo. No guardo tus datos.";
    }

    // Preseleccionar el tipo si se llega con ?tipo=... (ej. desde "Consultar para mi negocio")
    const tipoParam = new URLSearchParams(window.location.search).get("tipo");
    if (tipoParam && form.elements.tipo) {
      const opt = Array.from(form.elements.tipo.options).find((o) => o.value === tipoParam);
      if (opt) opt.selected = true;
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const fields = ["nombre", "contacto", "mensaje"].map((n) => form.elements[n]);
      let valid = true;
      fields.forEach((f) => {
        const ok = f.value.trim().length > 0;
        f.classList.toggle("is-invalid", !ok);
        if (!ok) valid = false;
      });
      error.hidden = valid;
      if (!valid) { fields.find((f) => !f.value.trim())?.focus(); return; }

      const nombre = form.elements.nombre.value.trim();
      const contacto = form.elements.contacto.value.trim();
      const tipoSel = form.elements.tipo;
      const tipo = tipoSel.selectedOptions[0] ? tipoSel.selectedOptions[0].text : tipoSel.value;
      const mensaje = form.elements.mensaje.value.trim();

      const texto = [
        `Hola ${CONFIG.nombre || "Andrés"}, te escribo desde tu página.`,
        ``,
        `Nombre: ${nombre}`,
        `Contacto: ${contacto}`,
        `Tipo de proyecto: ${tipo}`,
        ``,
        mensaje,
      ].join("\n");

      if (useWhatsApp) {
        const num = CONFIG.whatsapp.replace(/\D/g, "");
        window.open(`https://wa.me/${num}?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
      } else if (useEmail) {
        const subject = encodeURIComponent(`Proyecto: ${tipo} — ${nombre}`);
        window.location.href = `mailto:${CONFIG.email}?subject=${subject}&body=${encodeURIComponent(texto)}`;
      }
    });

    // Quitar el estado de error al escribir
    form.addEventListener("input", (e) => {
      if (e.target.classList) e.target.classList.remove("is-invalid");
    });
  }
})();
