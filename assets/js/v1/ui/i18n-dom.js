// Langue de l'interface, côté page. Le français est la langue source : un texte absent d'une langue
// s'affiche en français, et rien n'est traduit à la volée.
//
// Dans les modules : t('Texte'), tm('Texte avec **Markdown**'), et tx('Texte') pour un texte écrit hors de
// l'interface. Le texte s'écrit toujours en toutes lettres : c'est ainsi que _dev/textes.mjs le collecte.
// Dans les pages : data-i18n (le texte de l'élément est la source), data-i18n-md (idem, avec gras et code),
// data-i18n-placeholder, data-i18n-aria-label, data-i18n-title (la valeur de l'attribut est la source).
import { htmlLang, isRtl, languageList, pickLanguage, translate, validLang } from '../lib/i18n.js';
import { parseInline } from '../lib/markdown.js';
import { fill } from './dom.js';
import { renderInline } from './markdown-view.js';

const FRENCH = { code: 'fr', label: 'Français' };
const ATTRIBUTES = [['data-i18n-placeholder', 'placeholder'], ['data-i18n-aria-label', 'aria-label'], ['data-i18n-title', 'title']];

let list = [FRENCH];  // toutes les langues : celles que le visiteur peut demander pour la réponse du moteur
let uiCodes = ['fr']; // celles dans lesquelles l'interface elle-même est traduite
let current = 'fr';
let catalog = null;
let store = null;

const collapse = (text) => text.replace(/\s+/g, ' ').trim();
const markdownOf = (source, vars) => renderInline(parseInline(translate(catalog, source, vars)));

// Numéro de version des fichiers, lu sur le lien du module de la page (?v=…)
function assetVersion() {
  const script = document.querySelector('script[type="module"][src*="/assets/js/"]');
  const match = script ? /[?&]v=(\d+)/.exec(script.getAttribute('src') || '') : null;
  return match ? match[1] : '';
}

async function fetchJson(path) {
  try {
    const version = assetVersion();
    const response = await fetch(version ? `${path}?v=${version}` : path);
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

// Choix de la langue de l'interface, parmi celles où elle est traduite : ?lang= s'il est valable, sinon le
// choix gardé, sinon les langues du navigateur, sinon le français
export async function initI18n(options) {
  store = options.store;
  ({ all: list, ui: uiCodes } = languageList(await fetchJson('/assets/i18n/langues.json')));
  const asked = new URLSearchParams(window.location.search).get('lang');
  const kept = store.getLang();
  if (validLang(asked, uiCodes)) current = asked;
  else if (validLang(kept, uiCodes)) current = kept;
  else current = pickLanguage(window.navigator.languages || [window.navigator.language], uiCodes);

  catalog = null;
  if (current !== 'fr') {
    const data = await fetchJson(`/assets/i18n/${current}.json`);
    if (data && typeof data === 'object' && !Array.isArray(data)) catalog = data;
  }
  // Fichier de langue absent ou illisible : l'interface reste en français
  const shown = catalog ? current : 'fr';
  document.documentElement.lang = htmlLang(shown);
  document.documentElement.dir = isRtl(shown) ? 'rtl' : 'ltr';
  applyTranslations(document);
}

export function t(text, vars) {
  return translate(catalog, text, vars);
}

// Texte de l'auteur qui contient du Markdown en ligne (gras, italique, code)
export function tm(text, vars) {
  return markdownOf(text, vars);
}

// Donnée reçue de l'API, ou texte marqué par tx : sa traduction si elle existe, sinon le texte tel quel
export const td = (text) => translate(catalog, String(text ?? ''));

export const currentLang = () => current;

// Langues de la réponse du moteur : toutes celles de l'app actuelle
export const languages = () => list.slice();

// Langues dans lesquelles l'interface peut s'afficher
export const interfaceLanguages = () => list.filter((entry) => uiCodes.includes(entry.code));

export const languageLabel = (code) => (list.find((entry) => entry.code === code) || FRENCH).label;

// Le choix est gardé sur l'appareil, puis la page se recharge dans la langue choisie. Ce que le visiteur a
// en cours (formulaire, conversation) est gardé pour l'onglet : rien n'est perdu.
export function setLanguage(code) {
  if (!validLang(code, uiCodes)) return false;
  store.setLang(code);
  const url = new URL(window.location.href);
  url.searchParams.delete('lang');
  window.location.replace(url.href);
  return true;
}

export function applyTranslations(root = document) {
  for (const node of root.querySelectorAll('[data-i18n], [data-i18n-md]')) {
    const markdown = node.hasAttribute('data-i18n-md');
    const name = markdown ? 'i18nMd' : 'i18n';
    if (!node.dataset[name]) node.dataset[name] = collapse(node.textContent); // première fois : le texte de la page est la source
    const source = node.dataset[name];
    if (markdown) fill(node, markdownOf(source));
    else node.textContent = translate(catalog, source);
  }
  for (const [attribute, target] of ATTRIBUTES) {
    for (const node of root.querySelectorAll(`[${attribute}]`)) node.setAttribute(target, translate(catalog, node.getAttribute(attribute)));
  }
}
