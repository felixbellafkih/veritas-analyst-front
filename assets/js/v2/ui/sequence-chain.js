// Chaîne de cartes du Séquenceur : une carte par élément de la séquence, dans l'ordre reçu, chacune reliée
// à la suivante. La chaîne revient à la ligne au bord de l'écran : aucun défilement de côté.
// - Chaque élément rendu par l'API a sa carte : aucun mot ne disparaît.
// - Tout ce qui vient de l'API (le mot, les étiquettes) s'écrit comme du texte, jamais comme du balisage :
//   l'API renvoie la saisie du visiteur telle quelle.
// - Les étiquettes techniques restent telles que l'API les rend, de gauche à droite, non traduites.
// - Les couleurs sont celles des thèmes du site (assets/css/sequenceur.css).
// - Une longue chaîne s'affiche par tranches, pour rester fluide sur téléphone.
import { scannerHref } from '../lib/roots-index.js';
import { add, el, fill } from './dom.js';
import { t } from './i18n-dom.js';

const SLICE = 120; // cartes affichées d'un coup ; les suivantes arrivent quand le bas de la chaîne approche
const KIND_CLASS = { variable: 'variable', operator: 'operateur', unknown: 'inconnu', other: 'autre' };
const LINK_CLASS = { solid: 'plein', dashed: 'pointille', plain: 'simple' };

// Une étiquette (GLOBAL_ADDRESS_SPACE // STACK_LAYER) ne se coupe en fin de ligne qu'après « _ » ou « // »
function breakable(text) {
  const nodes = [];
  for (const part of text.split(/(_|\/\/)/)) {
    if (!part) continue;
    nodes.push(part);
    if (part === '_' || part === '//') nodes.push(el('wbr'));
  }
  return nodes;
}

const label = (className, text) => (text ? el('span', { class: className, attrs: { dir: 'ltr' } }, breakable(text)) : null);

const group = (title, lines) => el('div', { class: 'carte-mot__groupe' },
  el('span', { class: 'carte-mot__titre', text: title }),
  lines.map((line) => el('span', { class: 'carte-mot__ligne', text: line, attrs: { dir: 'ltr' } })));

// Connecteurs, pointeurs et quantificateurs : seulement quand l'API en rend. Mêmes libellés que le Scanner.
function extras(element) {
  const wiring = [...element.inputs.map((line) => `IN : ${line}`), ...element.outputs.map((line) => `OUT : ${line}`)];
  const groups = [];
  if (wiring.length) groups.push(group(t('CONNECTIQUE (I/O)'), wiring));
  if (element.quantifiers.length) groups.push(group(t('QUANTIFICATEURS'), element.quantifiers));
  return groups.length ? el('div', { class: 'carte-mot__plus' }, groups) : null;
}

function card(element, rank) {
  const kind = KIND_CLASS[element.kind] || KIND_CLASS.other;
  const body = [
    el('span', { class: 'carte-mot__rang', text: rank }),
    el('span', { class: 'carte-mot__mot', text: element.arabic, attrs: { lang: 'ar', dir: 'rtl' } }),
  ];
  if (element.kind === 'variable') {
    body.push(
      el('a', { class: 'carte-mot__racine', text: element.root, attrs: { href: scannerHref(element.root), dir: 'ltr' } }),
      label('carte-mot__etat', element.state),
      label('carte-mot__fonction', element.func),
      extras(element));
  } else if (element.kind === 'unknown') {
    // Libellé du graphe de l'app actuelle pour un mot sans racine dans le LEXICON
    body.push(el('span', { class: 'carte-mot__alerte', text: t('UNMAPPED ROOT') }), label('carte-mot__etat', element.state), extras(element));
  } else {
    body.push(label('carte-mot__etiquette', element.label));
  }
  const link = LINK_CLASS[element.link];
  return el('li', { class: `chaine__maillon chaine__maillon--${kind}${link ? ` chaine__maillon--${link}` : ''}` },
    // Le trait qui arrive à la carte : plein vers une variable, pointillé vers un opérateur. Décoratif.
    link ? el('span', { class: 'chaine__trait', attrs: { 'aria-hidden': 'true' } }) : null,
    el('div', { class: `carte-mot carte-mot--${kind}` }, body));
}

// elements : les éléments de lib/sequence.js (parseSequence) ; slice : taille d'une tranche
export function mountSequenceChain(container, { elements, slice = SLICE }) {
  let rendered = 0;
  const list = el('ol', { class: 'chaine' });
  const more = el('button', { class: 'bouton-lien chaine__suite', text: t('Afficher la suite'), attrs: { type: 'button', hidden: true } });

  function renderMore() {
    const end = Math.min(rendered + slice, elements.length);
    for (let index = rendered; index < end; index += 1) add(list, card(elements[index], index + 1));
    rendered = end;
    more.hidden = rendered >= elements.length;
  }

  more.addEventListener('click', renderMore);
  // Les cartes suivantes arrivent quand le bas de la chaîne approche ; le bouton reste là en secours
  if (typeof IntersectionObserver === 'function') {
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting) || rendered >= elements.length) return;
      renderMore();
      // Si le bas est encore en vue après cette tranche, l'observation repart : elle ne prévient qu'aux changements
      observer.unobserve(more);
      observer.observe(more);
    }, { rootMargin: '300px' });
    observer.observe(more);
  }

  fill(container, list, more);
  renderMore();
}
