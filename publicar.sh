#!/bin/bash
# selvinmejia.com — desde la Terminal de tu Mac (mismo esquema que el analizador y la estación de aves):
#
#   bash ~/Documents/Proyectos_SGMC/selvinmejia/publicar.sh --local   probar en http://localhost:8787 (no publica nada)
#   bash ~/Documents/Proyectos_SGMC/selvinmejia/publicar.sh           publicar en selvinmejia.com + subir a GitHub
#
# Usa tu sesión de wrangler y gh. No instala nada en la carpeta: wrangler corre con npx desde la caché de npm.
set -euo pipefail
cd "$(dirname "$0")"
SITIO="https://selvinmejia.com"
REPO="selvinmejia"
WRANGLER=(npx --yes wrangler@4)

say() { printf '\n\033[1;32m▸ %s\033[0m\n' "$*"; }
ok() { printf '  \033[32m✓\033[0m %s\n' "$*"; }
die() { printf '\n\033[1;31m✗ %s\033[0m\n' "$*"; exit 1; }

command -v node >/dev/null || die "Necesitas Node.js 20 o más nuevo (brew install node)."
command -v git >/dev/null || die "Necesitas git (xcode-select --install)."

# Versión de los archivos en index.html (styles.css?v=…): cada cambio se ve de inmediato, sin caché vieja.
VERSION="$(cat styles.css i18n.js contenido.js app.js | shasum | cut -c1-10)"
perl -pi -e 's{\.(css|js)\?v=[A-Za-z0-9]+"}{.$1?v='"$VERSION"'"}g' index.html

MODO="${1:-}"
if [[ "$MODO" == "--local" ]]; then
  say "Vista local en http://localhost:8787  (Ctrl + C para salir)"
  echo "  Los servicios, las aves y el clima se consultan en vivo. Los conteos del analizador vienen de la base real (solo lectura)."
  exec "${WRANGLER[@]}" dev --port 8787
fi

# ---------------------------------------------------------------- Cloudflare
say "Cloudflare (wrangler)"
if ! "${WRANGLER[@]}" whoami 2>/dev/null | grep -qi "associated with the email\|logged in"; then
  "${WRANGLER[@]}" login
fi
ok "sesión de Cloudflare activa"
ok "versión de archivos: $VERSION"

# Base de datos propia (conteos del panel): se crea una sola vez y su ID queda en wrangler.jsonc
if grep -q '"database_id": "PENDIENTE"' wrangler.jsonc; then
  ID="$("${WRANGLER[@]}" d1 list --json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const x=JSON.parse(s).find(d=>d.name==="selvinmejia-datos");process.stdout.write(x?x.uuid:"")}catch{}})')"
  if [[ -z "$ID" ]]; then
    "${WRANGLER[@]}" d1 create selvinmejia-datos >/dev/null
    ID="$("${WRANGLER[@]}" d1 list --json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const x=JSON.parse(s).find(d=>d.name==="selvinmejia-datos");process.stdout.write(x?x.uuid:"")}catch{}})')"
  fi
  [[ -n "$ID" ]] || die "No pude crear la base de datos selvinmejia-datos en Cloudflare."
  perl -pi -e 's{"database_id": "PENDIENTE"}{"database_id": "'"$ID"'"}' wrangler.jsonc
  ok "base de datos selvinmejia-datos lista ($ID)"
fi

if ! "${WRANGLER[@]}" deploy; then
  die "Cloudflare no dejó tomar selvinmejia.com. Hoy la raíz la usa otro proyecto. En el panel de Cloudflare:
  1) Workers & Pages → analizador-forense-red (el proyecto de Pages que tenga selvinmejia.com) → Custom domains → quita selvinmejia.com y www.
  2) DNS → borra los registros de selvinmejia.com y www que apunten a ese proyecto.
  Luego vuelve a correr:  bash publicar.sh"
fi
ok "Worker selvinmejia publicado"

# Clave de la bitácora automática (avisar.sh): se crea una sola vez, vive fuera del repositorio
TOKEN_FILE="$HOME/.config/selvinmejia/deploy-token"
if [[ ! -s "$TOKEN_FILE" ]]; then
  mkdir -p "$(dirname "$TOKEN_FILE")" && ( umask 077; openssl rand -hex 32 > "$TOKEN_FILE" ) && chmod 600 "$TOKEN_FILE"
  ok "clave de la bitácora creada en $TOKEN_FILE"
fi
if ! "${WRANGLER[@]}" secret list 2>/dev/null | grep -q DEPLOY_TOKEN; then
  "${WRANGLER[@]}" secret put DEPLOY_TOKEN < "$TOKEN_FILE" >/dev/null && ok "clave de la bitácora guardada en Cloudflare"
fi

CURL=(curl -s -o /dev/null -w '%{http_code}')
if curl --help all 2>/dev/null | grep -q -- '--doh-url'; then CURL+=(--doh-url https://cloudflare-dns.com/dns-query); fi
printf '  Esperando a que %s responda' "$SITIO"
LISTO=0
for _ in $(seq 1 36); do
  CODIGO="$("${CURL[@]}" "$SITIO/api/estado" || true)"
  if [[ "$CODIGO" == 200 ]]; then LISTO=1; break; fi
  printf '.'; sleep 5
done
echo
if [[ "$LISTO" == 1 ]]; then ok "$SITIO en línea"
else
  echo "  (aún no responde: el certificado puede tardar unos minutos)"
  echo "  Si tu navegador dice NXDOMAIN:  sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder"
fi

# ---------------------------------------------------------------- GitHub
say "GitHub"
GH="$(command -v gh || true)"
[[ -n "$GH" ]] || die "Necesitas gh (GitHub CLI): brew install gh"
"$GH" auth status -h github.com >/dev/null 2>&1 || "$GH" auth login -h github.com --git-protocol https --web
"$GH" auth setup-git -h github.com >/dev/null

if [[ ! -d .git ]]; then
  git init -q -b main
  ok "repositorio git creado"
fi
git config user.name >/dev/null || git config user.name "$("$GH" api user --jq '.login')"
git config user.email >/dev/null || git config user.email "$("$GH" api user --jq '"\(.id)+\(.login)@users.noreply.github.com"')"

git add -A
if git diff --cached --quiet; then ok "sin cambios nuevos que subir"
else
  if git rev-parse -q --verify HEAD >/dev/null; then MENSAJE="${MENSAJE:-Actualización ($(date +%F))}"
  else MENSAJE="${MENSAJE:-selvinmejia.com v1: NOC personal}"; fi
  git commit -qm "$MENSAJE"
  ok "commit $(git log -1 --format='%h') · $MENSAJE"
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  USUARIO="$("$GH" api user --jq '.login')"
  if ! "$GH" repo view "$USUARIO/$REPO" >/dev/null 2>&1; then
    "$GH" repo create "$USUARIO/$REPO" --public --description "selvinmejia.com — NOC personal" >/dev/null
    ok "repositorio $USUARIO/$REPO creado en GitHub"
  fi
  git remote add origin "https://github.com/$USUARIO/$REPO.git"
fi
git pull -q --rebase --autostash origin main 2>/dev/null || true
git push -q -u origin HEAD:main
ok "código en $(git remote get-url origin | sed 's/\.git$//')"

bash "$(pwd)/avisar.sh" selvinmejia "${MENSAJE:-}"
printf '\n\033[1;32mListo.\033[0m  %s\n' "$SITIO"
echo "Panel privado: $SITIO/panel  (la primera vez configúralo con: bash configurar-panel.sh)"
