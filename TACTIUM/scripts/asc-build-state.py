"""Estado real de un build en App Store Connect (o los ultimos si no se pasa numero).

`eas submit --id` devuelve "Something went wrong" incluso cuando la subida SI
ha funcionado, asi que la unica fuente de verdad es preguntarle a Apple.

Uso (desde TACTIUM/):  python scripts/asc-build-state.py [numero_de_build]
Requiere AuthKey_VDW5XZ2YM6.p8 en TACTIUM/ y `pip install pyjwt cryptography`.
"""
import json, sys, time, urllib.request, jwt

KEY_ID, ISSUER, APP_ID = "VDW5XZ2YM6", "1946c360-e369-44c8-ac44-7b74fd432763", "6769825905"

def token() -> str:
    return jwt.encode(
        {"iss": ISSUER, "iat": int(time.time()), "exp": int(time.time()) + 600,
         "aud": "appstoreconnect-v1"},
        open("AuthKey_VDW5XZ2YM6.p8").read(),
        algorithm="ES256", headers={"kid": KEY_ID, "typ": "JWT"})

def api(path: str, tok: str):
    req = urllib.request.Request("https://api.appstoreconnect.apple.com/v1/" + path,
                                 headers={"Authorization": "Bearer " + tok})
    try:
        return json.load(urllib.request.urlopen(req, timeout=60))
    except Exception as e:
        return {"ERR": str(e), "body": getattr(e, "read", lambda: b"")().decode()[:300]}

def main() -> int:
    tok = token()
    want = sys.argv[1] if len(sys.argv) > 1 else None
    q = f"builds?filter[app]={APP_ID}&limit=10&fields[builds]=version,processingState,uploadedDate,expired"
    if want:
        q += f"&filter[version]={want}"
    d = api(q, tok)
    if "ERR" in d:
        print("ERROR consultando App Store Connect:", d["ERR"], d.get("body", ""))
        return 2
    rows = sorted(((b["attributes"].get("uploadedDate") or "", b["attributes"])
                   for b in d.get("data", [])), reverse=True)
    if not rows:
        print(f"build {want}: NO esta en App Store Connect" if want else "sin builds")
        return 1
    for up, a in rows:
        print(f"  build {str(a.get('version')):>3} | {str(a.get('processingState')):<12} | subido {up[:16]}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
