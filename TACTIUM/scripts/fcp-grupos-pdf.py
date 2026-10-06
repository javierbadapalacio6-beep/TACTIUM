"""
Carga el grupo (A, B, C…) y la sede corta de cada equipo inscrito desde el PDF
de distribución que publica la Federación Cántabra antes del calendario.

    python scripts/fcp-grupos-pdf.py <pdf-o-url>            # informe, no escribe
    python scripts/fcp-grupos-pdf.py <pdf-o-url> --apply    # escribe en fcp_inscripciones
    python scripts/fcp-grupos-pdf.py <pdf-o-url> --sql=x.sql  # deja el UPDATE en un fichero

Credenciales: TACTIUM_SUPABASE_URL + TACTIUM_SUPABASE_SERVICE_KEY (o
SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) en el entorno o en el `.env` de
`../4PADEL CLAUDE`. Sin clave de servicio lee con la publicable de
`tactium-web/.env.local` y, en vez de escribir, genera el .sql.

POR QUÉ. La web de la FCP lista los inscritos por categoría y no dice en qué
grupo cae cada uno hasta que sale el calendario; el PDF sí. Ver la migración
`20261006b_fcp_inscripciones_subgrupo.sql`.

CÓMO CRUZA. El PDF escribe los equipos SIN patrocinador («RACKET SPORT D») y la
web con él («RACKET SPORT D-CEINOR»), y a veces la letra cambia entre una y otra
porque el PDF es la versión revisada. Por eso, dentro de cada género+categoría:
  1. nombre idéntico;
  2. el nombre del PDF es el principio del de la web («RACKET SPORT D» + «-…»),
     solo si hay un único candidato;
  3. lo que sobra, por club: si un club tiene N sobrantes en cada lado, se
     emparejan por letra (PDF) contra puntos medios de la plantilla (web), que
     es como la FCP asigna las letras: el mejor equipo es la A;
  4. si queda exactamente uno en cada lado, se emparejan entre sí.
Lo que no casa se enseña en el informe y no se escribe.
"""
import io
import json
import os
import re
import sys
import unicodedata
import urllib.request
from collections import defaultdict

import pypdf


# ── Entorno ─────────────────────────────────────────────────────────────────
def load_env():
    """(url, clave, es_servicio). Sin clave de servicio vale la publicable de la
    web: las tablas `fcp_*` se leen sin sesión, y entonces se escribe un .sql
    en vez de tocar la base de datos."""
    here = os.path.dirname(os.path.abspath(__file__))
    for p in (os.path.join(here, '..', '..', '..', '4PADEL CLAUDE', '.env'),
              os.path.join(here, '..', '..', 'tactium-web', '.env.local')):
        if os.path.exists(p):
            for line in open(p, encoding='utf-8'):
                m = re.match(r'^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$', line)
                if m and not os.environ.get(m.group(1)):
                    os.environ[m.group(1)] = m.group(2).strip('"\'')
    env = os.environ.get
    url = env('TACTIUM_SUPABASE_URL') or env('SUPABASE_URL') or env('NEXT_PUBLIC_SUPABASE_URL')
    service = env('TACTIUM_SUPABASE_SERVICE_KEY') or env('SUPABASE_SERVICE_ROLE_KEY')
    key = service or env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
    if not url or not key:
        sys.exit('Faltan la URL de Supabase y una clave (de servicio o publicable)')
    return url.rstrip('/'), key, bool(service)


def rest(url, key, path, method='GET', body=None):
    req = urllib.request.Request(
        f'{url}/rest/v1/{path}',
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={
            'apikey': key,
            'Authorization': f'Bearer {key}',
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
        },
    )
    with urllib.request.urlopen(req) as r:
        raw = r.read()
        return json.loads(raw) if raw else None


# ── PDF ─────────────────────────────────────────────────────────────────────
def read_pdf(src):
    if re.match(r'^https?://', src):
        data = urllib.request.urlopen(src).read()
    else:
        data = open(src, 'rb').read()
    return [p.extract_text() for p in pypdf.PdfReader(io.BytesIO(data)).pages]


def parse_pdf(pages):
    """Una página por categoría: tabla Nº/EQUIPO/SEDE y luego GRUPO A, B…"""
    out = []
    for page in pages:
        lines = [l.strip() for l in page.split('\n') if l.strip()]
        cat = next((l for l in lines if re.match(r'^\dª (MASCULINA|FEMENINA)$', l)), None)
        if not cat or 'SEDE' not in lines:
            continue
        genero = 'M' if 'MASC' in cat else 'F'
        num = cat[0]
        i = lines.index('SEDE') + 1
        teams = []
        while i + 2 < len(lines) and not lines[i].startswith('GRUPO'):
            teams.append((lines[i + 1], lines[i + 2]))
            i += 3
        grupo_de, g = {}, None
        while i < len(lines):
            if lines[i].startswith('GRUPO '):
                g = lines[i][6:].strip()
                i += 1
                continue
            if i + 1 < len(lines):
                grupo_de[lines[i + 1]] = g
            i += 2
        for equipo, sede in teams:
            out.append({'genero': genero, 'cat': num, 'equipo': equipo,
                        'sede': sede, 'grupo': grupo_de.get(equipo)})
    return out


# ── Nombres ─────────────────────────────────────────────────────────────────
def norm(s):
    s = unicodedata.normalize('NFD', (s or '').upper())
    s = ''.join(ch for ch in s if unicodedata.category(ch) != 'Mn')
    s = re.sub(r'\+\s+', '+', s)
    s = re.sub(r'\s*-\s*', '-', s)
    return re.sub(r'\s+', ' ', s).strip()


def club_of(equipo):
    """Mismo criterio que `clubOf` en la app: sin patrocinador ni letra."""
    s = re.sub(r'\s+', ' ', equipo.strip())
    s = re.sub(r'\s*[-–]\s*[^-–]+$', '', s).strip() or s
    s = re.sub(r'\s+(G[º°]\.?|GRUPO)\s+.+$', '', s, flags=re.I).strip() or s
    s = re.sub(r'\s+([A-ZÑ]|\d{1,2})$', '', s, flags=re.I).strip()
    return norm(s)


def letter_of(equipo):
    m = re.search(r'\s([A-ZÑ])$', equipo.strip())
    return m.group(1) if m else 'Z'


# ── Cruce ───────────────────────────────────────────────────────────────────
def match(pdf_rows, db_rows, avg_pts):
    pares, informe = [], []
    P, D = defaultdict(list), defaultdict(list)
    for r in pdf_rows:
        P[(r['genero'], r['cat'])].append(r)
    for r in db_rows:
        cat = (r.get('grupo_nombre') or '?')[0]
        D[(r['genero'], cat)].append(r)

    for k in sorted(set(P) | set(D)):
        ps, ds = list(P[k]), list(D[k])

        def take(p, d, how):
            pares.append((p, d, how))
            ps.remove(p)
            ds.remove(d)

        # 1. idéntico
        for p in list(ps):
            d = next((d for d in ds if norm(d['equipo']) == norm(p['equipo'])), None)
            if d:
                take(p, d, 'igual')
        # 2. prefijo único
        for p in list(ps):
            pn = norm(p['equipo'])
            cands = [d for d in ds if norm(d['equipo']).startswith(pn + '-')
                     or norm(d['equipo']).startswith(pn + ' ')]
            if len(cands) == 1:
                take(p, cands[0], 'patrocinador')
        # 3. por club, letra contra puntos
        por_club_p, por_club_d = defaultdict(list), defaultdict(list)
        for p in ps:
            por_club_p[club_of(p['equipo'])].append(p)
        for d in ds:
            por_club_d[club_of(d['equipo'])].append(d)
        for club, pl in por_club_p.items():
            dl = por_club_d.get(club, [])
            if pl and len(pl) == len(dl):
                pl = sorted(pl, key=lambda r: letter_of(r['equipo']))
                dl = sorted(dl, key=lambda r: -avg_pts.get(r['id_equipo'], 0))
                for p, d in zip(pl, dl):
                    take(p, d, 'por puntos')
        # 4. último que queda
        if len(ps) == 1 and len(ds) == 1:
            take(ps[0], ds[0], 'único sobrante')

        for p in ps:
            informe.append(f'  {k}: en el PDF y sin casar  -> {p["equipo"]}')
        for d in ds:
            informe.append(f'  {k}: en la web y no en el PDF -> {d["equipo"]} (id {d["id_equipo"]})')
    return pares, informe


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not args:
        sys.exit(__doc__)
    apply = '--apply' in sys.argv
    sql_out = next((a.split('=', 1)[1] for a in sys.argv if a.startswith('--sql=')), None)
    url, key, es_servicio = load_env()

    pdf_rows = parse_pdf(read_pdf(args[0]))
    if not pdf_rows:
        sys.exit('El PDF no tiene el formato esperado (Nº / EQUIPO / SEDE + GRUPO X)')

    # La liga en inscripción: la de id más alto con filas.
    top = rest(url, key, 'fcp_inscripciones?select=id_liga&order=id_liga.desc&limit=1')
    if not top:
        sys.exit('No hay inscripciones en la base de datos')
    id_liga = top[0]['id_liga']
    db_rows = rest(url, key, f'fcp_inscripciones?select=id_grupo,id_equipo,equipo,genero,grupo_nombre'
                             f'&id_liga=eq.{id_liga}&limit=5000')

    ids = ','.join(str(r['id_equipo']) for r in db_rows)
    jug = rest(url, key, f'fcp_jugadores?select=id_equipo,puntos&id_liga=eq.{id_liga}'
                         f'&id_equipo=in.({ids})&limit=20000') or []
    tot, cnt = defaultdict(float), defaultdict(int)
    for j in jug:
        tot[j['id_equipo']] += j['puntos'] or 0
        cnt[j['id_equipo']] += 1
    avg_pts = {k: tot[k] / cnt[k] for k in cnt}

    pares, informe = match(pdf_rows, db_rows, avg_pts)
    print(f'Liga {id_liga}: {len(pdf_rows)} equipos en el PDF, {len(db_rows)} en la web, {len(pares)} casados')
    for p, d, how in pares:
        if how not in ('igual', 'patrocinador'):
            print(f'  [{how}] {d["equipo"]}  =  {p["equipo"]} (grupo {p["grupo"]})')
    if informe:
        print('Sin casar:')
        print('\n'.join(informe))

    if sql_out or (apply and not es_servicio):
        # Sin clave de servicio no se puede escribir por REST: se deja un .sql
        # para aplicarlo a mano (SQL editor de Supabase o el MCP).
        sql_out = sql_out or 'fcp-grupos.sql'
        q = lambda v: "'" + str(v).replace("'", "''") + "'"
        with open(sql_out, 'w', encoding='utf-8') as f:
            f.write(f'-- Grupos y sedes del PDF de distribución · liga {id_liga}\n')
            f.write('update public.fcp_inscripciones i set subgrupo = v.g, sede_corta = v.s\nfrom (values\n')
            f.write(',\n'.join(f'  ({q(d["id_grupo"])}, {d["id_equipo"]}, {q(p["grupo"])}, {q(p["sede"])})'
                               for p, d, _ in pares))
            f.write(f'\n) as v(id_grupo, id_equipo, g, s)\n'
                    f'where i.id_liga = {id_liga} and i.id_grupo = v.id_grupo and i.id_equipo = v.id_equipo;\n')
        print(f'SQL escrito en {sql_out} ({len(pares)} equipos).')
        return
    if not apply:
        print('\n(Informe solo. Añade --apply para escribir, o --sql=fichero.sql.)')
        return
    for p, d, _ in pares:
        rest(url, key,
             f'fcp_inscripciones?id_liga=eq.{id_liga}&id_grupo=eq.{d["id_grupo"]}&id_equipo=eq.{d["id_equipo"]}',
             method='PATCH', body={'subgrupo': p['grupo'], 'sede_corta': p['sede']})
    print(f'Escritos {len(pares)} equipos.')


if __name__ == '__main__':
    main()
