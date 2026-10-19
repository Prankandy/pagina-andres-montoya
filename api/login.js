// POST /api/login  { password }  →  { token, vence }
import { contrasenaCorrecta, crearToken } from "./_lib/auth.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido." });
  }

  try {
    const { password } = req.body || {};
    if (!password || !contrasenaCorrecta(password)) {
      await new Promise((r) => setTimeout(r, 800)); // frena los intentos por fuerza bruta
      return res.status(401).json({ error: "Contraseña incorrecta." });
    }
    return res.status(200).json(crearToken());
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Error interno." });
  }
}
