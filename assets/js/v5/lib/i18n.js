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

// Première langue du visiteur (celles que son navigateur annonce) qui existe dans la liste ; sinon le français
export function pickLanguage(candidates, codes) {
  for (const tag of candidates || []) {
    const found = matchLanguage(tag, codes);
    if (found) return found;
  }
  return 'fr';
}

export const validLang = (code, codes) => typeof code === 'string' && codes.includes(code);

// Langue de l'interface à l'ouverture d'une page : ?lang= s'il est valable, sinon le choix gardé, sinon la langue
// propre à la page (fallback : une page du corpus est en français ou en anglais), sinon celles du navigateur.
export function chooseLanguage({ asked, kept, fallback, browser, codes }) {
  if (validLang(asked, codes)) return asked;
  if (validLang(kept, codes)) return kept;
  if (validLang(fallback, codes)) return fallback;
  return pickLanguage(browser, codes);
}

export const isRtl = (code) => RTL.has(code);

export const htmlLang = (code) => (own(HTML_LANG, code) ? HTML_LANG[code] : code);

// Langue de la réponse du moteur : le choix du visiteur s'il est dans la liste, sinon la langue de
// l'interface, sinon le français. Le libellé part tel quel dans la demande (champ language) ; « Français »
// est celui qui ne déclenche aucune consigne de traduction dans le moteur (api.py).
export function responseLanguage(list, chosen, uiCode) {
  const entries = Array.isArray(list) ? list : [];
  const find = (code) => entries.find((entry) => entry && entry.code === code && typeof entry.label === 'string' && entry.label);
  const found = find(chosen) || find(uiCode) || find('fr');
  return found ? { code: found.code, label: found.label } : { code: 'fr', label: 'Français' };
}

const LANG_CODE = /^[A-Za-z]{2,3}(-[A-Za-z]{2,4})?$/;

// Liste des langues, telle que le Kernel l'écrit dans assets/i18n/langues.json :
// [{code, label, interface}, …], dans l'ordre de la liste des langues de l'app actuelle.
//   all : toutes les langues — celles que le visiteur peut demander pour la réponse du moteur ;
//   ui  : les codes des langues dans lesquelles l'interface elle-même est traduite (le français en est toujours).
// Une liste absente, illisible ou sans le français se réduit au français.
export function languageList(loaded) {
  const seen = new Set();
  const entries = [];
  for (const entry of Array.isArray(loaded) ? loaded : []) {
    if (!entry || typeof entry.code !== 'string' || !LANG_CODE.test(entry.code) || seen.has(entry.code)) continue;
    if (typeof entry.label !== 'string' || !entry.label.trim()) continue;
    seen.add(entry.code);
    entries.push(entry);
  }
  if (!seen.has('fr')) return { all: [{ code: 'fr', label: 'Français' }], ui: ['fr'] };
  return {
    all: entries.map((entry) => ({ code: entry.code, label: entry.label })),
    ui: entries.filter((entry) => entry.code === 'fr' || entry.interface === true).map((entry) => entry.code),
  };
}
