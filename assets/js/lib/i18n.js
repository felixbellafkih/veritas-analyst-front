// Langues de l'interface : logique sans navigateur. Le français est la langue source ; un catalogue est
// { "<texte français>": "<traduction>" }. Un texte absent d'une langue s'affiche en français.

// Repère pour la collecte des textes (_dev/textes.mjs) : tx('…') rend le texte tel quel. Il sert aux
// textes écrits hors de l'interface (messages d'erreur), que l'interface traduit ensuite.
export const tx = (text) => text;

const PLACEHOLDER = /\{([a-zA-Z]+)\}/g;
const RTL = new Set(['ar', 'iw', 'fa', 'ur', 'ps']);
// Codes du catalogue (ceux de Google Traduction) → codes normalisés de l'attribut lang
const HTML_LANG = { iw: 'he', no: 'nb', tl: 'fil', 'zh-CN': 'zh-Hans', 'zh-TW': 'zh-Hant' };
// Codes des navigateurs → codes du catalogue
const ALIASES = { he: 'iw', nb: 'no', nn: 'no', fil: 'tl', jw: 'jv' };
const TRADITIONAL = new Set(['hant', 'tw', 'hk', 'mo']);

const own = (object, name) => Object.prototype.hasOwnProperty.call(object, name);
const placeholders = (text) => [...text.matchAll(PLACEHOLDER)].map((match) => match[0]).sort().join();

function fill(text, vars) {
  if (!vars) return text;
  return text.replace(PLACEHOLDER, (whole, name) => (own(vars, name) ? String(vars[name]) : whole));
}

export function translate(catalog, text, vars) {
  let translated = catalog && own(catalog, text) ? catalog[text] : '';
  // Traduction absente, vide, ou qui a perdu un repère ({n}…) : le français sert
  if (typeof translated !== 'string' || !translated || placeholders(translated) !== placeholders(text)) translated = text;
  return fill(translated, vars);
}

function matchLanguage(tag, codes) {
  if (typeof tag !== 'string' || !tag) return null;
  const parts = tag.toLowerCase().split(/[-_]/);
  if (parts[0] === 'zh') {
    const code = parts.slice(1).some((part) => TRADITIONAL.has(part)) ? 'zh-TW' : 'zh-CN';
    return codes.includes(code) ? code : null;
  }
  const exact = codes.find((code) => code.toLowerCase() === tag.toLowerCase());
  if (exact) return exact;
  const primary = own(ALIASES, parts[0]) ? ALIASES[parts[0]] : parts[0];
  return codes.includes(primary) ? primary : null;
}

// Première langue du visiteur (navigator.languages) qui existe dans la liste ; sinon le français
export function pickLanguage(candidates, codes) {
  for (const tag of candidates || []) {
    const found = matchLanguage(tag, codes);
    if (found) return found;
  }
  return 'fr';
}

export const validLang = (code, codes) => typeof code === 'string' && codes.includes(code);

export const isRtl = (code) => RTL.has(code);

export const htmlLang = (code) => (own(HTML_LANG, code) ? HTML_LANG[code] : code);
