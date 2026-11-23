// Liste des versets d'un cluster Tarteel, une case devant chacun : le visiteur coche ceux qu'il veut faire
// analyser. Module partagé par l'Interpréteur (mode Tarteel) et par la page Tarteel.
// - La sélection est tenue par la sonde (lib/tarteel-probe.js), par rang dans le cluster ENTIER : ni le
//   filtre par sourate ni l'affichage par tranches ne changent ce qui est coché, donc ce qui part.
// - Rien n'est coché au départ.
// - La liste s'affiche par tranches, pour rester fluide avec des centaines de versets.
// - Au clavier, elle n'offre qu'un arrêt à la touche Tab ; les flèches passent d'un verset à l'autre.
//   Le lien d'une ligne (page Tarteel) n'est atteignable que sur la ligne du curseur.
// - « Tout sélectionner » et « Tout désélectionner » portent sur les versets affichés.
import { CORPUS_CELL_LIMIT, tooLongForCorpus } from '../lib/corpus-panel.js';
import { hasModifier, nextIndex } from '../lib/roving.js';
import { LARGE_SELECTION, clusterText, clusterVerse, largeSelection } from '../lib/tarteel.js';
import { add, clear, el, fill } from './dom.js';
import { t } from './i18n-dom.js';

const SLICE = 60; // versets affichés d'un coup ; les suivants arrivent quand le bas de la liste approche

// probe : la sonde ; verses : les versets du cluster, tels que l'API les donne ;
// devMode() : vrai en mode développeur (la limite du corpus est alors rappelée à l'auteur) ;
// rowExtra(rang, verset) : un élément de plus au bout d'une ligne (un lien, sur la page Tarteel), ou null.
export function mountClusterList(container, { probe, verses, devMode = () => false, rowExtra = () => null }) {
  let visible = verses.map((_, index) => index); // rangs affichables, dans l'ordre (le filtre par sourate les réduit)
  let rendered = 0;                              // nombre de lignes déjà bâties, parmi « visible »
  let cursor = 0;                                // position, dans « visible », de la case atteignable par Tab
  let disabled = false;
  const boxes = new Map();                       // rang dans le cluster → case bâtie
  const extras = new Map();                      // rang dans le cluster → élément de plus au bout de la ligne

  const count = el('p', { class: 'cluster__compte', attrs: { role: 'status' } });
  const hint = el('p', { class: 'message message--attention', text: t('Cochez au moins un verset.'), attrs: { role: 'alert', hidden: true } });
  // Plus de plafond : c'est au visiteur de mesurer ce qu'il envoie. Au-delà de 30 versets, la page le dit.
  const large = el('p', {
    class: 'champ__aide',
    text: t('Au-delà de {n} versets, l’analyse est plus longue et plus coûteuse ; chaque message de suite renvoie aussi ces versets.', { n: LARGE_SELECTION }),
    attrs: { hidden: true },
  });
  // Pour l'auteur seul (mode développeur, texte non traduit) : le corpus refuse une saisie trop longue
  const limit = el('p', { class: 'message message--attention', attrs: { hidden: true, lang: 'fr', dir: 'ltr' } });
  const list = el('ul', { class: 'cluster__liste' });
  const more = el('button', { class: 'bouton-lien cluster__suite', text: t('Afficher la suite'), attrs: { type: 'button', hidden: true } });
  const all = el('button', { class: 'bouton-lien cluster__outil', text: t('Tout sélectionner'), attrs: { type: 'button' } });
  const none = el('button', { class: 'bouton-lien cluster__outil', text: t('Tout désélectionner'), attrs: { type: 'button' } });

  function paint() {
    const { chosen, total } = probe.selection();
    count.textContent = t('Versets cochés : {n} sur {total}', { n: chosen, total });
    if (chosen) hint.hidden = true;
    large.hidden = !largeSelection(chosen);
    // Ce qui partirait au moteur : c'est ce texte que le corpus garderait comme saisie
    const sent = devMode() ? probe.passage() : null;
    const text = sent ? clusterText(sent.primary, sent.constraint, sent.verses) : '';
    limit.hidden = !tooLongForCorpus(text);
    if (!limit.hidden) limit.textContent = `Mode développeur : cette sélection fait ${text.length} caractères. Au-delà de ${CORPUS_CELL_LIMIT}, le corpus refusera d’enregistrer l’analyse.`;
  }

  // Une ligne : toute la ligne est l'étiquette de sa case, un clic sur le verset le coche. La case prend
  // l'état que la sonde connaît au moment où la ligne est bâtie.
  function row(index, position) {
    const { reference: label, text } = clusterVerse(verses[index]);
    const box = el('input', { class: 'cluster__case', attrs: { type: 'checkbox', tabindex: position === cursor ? 0 : -1 } });
    box.checked = probe.isSelected(index);
    box.disabled = disabled;
    box.dataset.position = String(position);
    box.addEventListener('change', () => {
      probe.select(index, box.checked);
      paint();
    });
    boxes.set(index, box);
    const extra = rowExtra(index, verses[index]);
    if (extra) {
      extra.tabIndex = position === cursor ? 0 : -1;
      extras.set(index, extra);
    }
    return el('li', { class: 'cluster__ligne' },
      el('label', { class: 'cluster__verset' }, box,
        el('span', { class: 'cluster__contenu' },
          label ? el('span', { class: 'verset__ref', text: label }) : null,
          el('span', { class: 'cluster__texte', text, attrs: label ? { lang: 'ar', dir: 'rtl' } : { dir: 'auto' } }))),
      extra);
  }

  // Bâtit les lignes suivantes, jusqu'à la position voulue au moins
  function renderMore(upTo = rendered + SLICE - 1) {
    const end = Math.min(Math.max(upTo + 1, rendered), visible.length);
    for (let position = rendered; position < end; position += 1) add(list, row(visible[position], position));
    rendered = end;
    more.hidden = rendered >= visible.length;
  }

  function renderAll() {
    clear(list);
    boxes.clear();
    extras.clear();
    rendered = 0;
    cursor = 0;
    renderMore();
  }

  // Sous un filtre par sourate, seuls les versets affichés changent : ceux des autres sourates gardent
  // leur état, et rien de ce que le visiteur ne voit pas n'est coché à sa place.
  function setAll(on) {
    if (visible.length === verses.length) probe.selectAll(on);
    else if (on) probe.selectMany(visible);
    else for (const index of visible) probe.select(index, false);
    for (const box of boxes.values()) box.checked = on;
    paint();
  }

  // La ligne du curseur est la seule dont la case, et le lien s'il y en a un, sont atteignables par Tab
  function setReach(position, on) {
    const index = visible[position];
    if (boxes.has(index)) boxes.get(index).tabIndex = on ? 0 : -1;
    if (extras.has(index)) extras.get(index).tabIndex = on ? 0 : -1;
  }

  function moveCursor(position) {
    renderMore(position);
    setReach(cursor, false);
    cursor = position;
    setReach(cursor, true);
    const box = boxes.get(visible[cursor]);
    if (box) box.focus();
  }

  list.addEventListener('keydown', (event) => {
    const box = event.target;
    if (!box.classList || !box.classList.contains('cluster__case')) return;
    // Entrée coche ou décoche : sans cela, la touche lancerait l'analyse (un formulaire part sur Entrée),
    // donc une demande facturée pour une sélection à moitié faite.
    if (event.key === 'Enter') {
      event.preventDefault();
      box.click();
      return;
    }
    // Alt+←, Cmd+↑, Ctrl+Fin… : ces touches sont celles du navigateur
    if (hasModifier(event)) return;
    const next = nextIndex(Number(box.dataset.position), event.key, visible.length);
    if (next === null) return;
    event.preventDefault();
    moveCursor(next);
  });
  // Un clic sur une case en fait la case atteignable par Tab
  list.addEventListener('focusin', (event) => {
    const box = event.target;
    if (!box.classList || !box.classList.contains('cluster__case')) return;
    const position = Number(box.dataset.position);
    if (position !== cursor) setReach(cursor, false);
    cursor = position;
    setReach(cursor, true);
  });

  all.addEventListener('click', () => setAll(true));
  none.addEventListener('click', () => setAll(false));
  more.addEventListener('click', () => renderMore());

  // Les lignes suivantes arrivent quand le bas de la liste approche ; le bouton reste là en secours
  if (typeof IntersectionObserver === 'function') {
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting) || rendered >= visible.length) return;
      renderMore();
      // Si le bas de la liste est encore en vue après cette tranche, l'observation repart : elle ne
      // prévient qu'aux changements
      observer.unobserve(more);
      observer.observe(more);
    }, { rootMargin: '300px' });
    observer.observe(more);
  }

  fill(container,
    el('div', { class: 'cluster__barre' }, count, el('div', { class: 'cluster__outils' }, all, none)),
    hint,
    large,
    limit,
    el('div', { class: 'cluster', attrs: { role: 'group', 'aria-label': t('Versets du cluster') } }, list, more));
  renderAll();
  paint();

  return {
    // Le compteur et les avertissements, après un changement venu d'ailleurs (mode développeur)
    paint,

    // Les cases affichées reprennent l'état que la sonde connaît (sélection reportée d'une autre page)
    refresh() {
      for (const [index, box] of boxes) box.checked = probe.isSelected(index);
      paint();
    },

    // « Analyser » sans case cochée : la page le dit
    showHint() {
      hint.hidden = false;
    },

    // Le curseur va sur un bouton visible, au-dessus de la liste : une case pourrait être hors de vue
    focusTools() {
      all.focus();
    },

    // N'affiche que ces rangs (filtre par sourate) ; null : tout le cluster. La sélection ne change pas.
    setVisible(indexes) {
      visible = Array.isArray(indexes) ? indexes.filter((index) => Number.isInteger(index) && index >= 0 && index < verses.length) : verses.map((_, index) => index);
      renderAll();
    },

    // Pendant une analyse, la liste est verrouillée comme le formulaire
    setDisabled(value) {
      disabled = Boolean(value);
      for (const box of boxes.values()) box.disabled = disabled;
      all.disabled = disabled;
      none.disabled = disabled;
    },
  };
}
