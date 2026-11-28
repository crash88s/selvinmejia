#!/bin/bash
# Avisa a selvinmejia.com que publicaste una versión nueva de un proyecto (sale sola en la Bitácora).
#
#   bash ~/Documents/Proyectos_SGMC/selvinmejia/avisar.sh <proyecto> ["mensaje"]
#
#   proyecto: packetlens | netkit | aves | secreto | mired | selvinmejia
#   mensaje:  opcional. Si no lo das, usa el título del último commit de la carpeta donde estás.
#             Los mensajes automáticos ("Actualización (fecha)", "Publicación …") salen como "Nueva versión publicada".
#
# La clave vive en ~/.config/selvinmejia/deploy-token (fuera de los repositorios; nunca se sube a GitHub).
# Nunca hace fallar la publicación: si algo sale mal, solo muestra un aviso.
PROYECTO="${1:-}"
MSG="${2:-}"
TOKEN_FILE="$HOME/.config/selvinmejia/deploy-token"
[[ -n "$PROYECTO" ]] || { echo "  (bitácora) falta el nombre del proyecto"; exit 0; }
[[ -r "$TOKEN_FILE" ]] || { echo "  (bitácora) sin clave todavía: publica selvinmejia una vez con su publicar.sh"; exit 0; }

COMMIT=""
if git rev-parse -q --verify HEAD >/dev/null 2>&1; then
  COMMIT="$(git log -1 --format=%h 2>/dev/null || true)"
  [[ -n "$MSG" ]] || MSG="$(git log -1 --format=%s 2>/dev/null || true)"
fi
# Mensajes genéricos → que el sitio ponga "Nueva versión publicada"
if [[ "$MSG" =~ ^(Actualizaci[oó]n|Publicaci[oó]n|Update)([[:space:]]|\(|$) ]]; then MSG=""; fi

BODY="$(node -e 'process.stdout.write(JSON.stringify({p:process.argv[1],m:process.argv[2].slice(0,180),c:process.argv[3]}))' "$PROYECTO" "$MSG" "$COMMIT")"
CODIGO="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 -X POST https://selvinmejia.com/api/deploy \
  -H "Authorization: Bearer $(cat "$TOKEN_FILE")" -H 'Content-Type: application/json' --data "$BODY" || true)"
if [[ "$CODIGO" == 204 || "$CODIGO" == 200 ]]; then
  printf '  \033[32m✓\033[0m bitácora de selvinmejia.com: %s%s\n' "$PROYECTO" "${MSG:+ · $MSG}"
else
  echo "  (bitácora) selvinmejia.com no recibió el aviso (código $CODIGO). La publicación sí quedó."
fi
exit 0
