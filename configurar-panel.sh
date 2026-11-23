#!/bin/bash
# Configura el panel privado de selvinmejia.com (https://selvinmejia.com/panel), una sola vez:
#
#   bash ~/Documents/Proyectos_SGMC/selvinmejia/configurar-panel.sh
#
# Guarda en Cloudflare (como secretos del Worker, NO en el código ni en GitHub):
#   GOOGLE_CLIENT_ID   el ID de cliente de "Iniciar sesión con Google"
#   ADMIN_EMAIL        el o los correos que pueden entrar (separados por coma)
#   SESION_SECRETO     una clave al azar para firmar la sesión (se genera sola)
set -euo pipefail
cd "$(dirname "$0")"
WRANGLER=(npx --yes wrangler@4)

say() { printf '\n\033[1;32m▸ %s\033[0m\n' "$*"; }
ok() { printf '  \033[32m✓\033[0m %s\n' "$*"; }
die() { printf '\n\033[1;31m✗ %s\033[0m\n' "$*"; exit 1; }

command -v node >/dev/null || die "Necesitas Node.js 20 o más nuevo (brew install node)."
command -v openssl >/dev/null || die "Necesitas openssl."

say "Cloudflare (wrangler)"
if ! "${WRANGLER[@]}" whoami 2>/dev/null | grep -qi "associated with the email\|logged in"; then
  "${WRANGLER[@]}" login
fi
ok "sesión de Cloudflare activa"

say "ID de cliente de Google"
cat <<'TXT'
  Puedes usar el MISMO ID de cliente que ya tienes para PacketLens:
   en https://console.cloud.google.com → Google Auth Platform → Clientes → tu cliente web →
   "Orígenes de JavaScript autorizados" → agrega  https://selvinmejia.com  (y guarda).

  Si prefieres uno nuevo (se hace una vez, gratis):
   1. Entra a https://console.cloud.google.com con tu cuenta de Google y crea un proyecto (ej. "selvinmejia.com").
   2. Menú → "Google Auth Platform" (o "APIs y servicios" → "Pantalla de consentimiento de OAuth"):
      - Nombre de la app: selvinmejia.com · correo de asistencia: el tuyo.
      - Público: Externo. En "Usuarios de prueba" agrega tu correo.
   3. "Clientes" → "Crear cliente" → tipo "Aplicación web".
      - Orígenes de JavaScript autorizados:  https://selvinmejia.com
        (y si quieres probar en tu Mac también:  http://localhost:8787  y  http://localhost)
   4. Copia el "ID de cliente" (termina en .apps.googleusercontent.com).
TXT
read -r -p "  Pega aquí el ID de cliente: " CLIENT_ID
CLIENT_ID="$(echo "$CLIENT_ID" | tr -d '[:space:]')"
[[ "$CLIENT_ID" == *.apps.googleusercontent.com ]] || die "Ese no parece un ID de cliente de Google (debe terminar en .apps.googleusercontent.com)."

read -r -p "  Correo de Google que podrá entrar al panel: " CORREO
CORREO="$(echo "$CORREO" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')"
[[ "$CORREO" == *@*.* ]] || die "Correo no válido."

say "Guardando secretos en el Worker de selvinmejia.com"
printf '%s' "$CLIENT_ID" | "${WRANGLER[@]}" secret put GOOGLE_CLIENT_ID >/dev/null && ok "GOOGLE_CLIENT_ID"
printf '%s' "$CORREO" | "${WRANGLER[@]}" secret put ADMIN_EMAIL >/dev/null && ok "ADMIN_EMAIL"
printf '%s' "$(openssl rand -hex 32)" | "${WRANGLER[@]}" secret put SESION_SECRETO >/dev/null && ok "SESION_SECRETO (nuevo: las sesiones abiertas se cierran)"

cat <<TXT

$(printf '\033[1;32m')Listo.$(printf '\033[0m')  Entra a https://selvinmejia.com/panel e inicia sesión con $CORREO
Para cambiar de correo o de ID de cliente, vuelve a correr este script.
TXT
