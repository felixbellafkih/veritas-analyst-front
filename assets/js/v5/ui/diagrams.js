// Les deux schémas de la Bibliothèque, dessinés par le site : des blocs et des flèches, comme la chaîne du
// Séquenceur. Ils suivent les thèmes et reviennent à la ligne au bord de l'écran : aucun défilement de côté.
// - Les libellés sont ceux de l'app, non traduits : chaque schéma est marqué en français, de gauche à droite,
//   quelle que soit la langue de la page.
// - Une flèche est un dessin (aria-hidden) ; son libellé, lui, est lu par les lecteurs d'écran.
// - La carte de gouvernance sert de sélecteur : chaque groupe est un bouton, qui ouvre son volet.
import { add, el, fill } from './dom.js';

const FRENCH = { lang: 'fr', dir: 'ltr' };

// Architecture d'exécution : flow = {steps: [{title, text, tone}], links: string[]} (lib/library-diagrams.js).
// Une étape et la flèche qui en part restent ensemble quand la ligne se coupe.
export function mountFlow(container, flow) {
  const steps = flow.steps || [];
  const links = flow.links || [];
  const list = el('ol', { class: 'flux', attrs: FRENCH });
  steps.forEach((step, index) => {
    const block = el('div', { class: step.tone ? `flux__bloc flux__bloc--${step.tone}` : 'flux__bloc' },
      el('span', { class: 'flux__titre', text: step.title }),
      step.text ? el('span', { class: 'flux__texte', text: step.text }) : null);
    const link = index < steps.length - 1
      ? el('span', { class: 'flux__lien' },
        links[index] ? el('span', { class: 'flux__libelle', text: links[index] }) : null,
        el('span', { class: 'flux__fleche', attrs: { 'aria-hidden': 'true' } }))
      : null;
    add(list, el('li', { class: 'flux__etape' }, block, link));
  });
  fill(container, list);
}

const itemParts = (item) => [
  el('span', { class: 'carte-gouv__titre', text: item.title }),
  item.text ? el('span', { class: 'carte-gouv__texte', text: item.text }) : null,
];

// Carte de gouvernance : map = {kernel: {title, text}, groups: [{id, label, items: [{title, text, href?}]}]}.
// selected : l'identifiant du groupe ouvert ; onSelect(id) : appelé quand le visiteur choisit un groupe.
// Rend {select(id)} : presse un groupe sans rien demander (retour dans l'historique, par exemple).
export function mountGovernanceMap(container, { map, selected, onSelect }) {
  const buttons = new Map();
  const press = (id) => {
    if (!buttons.has(id)) return;
    for (const [key, button] of buttons) button.setAttribute('aria-pressed', key === id ? 'true' : 'false');
  };

  const groups = (map.groups || []).map((group) => {
    // Un bouton ne peut pas porter de lien : les éléments qui mènent à une page restent hors du bouton
    const plain = group.items.filter((item) => !item.href);
    const linked = group.items.filter((item) => item.href);
    const button = el('button', {
      class: 'carte-gouv__choix',
      attrs: { type: 'button', 'aria-pressed': 'false' },
      on: { click: () => { press(group.id); onSelect(group.id); } },
    },
    el('span', { class: 'carte-gouv__nom', text: group.label }),
    plain.map((item) => el('span', { class: 'carte-gouv__element' }, itemParts(item))));
    buttons.set(group.id, button);
    const links = linked.length
      ? el('ul', { class: 'carte-gouv__liens' },
        linked.map((item) => el('li', {}, el('a', { class: 'carte-gouv__element carte-gouv__element--lien', attrs: { href: item.href } }, itemParts(item)))))
      : null;
    return el('li', { class: `carte-gouv__groupe carte-gouv__groupe--${group.id}` }, button, links);
  });

  fill(container, el('div', { class: 'carte-gouv', attrs: FRENCH },
    el('div', { class: 'carte-gouv__noyau' },
      el('span', { class: 'carte-gouv__noyau-titre', text: map.kernel.title }),
      el('span', { class: 'carte-gouv__noyau-texte', text: map.kernel.text })),
    el('span', { class: 'carte-gouv__tronc', attrs: { 'aria-hidden': 'true' } }),
    el('ul', { class: 'carte-gouv__groupes' }, groups)));
  press(selected);
  return { select: press };
}
