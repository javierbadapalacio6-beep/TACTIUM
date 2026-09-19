#!/usr/bin/env bash
# Sonda de estado del cobro en producción (sin sesión, sin efectos).
# Interpreta las respuestas de dos rutas de servidor:
#   POST /api/connect/onboard   -> 503 = STRIPE_SECRET_KEY ausente | 401 = clave puesta
#   POST /api/tournaments/webhook -> 503 = falta clave o whsec | 400 = ambas puestas
#
# Uso:  bash scripts/check-stripe-live.sh  [https://app.tactium.io]
set -u
BASE="${1:-https://app.tactium.io}"

code(){ curl -s -o /dev/null -w "%{http_code}" -X POST "$1" -H "content-type: application/json" -d '{}' --max-time 20; }

echo "== Sonda de cobro Stripe =="
echo "Base: $BASE"
echo

ON="$(code "$BASE/api/connect/onboard")"
printf "connect/onboard   -> HTTP %s  " "$ON"
case "$ON" in
  503) echo "❌ STRIPE_SECRET_KEY NO configurada (cobro APAGADO)";;
  401|400) echo "✅ STRIPE_SECRET_KEY configurada (cobro encendido)";;
  *) echo "⚠️  inesperado (¿deploy caído / ruta movida?)";;
esac

WH="$(code "$BASE/api/tournaments/webhook")"
printf "tournaments/webhook -> HTTP %s  " "$WH"
case "$WH" in
  503) echo "❌ Falta STRIPE_SECRET_KEY o STRIPE_WEBHOOK_SECRET";;
  400) echo "✅ Clave + webhook secret configurados (rechaza por falta de firma, correcto)";;
  *) echo "⚠️  inesperado";;
esac

echo
if [ "$ON" != "503" ] && [ "$WH" = "400" ]; then
  echo "RESULTADO: cobro de torneos ENCENDIDO. ✅"
else
  echo "RESULTADO: cobro AÚN NO activo (faltan claves/redeploy)."
fi
