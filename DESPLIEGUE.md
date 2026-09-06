# Desplegar la página en Vercel

Todo lo que no necesita tus credenciales ya está hecho: el repositorio local existe,
tiene el primer commit y el remoto apunta a tu GitHub. Faltan tres pasos tuyos (unos 10 minutos).

## Paso 1 · Crear el repositorio en GitHub

1. Entra a <https://github.com/new> con la cuenta **Prankandy**.
2. Nombre del repositorio: **`pagina-andres-montoya`** (exactamente así, el remoto ya lo espera).
3. Privado o público, como prefieras: Vercel funciona con ambos.
4. **No marques** "Add a README", ".gitignore" ni "license". El repo debe quedar vacío.
5. Pulsa **Create repository**.

## Paso 2 · Subir el código

Abre una terminal **tuya** (la de VS Code sirve) y ejecuta:

```
cd "D:\Desarrollos\Proyectos Propios\Pagina Andres F. Montoya"
git push -u origin main
```

Se abrirá el navegador para autorizar GitHub. Si dice «Invalid username or token», hay una
credencial vieja guardada: Inicio → **Administrador de credenciales** → Credenciales de Windows →
busca `git:https://github.com` → **Quitar**, y repite el `git push`.

## Paso 3 · Conectar Vercel

1. Entra a <https://vercel.com> con tu cuenta de GitHub.
2. **Add New → Project** y pulsa **Import** junto a `pagina-andres-montoya`.
   Si no aparece, usa "Adjust GitHub App Permissions" y dale acceso a ese repositorio.
3. Configuración del proyecto:
   - **Framework Preset:** Other
   - **Root Directory:** `./` (déjalo como está)
   - **Build Command** y **Output Directory:** vacíos (es un sitio estático, no hay build)
   - Sin variables de entorno
4. Pulsa **Deploy**. En menos de un minuto tendrás una URL como `https://pagina-andres-montoya.vercel.app`.

## Paso 4 · Después del primer despliegue

- **Dominio propio (opcional):** en Vercel, Settings → Domains → agrega tu dominio y sigue las
  instrucciones de DNS que te muestra.
- **Vista previa al compartir el enlace:** en `index.html` descomenta la etiqueta `og:url` con tu URL
  final. Si quieres imagen de vista previa, crea `assets/og.png` (1200×630) y descomenta `og:image`.
- **Google:** con la URL final, registra el sitio en Google Search Console
  (<https://search.google.com/search-console>) para que indexe la página de facturación electrónica.
  Cuando tengas la URL definitiva, pídeme un `sitemap.xml`.

## Cómo actualizar la página más adelante

Cada cambio que subas a GitHub se publica solo:

```
git add -A
git commit -m "Describe el cambio"
git push
```

Vercel vuelve a desplegar en menos de un minuto.

## Lo que ya quedó listo

- Repositorio local en esta carpeta, rama `main`, primer commit hecho.
- Remoto `origin` → `https://github.com/Prankandy/pagina-andres-montoya.git`.
- `vercel.json`: URLs limpias (`/servicios`, `/contacto`…), cabeceras de seguridad y caché para `assets/`.
- `robots.txt` permite indexar el sitio.
- `js/config.js` va incluido: tus datos de contacto ya son públicos en la página.

Nota: esta carpeta vive dentro del repositorio de respaldos `Backups_Proyectos_VSCode`. Ese repo
verá esta carpeta como un repositorio anidado y no la incluirá en sus commits; es normal.
