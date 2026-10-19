// ============================================================
//  Rastreo de necesidades inmediatas — VERSIÓN SIMULADA.
//  Devuelve publicaciones de ejemplo con la forma de la tabla
//  leads. Para conectar una fuente real, reemplaza el cuerpo de
//  buscarNecesidades() y conserva el formato de cada objeto.
// ============================================================

const PUBLICACIONES = [
  { categoria: "soporte",    nombre: "Ferretería (ejemplo)",        necesidad: "El sistema de facturación electrónica nos rechaza las facturas desde ayer. ¿Alguien que nos ayude hoy?" },
  { categoria: "soporte",    nombre: "Tienda de ropa (ejemplo)",    necesidad: "Se me cayó la tienda Shopify después de instalar un tema nuevo. Es urgente." },
  { categoria: "soporte",    nombre: "Panadería (ejemplo)",         necesidad: "No nos deja transmitir la nómina electrónica a la DIAN y hoy vence el plazo." },
  { categoria: "soporte",    nombre: "Minimercado (ejemplo)",       necesidad: "El lector de código de barras dejó de funcionar con el POS. Necesito soporte hoy." },
  { categoria: "desarrollo", nombre: "Distribuidora (ejemplo)",     necesidad: "Buscamos desarrollador para un sistema de inventario con app móvil para los vendedores." },
  { categoria: "desarrollo", nombre: "Tienda online (ejemplo)",     necesidad: "Necesito integrar pagos con Addi en mi tienda online." },
  { categoria: "desarrollo", nombre: "Consultorio (ejemplo)",       necesidad: "Queremos una página con agenda de citas y recordatorios por WhatsApp." },
  { categoria: "desarrollo", nombre: "Comercializadora (ejemplo)",  necesidad: "Busco quien automatice los reportes de ventas que hoy hacemos a mano en Excel." },
];

const POR_RONDA = 3;

/**
 * Simula una ronda de rastreo: toma unas publicaciones al azar.
 * La url incluye la fecha, así que repetir el rastreo el mismo día
 * no duplica leads (insertarLeads ignora las url que ya existen).
 * Sin teléfono a propósito: un número inventado podría ser de alguien real.
 */
export async function buscarNecesidades() {
  const hoy = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Bogota" }); // AAAA-MM-DD

  return PUBLICACIONES
    .map((pub, i) => ({ ...pub, i }))
    .sort(() => Math.random() - 0.5)
    .slice(0, POR_RONDA)
    .map(({ i, ...pub }) => ({
      ...pub,
      fuente: "simulado",
      url: `https://example.com/simulado/${hoy}/${i + 1}`,
      telefono: null,
    }));
}
