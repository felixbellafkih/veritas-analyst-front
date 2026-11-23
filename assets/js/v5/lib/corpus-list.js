// Extraits des analyses, lus dans la page de liste du corpus public (/corpus/ ou /en/corpus/). Le Kernel
// régénère cette page à chaque publication : l'accueil reste ainsi d'accord avec le corpus publié, même
// quand une analyse est corrigée. Rien n'est lu comme du balisage : le texte de la page est parcouru tel
// quel, et l'extrait rendu est un texte simple.
//
// Forme d'une entrée, à l'ancien gabarit : <a href="/corpus/1/1/">Titre</a><br><span class="muted">Extrait…</span>
// et au gabarit du site (étape 5) : <a class="corpus__lien" href="/corpus/1/1/">Titre</a><span class="corpus__extrait">Extrait…</span>
const ENTRY = /<a (?:class="corpus__lien" )?href="(\/(?:en\/)?corpus\/[^"]+)">[^<]*<\/a>\s*(?:<br>\s*<span class="muted">|<span class="corpus__extrait">)([^<]*)<\/span>/g;
const ENTITY = /&(#x[0-9A-Fa-f]{1,6}|#\d{1,7}|amp|lt|gt|quot|apos);/g;
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const MAX_LENGTH = 2000000;

function codePoint(value) {
  return Number.isInteger(value) && value > 0 && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff) ? String.fromCodePoint(value) : '';
}

function decode(text) {
  return text.replace(ENTITY, (whole, name) => {
    if (name.startsWith('#x')) return codePoint(parseInt(name.slice(2), 16));
    if (name.startsWith('#')) return codePoint(Number(name.slice(1)));
    return NAMED[name];
  });
}

// html : le texte de la page de liste. Rend une Map : adresse de l'analyse → extrait.
export function corpusExcerpts(html) {
  const excerpts = new Map();
  if (typeof html !== 'string' || html.length > MAX_LENGTH) return excerpts;
  for (const match of html.matchAll(ENTRY)) {
    const excerpt = decode(match[2]).trim();
    if (excerpt) excerpts.set(match[1], excerpt);
  }
  return excerpts;
}
