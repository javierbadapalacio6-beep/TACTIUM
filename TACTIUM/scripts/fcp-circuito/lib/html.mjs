// Utilidades HTML mínimas (sin dependencias), en la línea del agente FCP.
const ENT = {
  ntilde: 'ñ', Ntilde: 'Ñ', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', ordf: 'ª', ordm: 'º',
  uuml: 'ü', Uuml: 'Ü', ccedil: 'ç', Ccedil: 'Ç', middot: '·',
};

export function decode(str) {
  if (!str) return '';
  return String(str)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

/** Filas <tr> con sus celdas (texto + atributos + html). No anida tablas. */
export function rows(html) {
  const out = [];
  const re = /<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi;
  let m;
  while ((m = re.exec(html))) {
    const cells = [];
    const cr = /<t([dh])\b([^>]*)>([\s\S]*?)(?=<t[dh]\b|<\/tr>|$)/gi;
    let c;
    while ((c = cr.exec(m[2]))) {
      const inner = c[3].replace(/<\/t[dh]>\s*$/i, '');
      cells.push({ tag: c[1], attrs: c[2], html: inner, text: decode(inner) });
    }
    out.push({ attrs: m[1], cells, html: m[2] });
  }
  return out;
}

export function links(html) {
  const out = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) out.push({ href: m[1].replace(/&amp;/g, '&'), text: decode(m[2]) });
  return out;
}

export function attr(attrs, name) {
  const m = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(attrs || '');
  return m ? (m[1] ?? m[2] ?? m[3]) : null;
}

/** Normaliza para comparar nombres: sin tildes, mayúsculas, Ñ→N, solo letras/dígitos. */
export const norm = s => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
