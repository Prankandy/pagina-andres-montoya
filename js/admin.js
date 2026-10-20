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
  const stats = $("#panel-stats");
  const statPct = $("#stat-pct");

  const MAX_NOTAS = 2000;
  const filtros = { categoria: "", estado: "" };
  let consultaActual = 0; // descarta respuestas viejas si se cambia de filtro rápido
  let total = 0;
  let leadsActuales = []; // los cargados con los filtros actuales (para exportar)
  let conteos = null;     // { NUEVO, CONTACTADO, CERRADO } de la pestaña actual

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
    leadsActuales = [];
    conteos = null;
    stats.hidden = true;
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

  // Contadores por estado de la pestaña actual (no dependen del filtro de estado).
  function mostrarConteos() {
    stats.hidden = !conteos;
    if (!conteos) return;
    for (const num of $$(".stat-num", stats)) num.textContent = conteos[num.dataset.estado] ?? 0;
    const suma = Object.keys(ESTADOS).reduce((s, e) => s + (conteos[e] || 0), 0);
    statPct.textContent = suma ? `(${Math.round((conteos.CERRADO / suma) * 100)}%)` : "";
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
      const respuesta = await api(`/api/leads${qs ? `?${qs}` : ""}`);
      if (id !== consultaActual) return;
      const { leads } = respuesta;
      leadsActuales = leads;
      conteos = respuesta.conteos || null;
      mostrarConteos();
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
    const nota = el("span", "lead-nota", lead.notas || "");
    nota.hidden = !lead.notas;
    quien.append(nombre, meta, nota);

    const necesidad = el("td", "col-necesidad");
    if (lead.resumen) {
      // Resumen de la IA arriba; el texto original debajo, recortado a unas líneas.
      necesidad.append(el("span", "lead-resumen", lead.resumen), el("span", "lead-texto", lead.necesidad));
      necesidad.title = lead.necesidad;
    } else {
      necesidad.textContent = lead.necesidad;
    }

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
    const botonNota = el("button", "btn btn-ghost btn-sm", lead.notas ? "Editar nota" : "Agregar nota");
    botonNota.type = "button";
    botonNota.addEventListener("click", () => abrirNota(lead, fila, { nota, botonNota }));
    const acciones = el("div", "acciones");
    acciones.append(boton, botonNota);
    celdaAccion.append(acciones);

    fila.append(fecha, quien, necesidad, celdaEstado, celdaAccion);
    return fila;
  }

  // ---------- Notas de seguimiento ----------
  // Se editan en una fila que se abre debajo del lead.
  function abrirNota(lead, fila, vista) {
    if (fila.editor) { fila.editor.querySelector("textarea").focus(); return; }

    const area = el("textarea", "nota-texto");
    area.value = lead.notas || "";
    area.maxLength = MAX_NOTAS;
    area.rows = 3;
    area.placeholder = "Ej.: Le escribí por DM el martes; pidió cotización para el jueves.";
    area.setAttribute("aria-label", `Notas de ${lead.nombre}`);
    const guardar = el("button", "btn btn-primary btn-sm", "Guardar nota");
    const cancelar = el("button", "btn btn-ghost btn-sm", "Cancelar");
    guardar.type = cancelar.type = "button";
    const pie = el("div", "nota-acciones");
    pie.append(guardar, cancelar, el("span", "nota-ayuda", "Ctrl + Enter guarda · Esc cancela"));

    const td = el("td");
    td.colSpan = 5;
    td.append(area, pie);
    const editor = el("tr", "fila-nota");
    editor.append(td);
    fila.after(editor);
    fila.editor = editor;

    const cerrar = () => { editor.remove(); fila.editor = null; vista.botonNota.focus(); };
    cancelar.addEventListener("click", cerrar);
    area.addEventListener("keydown", (e) => {
      if (e.key === "Escape") cerrar();
      else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) guardar.click();
    });
    guardar.addEventListener("click", async () => {
      guardar.disabled = true;
      guardar.textContent = "Guardando…";
      try {
        const { lead: actualizado } = await api("/api/leads", { method: "PATCH", body: { id: lead.id, notas: area.value } });
        lead.notas = actualizado.notas;
        vista.nota.textContent = lead.notas || "";
        vista.nota.hidden = !lead.notas;
        vista.botonNota.textContent = lead.notas ? "Editar nota" : "Agregar nota";
        cerrar();
        avisar(lead.notas ? "Nota guardada." : "Nota borrada.");
      } catch (err) {
        if (err instanceof SesionVencida) return;
        avisar(`No se guardó la nota: ${err.message}`);
        guardar.disabled = false;
        guardar.textContent = "Guardar nota";
      }
    });
    area.focus();
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
      if (conteos) {
        conteos[anterior] = Math.max(0, (conteos[anterior] || 0) - 1);
        conteos[lead.estado] = (conteos[lead.estado] || 0) + 1;
        mostrarConteos();
      }
      // Con un filtro de estado activo, el lead sale de la vista si ya no coincide.
      if (filtros.estado && lead.estado !== filtros.estado) {
        fila.editor?.remove();
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
    // En una sola línea: cada renglón (p. ej. título y cuerpo) cierra con punto si no traía signo.
    const texto = lead.necesidad.split(/\n+/).map((s) => s.trim()).filter(Boolean)
      .map((s) => (/[.!?…:;]$/.test(s) ? s : `${s}.`)).join(" ")
      .replace(/\s+/g, " ").replace(/\.+$/, ""); // el punto final va después de las comillas
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

  // ---------- Exportar a CSV (lo que se ve con los filtros actuales) ----------
  // Separador ";" y BOM UTF-8: así lo abre bien Excel en español (Colombia).
  const COLUMNAS_CSV = [
    ["Fecha", (l) => new Date(l.creado_en).toLocaleString("sv-SE", { timeZone: "America/Bogota" }).slice(0, 16)],
    ["Nombre", (l) => l.nombre],
    ["Categoría", (l) => CATEGORIAS[l.categoria] || l.categoria],
    ["Urgencia", (l) => l.urgencia],
    ["Estado", (l) => ESTADOS[l.estado] || l.estado],
    ["Resumen", (l) => l.resumen],
    ["Necesidad", (l) => l.necesidad],
    ["Fuente", (l) => l.fuente],
    ["Enlace", (l) => l.url],
    ["Teléfono", (l) => l.telefono],
    ["Notas", (l) => l.notas],
  ];

  function celdaCSV(valor) {
    let texto = valor == null ? "" : String(valor);
    // Los textos vienen de internet: un "=" o "+" al inicio no debe ejecutarse como fórmula en Excel.
    if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
    return `"${texto.replace(/"/g, '""')}"`;
  }

  function exportarCSV() {
    const visibles = leadsActuales.filter((l) => !filtros.estado || l.estado === filtros.estado);
    if (!visibles.length) { avisar("No hay leads para exportar con estos filtros."); return; }

    const filas = [
      COLUMNAS_CSV.map(([titulo]) => celdaCSV(titulo)).join(";"),
      ...visibles.map((lead) => COLUMNAS_CSV.map(([, valor]) => celdaCSV(valor(lead))).join(";")),
    ];
    const archivo = new Blob(["﻿" + filas.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const enlace = el("a");
    enlace.href = URL.createObjectURL(archivo);
    enlace.download = `leads-${new Date().toLocaleDateString("sv-SE", { timeZone: "America/Bogota" })}.csv`;
    document.body.append(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
    avisar(visibles.length === 1 ? "1 lead exportado." : `${visibles.length} leads exportados.`);
  }

  $("#btn-exportar").addEventListener("click", exportarCSV);

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
      const r = await api("/api/trigger-scraper", { method: "POST" });
      const quedan = r.pendientes - r.evaluados;
      const n = (cantidad, uno, varios) => `${cantidad} ${cantidad === 1 ? uno : varios}`;
      const detalle = `${n(r.leidos, "publicación leída", "publicaciones leídas")}, ${n(r.evaluados, "evaluada", "evaluadas")} con IA` +
        `${quedan > 0 ? `, ${n(quedan, "queda", "quedan")} para la próxima ronda` : ""}.`;
      const problema = r.errores?.[0] ? ` ${r.errores[0]}` : "";

      if (!r.nuevos) avisar(`Sin leads nuevos: ${detalle}${problema}`, problema ? 12000 : 5000);
      else if (r.errorTelegram) avisar(`${r.nuevos} ${r.nuevos === 1 ? "nuevo" : "nuevos"}, pero sin aviso a Telegram. ${r.errorTelegram}`, 12000);
      else avisar(`${r.nuevos} ${r.nuevos === 1 ? "lead nuevo" : "leads nuevos"} · aviso enviado a Telegram. ${detalle}${problema}`, 6000);
      if (r.nuevos) cargarLeads();
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
