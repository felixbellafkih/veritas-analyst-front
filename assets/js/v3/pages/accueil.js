// Page d'accueil. Le contenu éditorial est écrit dans la page ; ce module y ajoute ce qui dépend du
// navigateur ou de l'API : le sélecteur de passage, la carte de racine, les repères, les extraits du corpus.
// Rien de ce qui vient du LEXICON ou de l'API n'est recopié dans la page : ce qui manque ne s'affiche pas.
import { createApi } from '../api.js';
import { apiBase, apiChoice } from '../lib/config.js';
import { corpusExcerpts } from '../lib/corpus-list.js';
import { htmlLang } from '../lib/i18n.js';
import { rootTiles } from '../lib/root-card.js';
import { scannerHref } from '../lib/roots-index.js';
import { MAX_VERSES, SURAS, clampRange, interpreterHref } from '../lib/verses.js';
import { add, browserStore, el, fill } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { currentLang, initI18n, interfaceLanguages, t, td, tm } from '../ui/i18n-dom.js';
import { openKeyDialog } from '../ui/key-dialog.js';
import { mountShell } from '../ui/shell.js';

const EXAMPLE_ROOT = 'S-M-W'; // racine montrée en exemple, tirée de l'analyse de 1:1
const VERSES = SURAS.reduce((total, sura) => total + sura.verses, 0);

const store = browserStore();
// Essai en local : la vraie API ou le faux serveur, choix gardé pour l'onglet (null en ligne)
const localApi = apiChoice(window.location, store.getApiChoice());
if (localApi) store.setApiChoice(localApi);
const api = createApi({ base: apiBase(window.location, localApi) });
await initI18n({ store });
document.title = `VERITAS | ${t('Analyse systémique du texte coranique')}`;

const shell = mountShell({ page: 'accueil', store, onKeyClick: () => openKeyDialog({ store, api, onChange: showAccess }), localApi });

function showAccess() {
  shell.setKeyStatus(store.getDevPassword() ? 'dev' : store.getKey() ? 'presente' : 'absente');
}
showAccess();

// Icônes des cartes et des liens écrits dans la page
for (const node of document.querySelectorAll('[data-icone]')) fill(node, icon(node.dataset.icone, Number(node.dataset.taille) || 26));

// Le corpus a une version française et une version anglaise : hors du français, les liens mènent à l'anglaise
const english = currentLang() !== 'fr';
if (english) {
  for (const link of document.querySelectorAll('a[data-corpus]')) link.setAttribute('href', `/en${link.getAttribute('href')}`);
}

fill(document.getElementById('avertissement'), tm("**Avertissement d'exécution :** L'accès de l'IA aux exégèses traditionnelles (Tafsir) a été bloqué au maximum pour assurer une décompilation purement mécanique. Quelques résidus dogmatiques peuvent encore transparaître, mais ce bruit s'atténuera au fil des mises à jour du Lexicon."));

// ------------------------------------------------------------------ sélecteur de passage

function field(id, label, control, className) {
  return el('div', { class: `champ ${className}` }, el('label', { class: 'champ__etiquette', text: label, attrs: { for: id } }), control);
}

// « Analyser » ouvre l'Interpréteur sur le passage choisi, sans rien lancer : l'analyse est facturée sur
// la clé du visiteur, c'est lui qui la lance. Le passage voyage dans l'adresse sous forme de nombres.
function mountPicker(form) {
  let range = { sura: 1, start: 1, end: SURAS[0].verses };
  const sura = el('select', { class: 'saisie', attrs: { id: 'accueil-sourate' } });
  for (const entry of SURAS) add(sura, el('option', { text: `${entry.n} · ${entry.name}`, attrs: { value: entry.n } }));
  const start = el('input', { class: 'saisie', attrs: { id: 'accueil-debut', type: 'number', inputmode: 'numeric', min: 1 } });
  const end = el('input', { class: 'saisie', attrs: { id: 'accueil-fin', type: 'number', inputmode: 'numeric', min: 1 } });

  function paint() {
    const limit = SURAS[range.sura - 1].verses;
    sura.value = String(range.sura);
    start.value = String(range.start);
    start.max = String(limit);
    end.value = String(range.end);
    end.min = String(range.start);
    end.max = String(Math.min(limit, range.start + MAX_VERSES - 1));
  }

  function change(next) {
    const clamped = clampRange(next.sura, next.start, next.end);
    if (!clamped) return;
    range = { sura: Number(next.sura), ...clamped };
    paint();
  }

  sura.addEventListener('change', () => change({ sura: Number(sura.value), start: 1, end: 1 }));
  start.addEventListener('change', () => change({ sura: range.sura, start: start.value, end: Math.max(Number(end.value) || 0, Number(start.value) || 0) }));
  end.addEventListener('change', () => change({ sura: range.sura, start: range.start, end: end.value }));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    change({ sura: range.sura, start: start.value, end: end.value }); // une valeur tout juste saisie est prise en compte
    window.location.assign(interpreterHref(range));
  });

  fill(form,
    field('accueil-sourate', t('Sourate'), el('div', { class: 'choix' }, sura, icon('chevron')), 'selecteur__sourate'),
    field('accueil-debut', t('Du verset'), start, 'selecteur__verset'),
    field('accueil-fin', t('au verset'), end, 'selecteur__verset'),
    el('button', { class: 'bouton', attrs: { type: 'submit' } }, el('span', { text: t('Analyser') }), icon('arrow')));
  paint();
}

// ------------------------------------------------------------------ exemple de racine

const text = (value) => (typeof value === 'string' ? value.trim() : '');

// Lettres, fonction logique et équation viennent du LEXICON, par l'API. Si elle ne répond pas, ou si une
// de ces données manque, la carte ne s'affiche pas.
async function showRoot(card) {
  try {
    const root = await api.root(EXAMPLE_ROOT);
    const arabic = text(root && root.arabic);
    const logic = text(root && root.logic_function);
    const equation = text(td(text(root && root.physical_equation)));
    if (!arabic || !logic || !equation) return;
    const tiles = rootTiles(arabic, equation);
    fill(card,
      el('div', { class: 'racine__tete' },
        el('span', { class: 'racine__surtitre', text: t('Exemple de racine') }),
        el('span', { class: 'racine__code', text: text(root.root) || EXAMPLE_ROOT, attrs: { dir: 'ltr' } })),
      tiles
        ? el('div', { class: 'racine__lettres', attrs: { dir: 'rtl' } }, tiles.map((tile) => el('div', { class: 'racine__tuile', attrs: { dir: 'ltr' } },
          el('span', { class: 'racine__lettre', text: tile.letter, attrs: { lang: 'ar' } }),
          el('span', { class: 'racine__latin', text: tile.code }),
          el('span', { class: 'racine__charge', text: tile.charge, attrs: { dir: 'auto' } }))))
        : el('p', { class: 'racine__arabe', text: arabic, attrs: { lang: 'ar', dir: 'rtl' } }),
      el('div', { class: 'racine__sens' },
        el('p', { class: 'racine__fonction', text: logic, attrs: { dir: 'ltr' } }),
        el('p', { class: 'racine__equation', text: equation, attrs: { dir: 'auto' } })),
      // La fiche complète de cette racine (définition, dérivations, racine opposée)
      el('a', { class: 'lien-fleche', attrs: { href: scannerHref(text(root.root) || EXAMPLE_ROOT) } },
        el('span', { text: t('Ouvrir cette racine dans le Scanner') }), icon('arrow', 16)));
    card.hidden = false;
  } catch {
    card.hidden = true;
  }
}

// ------------------------------------------------------------------ repères

function numberFormat() {
  try {
    return new Intl.NumberFormat(htmlLang(currentLang()));
  } catch {
    return new Intl.NumberFormat();
  }
}

// Un repère : la phrase, avec son nombre mis en valeur. template porte le repère {n}.
function marker(template, value) {
  const [before, after = ''] = template.split('{n}');
  return el('span', { class: 'repere' }, before, el('strong', { text: value }), after);
}

// Les chiffres de l'API ne s'affichent que si elle les a donnés : jamais de zéro à leur place
async function showMarkers(strip) {
  let stats = null;
  try {
    stats = await api.stats();
  } catch {
    stats = null;
  }
  const format = numberFormat();
  const roots = stats && Number.isFinite(stats.total_roots) && stats.total_roots > 0 ? stats.total_roots : null;
  const version = text(stats && stats.version);
  fill(strip,
    roots !== null ? marker(t('{n} racines indexées'), format.format(roots)) : null,
    marker(t('{n} versets'), format.format(VERSES)),
    interfaceLanguages().length > 1 ? marker(t('Interface en {n} langues'), format.format(interfaceLanguages().length)) : null,
    version ? el('span', { class: 'repere', text: t('Version {version}', { version }) }) : null);
}

// ------------------------------------------------------------------ corpus public

// L'extrait de chaque analyse est lu sur la liste publiée du corpus : il suit ainsi ses corrections.
// Sans la liste, les entrées restent sans extrait ; une analyse retirée du corpus n'est plus proposée.
async function showExcerpts() {
  try {
    const response = await fetch(english ? '/en/corpus/' : '/corpus/');
    if (!response.ok) return;
    const excerpts = corpusExcerpts(await response.text());
    if (!excerpts.size) return;
    for (const link of document.querySelectorAll('a.entree')) {
      const excerpt = excerpts.get(link.getAttribute('href'));
      const box = link.querySelector('.entree__extrait');
      if (excerpt) {
        box.textContent = excerpt;
        box.lang = english ? 'en' : 'fr';
        box.hidden = false;
      } else {
        link.closest('li').hidden = true;
      }
    }
  } catch {
    // liste illisible : les entrées restent telles qu'elles sont écrites dans la page
  }
}

mountPicker(document.getElementById('selecteur'));
showRoot(document.getElementById('racine'));
showMarkers(document.getElementById('reperes'));
showExcerpts();
