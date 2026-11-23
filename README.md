# selvinmejia.com · NOC personal

Sitio principal de Selvin Mejía: un portafolio vivo con estética de centro de operaciones de red (NOC).
Cada proyecto se revisa en vivo y hay una terminal escondida (tecla <kbd>`</kbd> o el botón `>_`).

## Qué muestra

- **Estado general**: código HTTP y latencia de aves, packetlens, secreto y mired, revisados por el Worker cada 60 s.
- **Diario de aves**: hallazgo del día, rareza, especies y detecciones (se leen de las etiquetas `og:` de aves.selvinmejia.com, en español y en inglés).
- **PacketLens**: capturas analizadas en 30 días y en total, y visitas (base D1 `tshoot-datos` de PacketLens, solo lectura).
- **Amigo Secreto**: días que faltan para Navidad.
- **Hora y clima** de Ciudad de Guatemala (Open-Meteo).
- **Bitácora** (eventos automáticos + los que escribas) y **Banco de trabajo**.
- **Terminal**: `help`, `whoami`, `ls`, `status`, `ping aves`, `traceroute selvin`, `open packetlens`, `aves`, `clima`, `date`, `uptime`, `lang en`, `theme light`, `history`, `clear`, `exit`… con historial (↑ ↓) y autocompletar (Tab).
- **Avatar animado** (SVG dentro de index.html): respira, parpadea, se sube los lentes cada 12 s (o al pasar el mouse) y la garza del hombro canta.
- **Perfil** (sección 04): ficha estilo terminal, trayectoria y stack por categorías, editables en `contenido.js` → `perfil`. Sin datos de contacto a propósito.
- **Apoya los proyectos**: botón en el pie que abre la ventana con $3, $5, $10 u otro monto (PayPal), igual que en aves. También con el comando `apoyar`.
- Español e inglés (`?lang=en`), modo oscuro y claro, adaptado a teléfono.

## Contacto

El correo **info@selvinmejia.com** aparece en la sección 05 · Contacto, en el pie de página y con el comando `contacto` de la terminal.
Se arma en el navegador para que los robots que leen el HTML no lo encuentren tan fácil.

## Panel privado (/panel)

https://selvinmejia.com/panel, con "Iniciar sesión con Google" (solo el correo que configures). Muestra:

- Visitas, clics a proyectos, terminal, huevos de pascua, contacto, apoyo y donaciones (con periodo de 7, 30, 90, 365 días o personalizado).
- **De dónde te visitan:** mapa por país y top 10, cómo llegan (usa `?ref=linkedin` en tus enlaces), nuevos y recurrentes, idioma, dispositivo, sistema operativo, navegador y a qué hora (hora de Guatemala).
- **Qué hacen en el sitio:** proyectos que abren, comandos de la terminal, huevos encontrados, uso del correo, cómo abren la terminal y tema.
- **Apoyo:** desde dónde abren la ventana, monto elegido y registro de donaciones (PayPal.me no avisa a la página).

Los conteos son anónimos (sin IPs) y se guardan en la base D1 `selvinmejia-datos`, que `publicar.sh` crea la primera vez.
Configúralo una sola vez con `bash configurar-panel.sh` (puedes reutilizar el ID de cliente de Google de PacketLens agregando el origen https://selvinmejia.com).

## Mantenerlo (un par de días al mes)

Casi todo se edita en **`contenido.js`**:

- `servicios`: agrega un proyecto nuevo copiando un bloque (id, url, nombre, tipo, descripción, etiquetas). Para que el Worker lo revise, agrégalo también a `SERVICIOS` en `src/index.js`.
- `banco`: lo que estás construyendo; `estado` puede ser `idea`, `construyendo` o `pruebas`, y `progreso` va de 0 a 100.
- `bitacora`: agrega arriba lo más nuevo. `nivel`: `ok`, `info`, `aviso` o `deploy`.

Los textos de la interfaz están en `i18n.js`.

## Estructura

```
index.html      Página
styles.css      Estilos (oscuro / claro)
app.js          Interfaz, estado en vivo y terminal
i18n.js         Textos en español e inglés
contenido.js    Proyectos, banco de trabajo y bitácora  ← lo que más vas a editar
favicon.svg     Ícono (lentes de sol + LED)
apple-touch-icon.png  Ícono para iPhone
src/index.js    Worker: /api/estado, /api/evento, /panel, redirección de www y cabeceras de seguridad
src/panel.js    Páginas del panel privado (no son archivos públicos)
src/mapa.js     Contornos de países para el mapa del panel
vendor/         Chart.js (gráficas del panel)
configurar-panel.sh  Configura el acceso con Google al panel (una vez)
wrangler.jsonc  Configuración del Worker (dominios y base D1)
publicar.sh     Probar localmente y publicar en Cloudflare + GitHub
```

## Probar y publicar

```bash
bash ~/Documents/Proyectos_SGMC/selvinmejia/publicar.sh --local   # http://localhost:8787
bash ~/Documents/Proyectos_SGMC/selvinmejia/publicar.sh           # selvinmejia.com + GitHub
```

Antes de publicar la primera vez, libera la raíz: hoy `selvinmejia.com` la usa el proyecto viejo del analizador en Cloudflare Pages.
En Cloudflare → Workers & Pages → (proyecto que tenga selvinmejia.com) → Custom domains, quita `selvinmejia.com` y `www`,
y borra en DNS los registros que apunten a ese proyecto. Si se te olvida, el script te lo recuerda.
