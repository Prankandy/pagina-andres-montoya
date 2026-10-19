// ============================================================
//  Sesión del panel. La contraseña vive en la variable de entorno
//  ADMIN_PASSWORD de Vercel; el navegador solo guarda un token
//  firmado que vence. Cambiar la contraseña cierra todas las sesiones.
// ============================================================
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const DURACION_MS = 12 * 60 * 60 * 1000; // 12 horas

function contrasena() {
  const valor = process.env.ADMIN_PASSWORD;
  if (!valor) throw new Error("Falta ADMIN_PASSWORD en las variables de entorno de Vercel.");
  return valor;
}

const huella = (texto) => createHash("sha256").update(String(texto)).digest();
const firmar = (texto) => createHmac("sha256", contrasena()).update(texto).digest("base64url");

// Comparación en tiempo constante: no revela cuántos caracteres coinciden.
const iguales = (a, b) => timingSafeEqual(huella(a), huella(b));

export const contrasenaCorrecta = (intento) => iguales(intento, contrasena());

export function crearToken() {
  const vence = Date.now() + DURACION_MS;
  return { token: `${vence}.${firmar(String(vence))}`, vence };
}

function tokenValido(token) {
  const [vence, firma] = String(token || "").split(".");
  if (!firma || !(Number(vence) > Date.now())) return false;
  return iguales(firma, firmar(vence));
}

/** Responde 401 y devuelve false si la petición no trae una sesión válida. */
export function exigirSesion(req, res) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (tokenValido(token)) return true;
  res.status(401).json({ error: "Sesión vencida o no válida." });
  return false;
}
