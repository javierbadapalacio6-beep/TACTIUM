# auto-submit.ps1 — Espera a que terminen los builds EAS en curso y los sube
# a las tiendas. `eas submit --id <build>` espera automáticamente si el build
# aún está compilando, luego envía.
#
# Build 8 (perfil production: tablet/iPad + enlaces legales del paywall, fix Apple 3.1.2c):
$ANDROID_BUILD = "16424f58-35c3-4274-a599-a070e0548abe"   # -> .aab (versionCode 4), track internal de Play
$IOS_BUILD     = "8ac44ebd-2177-4dd6-84a3-130612144481"   # -> App Store Connect / TestFlight (build 8)

# ──────────────────────────────────────────────────────────────────────
# REQUISITOS antes de ejecutar (si no, falla en no-interactivo):
#
# Android: TACTIUM/google-service-account.json debe existir (lo referencia
#   eas.json en submit.production.android.serviceAccountKeyPath). Se crea en
#   Google Cloud Console (cuenta de servicio) y se vincula en Play Console
#   -> Configuración -> Acceso a la API.
#
# iOS: eas.json submit.production.ios solo tiene appleId. Para no-interactivo
#   añade la App Store Connect API Key (Users and Access -> Integrations):
#     "ascApiKeyPath": "./AuthKey_XXXXXXXX.p8",
#     "ascApiKeyId": "XXXXXXXX",
#     "ascApiKeyIssuerId": "<issuer-uuid-de-ASC>"
#   (o deja que EAS la gestione si ya está guardada en el servidor).
# ──────────────────────────────────────────────────────────────────────

Write-Host "==> iOS: esperando build $IOS_BUILD y enviando a App Store Connect..."
npx eas-cli submit -p ios --id $IOS_BUILD --non-interactive
if (-not $?) { Write-Host "iOS submit FALLÓ — revisa la ASC API Key." -ForegroundColor Red }

Write-Host "==> Android: esperando build $ANDROID_BUILD y enviando a Play (track internal)..."
npx eas-cli submit -p android --id $ANDROID_BUILD --non-interactive
if (-not $?) { Write-Host "Android submit FALLÓ — falta google-service-account.json." -ForegroundColor Red }

Write-Host "Hecho." -ForegroundColor Green
