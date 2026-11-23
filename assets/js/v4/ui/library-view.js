// Vue de la Bibliothèque : trois onglets (manifeste, thèse, gouvernance).
// - Le manifeste est le balisage de la page : la vue ne fait que le montrer ou le cacher.
// - La thèse et les volets de gouvernance viennent des fichiers de contenu du site, chargés à la première
//   ouverture seulement : le fichier de la langue de l'interface d'abord, le français quand un texte y manque.
// - Un texte servi en français dans une autre langue le dit d'une ligne, et porte la langue et le sens
//   d'écriture du français.
// - Tout contenu passe par le rendu sûr du site (lib/markdown.js, ui/markdown-view.js) : rien n'y est lu
//   comme du balisage.
// - Un chargement en échec affiche un message et « Réessayer » ; le manifeste et les onglets restent utilisables.
import { htmlLang, isRtl } from '../lib/i18n.js';
import { GOVERNANCE_PANELS, LIBRARY_DOCS, THESIS_CHAPTERS, chapterNeighbours, pickText } from '../lib/library.js';
import { GOVERNANCE_MAP } from '../lib/library-diagrams.js';
import { parseMarkdown } from '../lib/markdown.js';
import { hasModifier, nextIndex } from '../lib/roving.js';
import { mountGovernanceMap } from './diagrams.js';
import { add, el, fill } from './dom.js';
import { t, td } from './i18n-dom.js';
import { renderBlocks } from './markdown-view.js';

// Une rangée d'onglets : un seul arrêt de la touche Tab, les flèches de côté, Début et Fin passent d'un onglet
// à l'autre et l'ouvrent. items : [{id, label, controls}] ; onSelect(id) : le visiteur a choisi cet onglet.
function tabRow({ className, label, prefix, items, onSelect }) {
  const buttons = items.map((item) => {
    const button = el('button', {
      class: 'onglets-doc__onglet',
      text: item.label,
      attrs: { type: 'button', role: 'tab', id: `${prefix}-${item.id}`, 'aria-selected': 'false', 'aria-controls': item.controls },
      on: { click: () => onSelect(item.id) },
    });
    button.dataset.cible = item.id;
    button.tabIndex = -1;
    return button;
  });

  // Les flèches de côté suivent le sens de la page ; celles du haut et du bas restent au défilement
  function onKey(event) {
    if (hasModifier(event)) return;
    const rtl = document.documentElement.dir === 'rtl';
    const key = { ArrowRight: rtl ? 'ArrowUp' : 'ArrowDown', ArrowLeft: rtl ? 'ArrowDown' : 'ArrowUp', Home: 'Home', End: 'End' }[event.key];
    const next = key ? nextIndex(buttons.indexOf(event.target), key, buttons.length) : null;
    if (next === null) return;
    event.preventDefault();
    buttons[next].focus();
    onSelect(items[next].id);
  }

  const node = el('div', { class: className, attrs: { role: 'tablist', 'aria-label': label }, on: { keydown: onKey } }, buttons);
  const button = (id) => buttons[items.findIndex((item) => item.id === id)];
  return {
    node,
    idOf: (id) => `${prefix}-${id}`,
    select(id) {
      buttons.forEach((each, index) => {
        const chosen = items[index].id === id;
        each.setAttribute('aria-selected', chosen ? 'true' : 'false');
        each.tabIndex = chosen ? 0 : -1;
      });
    },
    focus(id) {
      if (button(id)) button(id).focus();
    },
  };
}

// container : l'élément de la page qui porte le manifeste ; la vue y pose ses onglets et ses deux autres panneaux.
// manifesto : le manifeste écrit dans la page. load(code) : le contenu d'une langue, ou null en cas d'échec.
// lang : la langue de l'interface. onNavigate({doc, chapter, panel}) : le visiteur a changé d'onglet, de
// chapitre ou de volet. Rend {show({doc, chapter, panel})} : ouvre ce que l'adresse désigne, sans rien demander.
export function mountLibraryView(container, { manifesto, load, lang, onNavigate }) {
  const state = { doc: LIBRARY_DOCS[0], chapter: THESIS_CHAPTERS[0].id, panel: GOVERNANCE_PANELS[0].id };
  const french = lang === 'fr';

  // ---- les fichiers de contenu : chargés une fois ; un échec n'est pas gardé, pour que « Réessayer » relance
  const files = new Map();
  const pending = new Map();
  function file(code) {
    if (files.has(code)) return Promise.resolve(files.get(code));
    if (!pending.has(code)) {
      pending.set(code, Promise.resolve().then(() => load(code)).then((content) => content ?? null, () => null).then((content) => {
        pending.delete(code);
        if (content) files.set(code, content);
        return content;
      }));
    }
    return pending.get(code);
  }

  // Le texte d'un chapitre ou d'un volet : {text, french} ; null quand rien ne peut s'afficher
  async function pick(kind, id) {
    if (french) return pickText(null, await file('fr'), kind, id);
    const local = await file(lang);
    if (!local) return null;
    return pickText(local, null, kind, id) || pickText(local, await file('fr'), kind, id);
  }

  // ---- une zone de lecture : l'état (chargement, échec), la ligne sur la langue, le texte
  function reader() {
    const status = el('div', { class: 'biblio__etat' });
    const note = el('p', { class: 'biblio__langue discret', text: t('Ce texte n’est pas encore traduit dans cette langue : il est affiché en français.'), attrs: { hidden: true } });
    // tabindex -1 : le texte peut recevoir le curseur, sans être un arrêt de la touche Tab
    const body = el('div', { class: 'biblio__texte analyse__corps', attrs: { tabindex: -1 } });
    return { status, note, body, turn: 0, shown: null };
  }

  async function display(zone, kind, id) {
    if (zone.shown === id) return;
    zone.shown = null;
    zone.turn += 1;
    const { turn } = zone;
    zone.note.hidden = true;
    fill(zone.body);
    fill(zone.status, el('p', { class: 'discret', text: t('Chargement du texte…'), attrs: { role: 'status' } }));
    const picked = await pick(kind, id);
    if (turn !== zone.turn) return; // une autre demande est passée devant
    if (!picked) {
      fill(zone.status, el('div', { class: 'message message--erreur', attrs: { role: 'alert' } },
        el('p', { class: 'message__titre', text: t('Ce texte n’a pas pu être chargé.') }),
        el('div', { class: 'message__actions' },
          el('button', { class: 'bouton-bord', text: t('Réessayer'), attrs: { type: 'button' }, on: { click: () => display(zone, kind, id) } }))));
      return;
    }
    const inFrench = french || picked.french;
    zone.body.setAttribute('lang', inFrench ? 'fr' : htmlLang(lang));
    zone.body.setAttribute('dir', !inFrench && isRtl(lang) ? 'rtl' : 'ltr');
    zone.note.hidden = !picked.french;
    fill(zone.status);
    fill(zone.body, renderBlocks(parseMarkdown(picked.text), { ids: false, tableLabel: t('Tableau') }));
    zone.shown = id;
  }

  // ---- onglets des trois lectures
  const PANEL_IDS = { manifeste: 'panneau-manifeste', these: 'panneau-these', gouvernance: 'panneau-gouvernance' };
  const docs = tabRow({
    className: 'onglets-doc',
    label: t('Bibliothèque'),
    prefix: 'onglet',
    items: [
      { id: 'manifeste', label: t('Manifeste'), controls: PANEL_IDS.manifeste },
      { id: 'these', label: t('Thèse'), controls: PANEL_IDS.these },
      { id: 'gouvernance', label: t('Gouvernance'), controls: PANEL_IDS.gouvernance },
    ],
    onSelect: (doc) => go({ doc }),
  });

  const panelNode = (doc, ...children) => {
    const node = el('section', { class: 'biblio__panneau', attrs: { id: PANEL_IDS[doc], role: 'tabpanel', 'aria-labelledby': docs.idOf(doc), hidden: true } }, children);
    node.dataset.panneau = doc;
    return node;
  };

  // ---- thèse : ses quatre chapitres, puis le chapitre d'avant et celui d'après
  const thesis = reader();
  const chapters = tabRow({
    className: 'onglets-doc onglets-doc--chapitres',
    label: t('Thèse'),
    prefix: 'chapitre',
    items: THESIS_CHAPTERS.map((chapter) => ({ id: chapter.id, label: td(chapter.label), controls: 'lecture-these' })),
    onSelect: (chapter) => go({ chapter }),
  });
  thesis.body.setAttribute('id', 'lecture-these');
  const step = (className, label) => {
    const name = el('span', { class: 'biblio__pas-nom' });
    const button = el('button', { class: `biblio__pas ${className}`, attrs: { type: 'button', hidden: true } },
      el('span', { class: 'biblio__pas-sens', text: label }), name);
    return { button, name, target: null };
  };
  const previous = step('biblio__pas--avant', t('Chapitre précédent'));
  const next = step('biblio__pas--apres', t('Chapitre suivant'));
  for (const move of [previous, next]) {
    move.button.addEventListener('click', () => {
      if (!move.target) return;
      go({ chapter: move.target });
      chapters.focus(state.chapter); // le curseur remonte au chapitre ouvert, et la page avec lui
    });
  }
  function paintSteps() {
    const neighbours = chapterNeighbours(state.chapter);
    for (const [move, id] of [[previous, neighbours.previous], [next, neighbours.next]]) {
      const chapter = THESIS_CHAPTERS.find((each) => each.id === id);
      move.target = chapter ? chapter.id : null;
      move.name.textContent = chapter ? td(chapter.label) : '';
      move.button.hidden = !chapter;
    }
  }
  const thesisPanel = panelNode('these',
    el('h2', { class: 'biblio__titre', text: t("VERITAS KERNEL : L'Architecture") }),
    el('p', { class: 'biblio__intro', text: t("Documentation complète du noyau théorique et de la méthode d'ingénierie inverse.") }),
    chapters.node, thesis.status, thesis.note, thesis.body,
    el('nav', { class: 'biblio__suite', attrs: { 'aria-label': t('Thèse') } }, previous.button, next.button));

  // ---- gouvernance : la carte, qui sert de sélecteur, puis le volet choisi
  const governance = reader();
  const mapNode = el('div', { class: 'biblio__carte' });
  const map = mountGovernanceMap(mapNode, { map: GOVERNANCE_MAP, selected: state.panel, onSelect: (panel) => go({ panel }) });
  const panelTitle = el('h3', { class: 'biblio__volet-titre' });
  const governancePanel = panelNode('gouvernance',
    el('h2', { class: 'biblio__titre', text: t('GOVERNANCE MAP') }),
    el('p', { class: 'biblio__intro', text: t("Cartographie systémique de l'architecture Veritas-Kernel et de ses unités opératoires.") }),
    mapNode,
    el('h2', { class: 'biblio__titre biblio__titre--volet', text: t("TERMINAL D'INSPECTION SYSTÉMIQUE") }),
    panelTitle, governance.status, governance.note, governance.body);

  // ---- le manifeste de la page devient le premier panneau
  manifesto.setAttribute('id', PANEL_IDS.manifeste);
  manifesto.setAttribute('role', 'tabpanel');
  manifesto.setAttribute('aria-labelledby', docs.idOf('manifeste'));
  manifesto.dataset.panneau = 'manifeste';
  fill(container, docs.node, manifesto, thesisPanel, governancePanel);

  function paint() {
    docs.select(state.doc);
    chapters.select(state.chapter);
    map.select(state.panel);
    manifesto.hidden = state.doc !== 'manifeste';
    thesisPanel.hidden = state.doc !== 'these';
    governancePanel.hidden = state.doc !== 'gouvernance';
    if (state.doc === 'these') {
      paintSteps();
      display(thesis, 'these', state.chapter);
    }
    if (state.doc === 'gouvernance') {
      const panel = GOVERNANCE_PANELS.find((each) => each.id === state.panel);
      panelTitle.textContent = panel ? td(panel.title) : '';
      display(governance, 'gouvernance', state.panel);
    }
  }

  // Un choix du visiteur : la vue change, puis la page met l'adresse à jour
  function go(change) {
    Object.assign(state, change);
    paint();
    onNavigate({ ...state });
  }

  return {
    show(target) {
      Object.assign(state, { doc: target.doc, chapter: target.chapter, panel: target.panel });
      paint();
    },
  };
}
