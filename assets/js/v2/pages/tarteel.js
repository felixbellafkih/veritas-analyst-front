// Page Tarteel : tous les versets d'une racine, ou du croisement de deux racines, à explorer sans clé.
// Lectures publiques seulement : cette page n'envoie ni clé ni mot de passe, et ne lance aucune analyse.
// « Analyser dans l'Interpréteur » y reporte les racines et les versets cochés ; l'analyse, facturée sur la
// clé du visiteur, se lance là-bas, par lui.
// L'adresse porte les racines (?p=…&c=…), jamais la sélection : une recherche se partage.
import { createApi } from '../api.js';
import { apiBase, apiChoice } from '../lib/config.js';
import { ROOT_MAX, formState } from '../lib/form-state.js';
import { makeHandoff } from '../lib/tarteel-handoff.js';
import { createTarteelProbe } from '../lib/tarteel-probe.js';
import { clusterCopyText, indexesOfSura, parseTarteelQuery, suraDistribution, tarteelQuery } from '../lib/tarteel-stats.js';
import { clusterVerse } from '../lib/tarteel.js';
import { SURAS, passageQuery } from '../lib/verses.js';
import { copyText } from '../ui/clipboard.js';
import { mountClusterList } from '../ui/cluster-list.js';
import { add, browserStore, clear, el, fill } from '../ui/dom.js';
import { icon } from '../ui/icons.js';
import { initI18n, t } from '../ui/i18n-dom.js';
import { openKeyDialog } from '../ui/key-dialog.js';
import { mountShell } from '../ui/shell.js';
import { clusterNodes, signalNodes, tarteelHelp } from '../ui/tarteel-status.js';

const store = browserStore();
// Essai en local : la vraie API ou le faux serveur, choix gardé pour l'onglet (null en ligne)
const localApi = apiChoice(window.location, store.getApiChoice());
if (localApi) store.setApiChoice(localApi);
const api = createApi({ base: apiBase(window.location, localApi) });
await initI18n({ store });
document.title = `${t('Tarteel')} — Veritas Analyst`;

const shell = mountShell({ page: 'tarteel', store, onKeyClick: () => openKeyDialog({ store, api, onChange: showAccess }), localApi });
function showAccess() {
  shell.setKeyStatus(store.getDevPassword() ? 'dev' : store.getKey() ? 'presente' : 'absente');
}
showAccess();

const number = (value) => value.toLocaleString(document.documentElement.lang || 'fr');

// ------------------------------------------------------------------ saisie

const rootAttrs = { type: 'text', maxlength: ROOT_MAX, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', dir: 'auto' };
const primary = el('input', { class: 'saisie', attrs: { id: 'racine-primaire', ...rootAttrs } });
const constraint = el('input', { class: 'saisie', attrs: { id: 'racine-contrainte', ...rootAttrs } });
const field = (id, label, control) => el('div', { class: 'champ' }, el('label', { class: 'champ__etiquette', text: label, attrs: { for: id } }), control);

const signal = el('div', { class: 'tarteel__signal', attrs: { role: 'status', 'aria-live': 'polite' } });
const figures = el('div', { class: 'exploration__chiffres' });
const clusterBox = el('div', { class: 'tarteel__cluster' });
const announce = el('span', { class: 'sr', attrs: { role: 'status' } });
const send = el('button', { class: 'bouton', attrs: { type: 'button', hidden: true } }, el('span', { text: t('Analyser dans l’Interpréteur') }), icon('arrow'));

fill(document.getElementById('tarteel'),
  el('form', { class: 'exploration__saisie carte', attrs: { novalidate: true }, on: { submit: (event) => event.preventDefault() } },
    tarteelHelp(),
    el('div', { class: 'exploration__champs' },
      field('racine-primaire', t('1. Racine Primaire (ex: D.-R-B)'), primary),
      field('racine-contrainte', t('2. Contrainte (Optionnelle)'), constraint)),
    signal),
  figures,
  clusterBox,
  el('div', { class: 'exploration__envoi' }, send, announce));

// ------------------------------------------------------------------ résultat

let list = null;   // la liste des versets à l'écran, quand un cluster est lu
let verses = [];   // les versets du cluster à l'écran

const chosenIndexes = () => verses.map((_, index) => index).filter((index) => probe.isSelected(index));

// Un lien, au bout de chaque verset, qui ouvre l'Interpréteur sur ce verset seul (rien n'y est lancé)
function verseLink(index, verse) {
  const { reference } = clusterVerse(verse);
  if (!reference) return null;
  const [sura, verseNumber] = reference.split(':').map(Number);
  return el('a', {
    class: 'cluster__lien',
    attrs: { href: `/interpreteur/${passageQuery({ sura, start: verseNumber, end: verseNumber })}`, 'aria-label': `${t('Ouvrir ce verset dans l’Interpréteur')} : ${reference}`, title: t('Ouvrir ce verset dans l’Interpréteur') },
  }, icon('arrow', 16));
}

// Le nombre de versets et de sourates, le filtre par sourate, la copie
function showFigures() {
  const distribution = suraDistribution(verses);
  const filter = el('select', { class: 'saisie', attrs: { id: 'filtre-sourate' } });
  add(filter, el('option', { text: t('Toutes les sourates ({n})', { n: number(verses.length) }), attrs: { value: '' } }));
  for (const { sura, count } of distribution) {
    const name = SURAS[sura - 1] ? SURAS[sura - 1].name : '';
    add(filter, el('option', { text: `${sura} · ${name} (${number(count)})`, attrs: { value: sura } }));
  }
  filter.addEventListener('change', () => {
    if (list) list.setVisible(filter.value ? indexesOfSura(verses, Number(filter.value)) : null);
  });
  const say = (text) => {
    announce.textContent = '';
    announce.textContent = text;
  };
  const copy = el('button', { class: 'bouton-bord', attrs: { type: 'button' } }, icon('copy'), el('span', { text: t('Copier') }));
  copy.addEventListener('click', async () => {
    // Les versets cochés ; sans case cochée, tout le cluster
    const chosen = chosenIndexes();
    const text = clusterCopyText(chosen.length ? chosen.map((index) => verses[index]) : verses);
    say((await copyText(text)) ? t('Versets copiés.') : t('La copie n’a pas pu se faire.'));
  });
  const share = el('button', { class: 'bouton-bord', attrs: { type: 'button' } }, icon('external'), el('span', { text: t('Copier l’adresse') }));
  share.addEventListener('click', async () => {
    say((await copyText(window.location.href)) ? t('Adresse copiée.') : t('La copie n’a pas pu se faire.'));
  });
  fill(figures,
    el('p', { class: 'exploration__compte', text: t('{n} versets dans {s} sourates', { n: number(verses.length), s: number(distribution.length) }) }),
    el('div', { class: 'exploration__outils' },
      el('div', { class: 'champ exploration__filtre' },
        el('label', { class: 'champ__etiquette', text: t('Filtrer par sourate'), attrs: { for: 'filtre-sourate' } }),
        el('div', { class: 'choix' }, filter, icon('chevron'))),
      copy,
      share));
}

// Affiche ce que la vérification annonce (lib/tarteel-probe.js) ; mêmes messages que dans l'Interpréteur
function show(view) {
  list = null;
  verses = view.step === 'pret' ? view.verses : [];
  fill(signal, signalNodes(view, () => probe.check()));
  send.hidden = view.step !== 'pret';
  if (view.step === 'pret') {
    showFigures();
    // Tous les versets, une case devant chacun ; rien n'est coché au départ
    list = mountClusterList(clusterBox, { probe, verses, rowExtra: verseLink });
  } else {
    clear(figures);
    fill(clusterBox, clusterNodes(view, () => probe.check()));
  }
}

const probe = createTarteelProbe({ api, onChange: show });

// À chaque frappe : la recherche repart, et l'adresse suit (sans allonger l'historique)
function rootsChanged() {
  const roots = { primary: primary.value, constraint: constraint.value };
  window.history.replaceState(null, '', `/tarteel/${tarteelQuery(roots)}`);
  probe.input(roots.primary, roots.constraint);
}
primary.addEventListener('input', rootsChanged);
constraint.addEventListener('input', rootsChanged);

// Les racines et les versets cochés passent à l'Interpréteur, dans la mémoire de l'onglet. Rien n'y est
// lancé : le visiteur y retrouve sa sélection, sa clé, la langue et le modèle, et lance lui-même l'analyse.
send.addEventListener('click', () => {
  const chosen = chosenIndexes();
  if (!list || !chosen.length) {
    if (list) {
      list.showHint();
      list.focusTools();
    }
    return;
  }
  const roots = { primary: primary.value.trim(), constraint: constraint.value.trim() };
  store.saveForm({ ...formState(store.loadForm()), mode: 'tarteel', ...roots });
  store.saveTarteelHandoff(makeHandoff(roots.primary, roots.constraint, verses, chosen));
  window.location.assign('/interpreteur/');
});

// Racines portées par l'adresse : la recherche part aussitôt
const asked = parseTarteelQuery(window.location.search);
primary.value = asked.primary;
constraint.value = asked.constraint;
if (asked.primary) {
  probe.input(asked.primary, asked.constraint);
  probe.flush();
}
