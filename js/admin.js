// ============================================================
//  Panel de leads (admin.html): sesión, tabla, filtros, cambio
//  de estado y contacto con plantilla. Solo habla con /api: las
//  claves de Supabase y la contraseña viven en Vercel.
// ============================================================
(function () {
  "use strict";

  const CONFIG = window.CONFIG || {};
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  // ---------- Plantillas del botón de contacto ----------
  // Marcadores: {nombre} {necesidad} {yo} {ubicacion} {whatsapp} {sitio}
  const PLANTILLAS = {
    soporte: [
      "Hola {nombre}, vi tu mensaje: «{necesidad}».",
      "Soy {yo}, desarrollador de software en {ubicacion}. Puedo ayudarte a revisarlo hoy mismo.",
      "¿Hablamos por WhatsApp? Mi número es +{whatsapp}. Más sobre mi trabajo: {sitio}",
    ].join("\n\n"),
    desarrollo: [
      "Hola {nombre}, vi que buscas apoyo con esto: «{necesidad}».",
      "Soy {yo} y desarrollo software a la medida: sistemas web, apps e integraciones. Me gustaría proponerte una solución.",
      "¿Hablamos por WhatsApp? +{whatsapp} · {sitio}",
    ].join("\n\n"),
  };

  const ESTADOS = { NUEVO: "Nuevo", CONTACTADO: "Contactado", CERRADO: "Cerrado" };
  const CATEGORIAS = { soporte: "Soporte", desarrollo: "Desarrollo" };
  const CLAVE_SESION = "afm-panel-sesion";

  // ---------- Elementos ----------
  const login = $("#login");
  const loginForm = $("#login-form");
  const loginError = $("#login-error");
  const loginSubmit = $("#login-submit");
  const password = $("#f-password");
  const panel = $("#panel");
  const acciones = $("#admin-actions");
  const btnRastrear = $("#btn-rastrear");
  const cuerpo = $("#leads-body");
  const contador = $("#panel-count");
  const filtroEstado = $("#f-estado");
  const toast = $("#toast");

  const filtros = { categoria: "", estado: "" };
  let consultaActual = 0; // descarta respuestas viejas si se cambia de filtro rápido
  let total = 0;

  // ---------- Utilidades ----------
  function el(tag, clase, texto) {
    const nodo = document.createElement(tag);
    if (clase) nodo.className = clase;
    if (texto != null) nodo.textContent = texto; // siempre texto: los leads vienen de internet
    return nodo;
  }

  // Solo enlaces http(s): evita "javascript:" y similares en datos capturados.
  function urlSegura(valor) {
    try {
      const url = new URL(valor);
      return /^https?:$/.test(url.protocol) ? url.href : null;
    } catch { return null; }
  }

  // Publicación o perfil del cliente. Los leads simulados apuntan a example.com: no se abren.
  const enlaceCliente = (lead) => (lead.fuente === "simulado" ? null : urlSegura(lead.url));

  const relativo = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  function haceCuanto(iso) {
    // Si el reloj del PC va atrasado frente a Supabase, la fecha parece futura: se muestra como "ahora".
    let valor = Math.min(0, (new Date(iso) - Date.now()) / 1000);
    const pasos = [[60, "second"], [60, "minute"], [24, "hour"], [7, "day"], [4.35, "week"], [12, "month"], [Infinity, "year"]];
    for (const [tamano, unidad] of pasos) {
      if (Math.abs(valor) < tamano) return relativo.format(Math.round(valor), unidad);
      valor /= tamano;
    }
  }

  let toastTimer;
  function avisar(texto, duracion = 3200) {
    toast.textContent = texto;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), duracion);
  }

  // ---------- Sesión (sessionStorage: se borra al cerrar la pestaña) ----------
  function leerSesion() {
    try {
      const guardada = JSON.parse(sessionStorage.getItem(CLAVE_SESION));
      return guardada && guardada.vence > Date.now() ? guardada : null;
    } catch { return null; }
  }
  let sesion = leerSesion();

  function guardarSesion(nueva) {
    sesion = nueva;
    try { sessionStorage.setItem(CLAVE_SESION, JSON.stringify(nueva)); } catch { /* sin almacenamiento: dura hasta recargar */ }
  }

  function mostrarPanel() {
    login.hidden = true;
    panel.hidden = false;
    acciones.hidden = false;
    cargarLeads();
  }

  function cerrarSesion(mensaje) {
    sesion = null;
    try { sessionStorage.removeItem(CLAVE_SESION); } catch { /* nada que borrar */ }
    panel.hidden = true;
    acciones.hidden = true;
    login.hidden = false;
    cuerpo.replaceChildren();
    contador.textContent = "";
    mostrarErrorLogin(mensaje);
    password.focus();
  }

  function mostrarErrorLogin(mensaje) {
    loginError.textContent = mensaje || "";
    loginError.hidden = !mensaje;
  }

  // ---------- Llamadas a /api ----------
  class SesionVencida extends Error {}

  async function api(ruta, { method = "GET", body } = {}) {
    const headers = {};
    if (body) headers["Content-Type"] = "application/json";
    if (sesion) headers.Authorization = `Bearer ${sesion.token}`;

    const resp = await fetch(ruta, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const datos = await resp.json().catch(() => ({}));

    if (resp.status === 401 && sesion) {
      cerrarSesion("Tu sesión venció. Entra de nuevo.");
      throw new SesionVencida();
    }
    if (!resp.ok) {
      throw new Error(datos.error || (resp.status === 404
        ? "No se encontró /api. El panel necesita las funciones de Vercel (sitio publicado o «vercel dev»)."
        : `Error ${resp.status}`));
    }
    return datos;
  }

  // ---------- Entrada ----------
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!password.value) { mostrarErrorLogin("Escribe la contraseña."); password.focus(); return; }

    loginSubmit.disabled = true;
    loginSubmit.textContent = "Entrando…";
    try {
      guardarSesion(await api("/api/login", { method: "POST", body: { password: password.value } }));
      loginForm.reset();
      mostrarErrorLogin("");
      mostrarPanel();
    } catch (err) {
      mostrarErrorLogin(err.message);
      password.select();
    } finally {
      loginSubmit.disabled = false;
      loginSubmit.textContent = "Entrar";
    }
  });

  $("#btn-salir").addEventListener("click", () => cerrarSesion());

  // ---------- Tabla ----------
  function filaMensaje(texto, error) {
    const td = el("td", "", texto);
    td.colSpan = 5;
    if (error) td.append(el("p", "form-error", error));
    const tr = el("tr", "fila-vacia");
    tr.append(td);
    cuerpo.replaceChildren(tr);
  }

  function mostrarVacio() {
    const hayFiltros = filtros.categoria || filtros.estado;
    filaMensaje(hayFiltros ? "No hay leads con estos filtros." : "Aún no hay leads. Pulsa «Buscar leads ahora».");
  }

  function actualizarContador() {
    contador.textContent = total === 1 ? "1 lead" : `${total} leads`;
  }

  async function cargarLeads() {
    const id = ++consultaActual;
    filaMensaje("Cargando leads…");
    contador.textContent = "";

    const params = new URLSearchParams();
    if (filtros.categoria) params.set("categoria", filtros.categoria);
    if (filtros.estado) params.set("estado", filtros.estado);
    const qs = params.toString();

    try {
      const { leads } = await api(`/api/leads${qs ? `?${qs}` : ""}`);
      if (id !== consultaActual) return;
      total = leads.length;
      actualizarContador();
      if (!total) { mostrarVacio(); return; }
      cuerpo.replaceChildren(...leads.map(filaLead));
    } catch (err) {
      if (err instanceof SesionVencida || id !== consultaActual) return;
      filaMensaje("No se pudieron cargar los leads.", err.message);
    }
  }

  function filaLead(lead) {
    const fila = el("tr");

    const fecha = el("td", "col-fecha", haceCuanto(lead.creado_en));
    fecha.title = new Date(lead.creado_en).toLocaleString("es-CO");

    const quien = el("td", "col-lead");
    const nombre = el("span", "lead-nombre", lead.nombre);
    nombre.append(el("span", `cat cat-${lead.categoria}`, CATEGORIAS[lead.categoria] || lead.categoria));
    if (lead.urgencia === "alta") nombre.append(el("span", "cat cat-urgente", "Urgente"));
    const meta = el("span", "lead-meta");
    const enlace = enlaceCliente(lead);
    if (enlace) {
      const a = el("a", "", lead.fuente || new URL(enlace).hostname);
      a.href = enlace;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      meta.append(a);
    } else if (lead.fuente) {
      meta.append(lead.fuente);
    }
    if (lead.telefono) meta.append(`${meta.childNodes.length ? " · " : ""}+${lead.telefono}`);
    quien.append(nombre, meta);

    const necesidad = el("td", "col-necesidad", lead.necesidad);

    const celdaEstado = el("td", "col-estado");
    const select = el("select", "estado-select");
    select.setAttribute("aria-label", `Estado de ${lead.nombre}`);
    for (const [valor, texto] of Object.entries(ESTADOS)) {
      select.append(new Option(texto, valor, false, valor === lead.estado));
    }
    select.dataset.estado = lead.estado;
    select.addEventListener("change", () => cambiarEstado(lead, select, fila));
    celdaEstado.append(select);

    const celdaAccion = el("td", "col-accion");
    const boton = el("button", "btn btn-primary btn-sm", etiquetaContacto(lead));
    boton.type = "button";
    boton.title = "Copia la plantilla y abre la conversación";
    boton.addEventListener("click", () => contactar(lead));
    celdaAccion.append(boton);

    fila.append(fecha, quien, necesidad, celdaEstado, celdaAccion);
    return fila;
  }

  // ---------- Cambio de estado ----------
  async function cambiarEstado(lead, select, fila) {
    const anterior = lead.estado;
    select.dataset.estado = select.value;
    select.disabled = true;
    try {
      const { lead: actualizado } = await api("/api/leads", { method: "PATCH", body: { id: lead.id, estado: select.value } });
      lead.estado = actualizado.estado;
      avisar(`${lead.nombre}: ${ESTADOS[lead.estado]}`);
      // Con un filtro de estado activo, el lead sale de la vista si ya no coincide.
      if (filtros.estado && lead.estado !== filtros.estado) {
        fila.remove();
        total--;
        actualizarContador();
        if (!total) mostrarVacio();
      }
    } catch (err) {
      if (err instanceof SesionVencida) return;
      select.value = anterior;
      select.dataset.estado = anterior;
      avisar(`No se guardó el cambio: ${err.message}`);
    } finally {
      select.disabled = false;
    }
  }

  // ---------- Contacto: copiar plantilla y abrir WhatsApp o el enlace del cliente ----------
  function plantilla(lead) {
    const texto = lead.necesidad.trim().replace(/\.+$/, ""); // el punto va después de las comillas
    const necesidad = texto.length > 160 ? `${texto.slice(0, 157).trimEnd()}…` : texto;
    const datos = {
      nombre: lead.nombre,
      necesidad,
      yo: CONFIG.nombre || "Andrés F. Montoya",
      ubicacion: CONFIG.ubicacion || "Colombia",
      whatsapp: (CONFIG.whatsapp || "").replace(/\D/g, ""),
      sitio: location.origin,
    };
    return (PLANTILLAS[lead.categoria] || PLANTILLAS.desarrollo)
      .replace(/\{(\w+)\}/g, (marcador, clave) => datos[clave] ?? marcador);
  }

  const telefonoDe = (lead) => String(lead.telefono || "").replace(/\D/g, "");

  function etiquetaContacto(lead) {
    if (telefonoDe(lead)) return "Copiar · WhatsApp";
    return enlaceCliente(lead) ? "Copiar · abrir DM" : "Copiar plantilla";
  }

  async function contactar(lead) {
    const texto = plantilla(lead);
    let copiado = true;
    try { await navigator.clipboard.writeText(texto); } catch { copiado = false; }

    const tel = telefonoDe(lead);
    const destino = tel ? `https://wa.me/${tel}?text=${encodeURIComponent(texto)}` : enlaceCliente(lead);
    if (destino) window.open(destino, "_blank", "noopener");

    avisar(copiado ? "Plantilla copiada. Pégala en el chat." : "No se pudo copiar la plantilla.");
  }

  // ---------- Filtros ----------
  $$(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      $$(".tab").forEach((t) => t.setAttribute("aria-pressed", String(t === tab)));
      filtros.categoria = tab.dataset.categoria;
      cargarLeads();
    });
  });

  filtroEstado.addEventListener("change", () => {
    filtros.estado = filtroEstado.value;
    cargarLeads();
  });

  // ---------- Rastreo ----------
  btnRastrear.addEventListener("click", async () => {
    btnRastrear.disabled = true;
    btnRastrear.textContent = "Buscando…";
    try {
      const { nuevos, alertas, errorTelegram } = await api("/api/trigger-scraper", { method: "POST" });
      if (!nuevos) avisar("Sin leads nuevos por ahora.");
      else if (errorTelegram) avisar(`${nuevos} ${nuevos === 1 ? "nuevo" : "nuevos"}, pero sin aviso a Telegram. ${errorTelegram}`, 12000);
      else avisar(`${nuevos} ${nuevos === 1 ? "lead nuevo" : "leads nuevos"} · aviso enviado a Telegram${alertas > 1 ? ` (${alertas} mensajes)` : ""}.`);
      if (nuevos) cargarLeads();
    } catch (err) {
      if (!(err instanceof SesionVencida)) avisar(`El rastreo falló: ${err.message}`);
    } finally {
      btnRastrear.disabled = false;
      btnRastrear.textContent = "Buscar leads ahora";
    }
  });

  // ---------- Inicio ----------
  if (sesion) mostrarPanel(); else password.focus();
})();
