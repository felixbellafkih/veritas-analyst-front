// Les deux schémas de la Bibliothèque (lib/library-diagrams.js, ui/diagrams.js), montés sur un faux DOM :
// l'architecture d'exécution du manifeste et la carte de gouvernance, qui sert de sélecteur de ses volets.
// Les libellés sont ceux de l'app, tels quels, non traduits.
// Ce que le faux DOM ne montre pas : la mise en page, le retour à la ligne, les couleurs des thèmes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './aides/faux-dom.mjs';

const dom = installFakeDom();
const { EXECUTION_FLOW, GOVERNANCE_MAP } = await import('../../assets/js/v3/lib/library-diagrams.js');
const { GOVERNANCE_PANELS } = await import('../../assets/js/v3/lib/library.js');
const { mountFlow, mountGovernanceMap } = await import('../../assets/js/v3/ui/diagrams.js');

const texts = (nodes) => nodes.map((node) => node.textContent);
const tagged = (node, tag) => node.find((child) => child.tagName === tag);

test('les constantes : six étapes, cinq flèches, quatre groupes de 3, 1, 5 et 3 éléments', () => {
  assert.deepEqual(EXECUTION_FLOW.steps.map((step) => step.title), ['INPUT', 'ISOLATION', 'NOYAU VERITAS', 'PHASE 1', 'PHASE 2 & 3', 'PHASE 4']);
  assert.deepEqual(EXECUTION_FLOW.steps.map((step) => step.text), [
    '(Verset Coranique)', '(Neutralisation Affixes)', '(Lookup JSON)', 'Tableau Matrice', 'Analyse Logique & Littéraire', 'Rupture de Consensus',
  ]);
  assert.deepEqual(EXECUTION_FLOW.steps.map((step) => step.tone), ['entree', '', 'noyau', '', '', 'alerte']);
  assert.deepEqual(EXECUTION_FLOW.links, ['Signal Brut', 'Extraction Racines', 'Fetch Définitions', 'Séquençage', 'Confrontation']);
  assert.deepEqual(GOVERNANCE_MAP.kernel, { title: 'VERITAS-KERNEL', text: '[v26.03.12-Stable]' });
  assert.deepEqual(GOVERNANCE_MAP.groups.map((group) => group.id), ['1', '2', '3', '4']);
  assert.deepEqual(GOVERNANCE_MAP.groups.map((group) => group.items.length), [3, 1, 5, 3]);
  assert.deepEqual(GOVERNANCE_MAP.groups[0].items.map((item) => item.title), ['Justice Structurelle', 'Référence Source', 'Audit [DOXA]']);
  assert.deepEqual(GOVERNANCE_MAP.groups[1].items, [{ title: 'Emphatiques (Signal Isolator)', text: 'A. / H. / S. / D. / T. / Z.' }]);
  assert.deepEqual(GOVERNANCE_MAP.groups[2].items.map((item) => `${item.title} ${item.text}`), [
    'CPU Logic Unit (Arbitrage)', 'RAM Storage Unit (Mémoire)', 'IO Sensors Unit (Capteurs)', 'Network Comm Unit (Transmission)', 'Security Firewall (Isolation)',
  ]);
  assert.deepEqual(GOVERNANCE_MAP.groups[3].items, [
    { title: 'Verse Interpreter', text: '(Décompilation IA)', href: '/interpreteur/' },
    { title: 'Logic Sequencer', text: '(Graphe Causal)', href: '/sequenceur/' },
    { title: 'Root Scanner', text: '(Inspection Matérielle)', href: '/scanner/' },
  ]);
});

test('les groupes de la carte portent le nom des volets', () => {
  assert.deepEqual(GOVERNANCE_MAP.groups.map((group) => [group.id, group.label]), GOVERNANCE_PANELS.map((panel) => [panel.id, panel.label]));
});

test('aucun lien de la carte ne sort du site ni ne mène ailleurs qu’à une page d’outil', () => {
  const hrefs = GOVERNANCE_MAP.groups.flatMap((group) => group.items.map((item) => item.href).filter(Boolean));
  assert.deepEqual(hrefs, ['/interpreteur/', '/sequenceur/', '/scanner/']);
});

test('architecture d’exécution : six blocs dans l’ordre, cinq flèches avec leur libellé', () => {
  const container = dom.node();
  mountFlow(container, EXECUTION_FLOW);
  const list = tagged(container, 'OL');
  assert.equal(list.length, 1);
  assert.equal(list[0].getAttribute('lang'), 'fr');
  assert.equal(list[0].getAttribute('dir'), 'ltr');
  assert.equal(tagged(list[0], 'LI').length, 6);
  assert.deepEqual(texts(container.byClass('flux__titre')), EXECUTION_FLOW.steps.map((step) => step.title));
  assert.deepEqual(texts(container.byClass('flux__texte')), EXECUTION_FLOW.steps.map((step) => step.text));
  assert.deepEqual(texts(container.byClass('flux__libelle')), EXECUTION_FLOW.links);
  // la flèche est un dessin : les lecteurs d'écran lisent le libellé, pas elle
  const arrows = container.byClass('flux__fleche');
  assert.equal(arrows.length, 5);
  for (const arrow of arrows) assert.equal(arrow.getAttribute('aria-hidden'), 'true');
});

test('architecture d’exécution : le dernier bloc n’a pas de flèche, les blocs marqués ont leur teinte', () => {
  const container = dom.node();
  mountFlow(container, EXECUTION_FLOW);
  const steps = container.byClass('flux__etape');
  assert.equal(steps[5].byClass('flux__lien').length, 0);
  for (const step of steps.slice(0, 5)) assert.equal(step.byClass('flux__lien').length, 1);
  const blocks = container.byClass('flux__bloc');
  assert.ok(blocks[0].classList.contains('flux__bloc--entree'));
  assert.ok(blocks[2].classList.contains('flux__bloc--noyau'));
  assert.ok(blocks[5].classList.contains('flux__bloc--alerte'));
  assert.equal(blocks[1].className.trim(), 'flux__bloc');
});

test('un schéma vide ou incomplet ne casse rien', () => {
  const container = dom.node();
  mountFlow(container, { steps: [{ title: 'SEUL', text: '', tone: '' }], links: [] });
  assert.deepEqual(texts(container.byClass('flux__titre')), ['SEUL']);
  assert.equal(container.byClass('flux__texte').length, 0);
  assert.equal(container.byClass('flux__lien').length, 0);
  // une flèche sans libellé reste une flèche
  mountFlow(container, { steps: [{ title: 'A' }, { title: 'B' }], links: [] });
  assert.equal(container.byClass('flux__etape').length, 2);
  assert.equal(container.byClass('flux__fleche').length, 1);
  assert.equal(container.byClass('flux__libelle').length, 0);
});

function mountedMap(selected = '1') {
  const container = dom.node();
  const asked = [];
  const map = mountGovernanceMap(container, { map: GOVERNANCE_MAP, selected, onSelect: (id) => asked.push(id) });
  const buttons = () => tagged(container, 'BUTTON');
  return { container, asked, map, buttons, pressed: () => buttons().map((button) => button.getAttribute('aria-pressed')) };
}

test('carte de gouvernance : le noyau, puis un bouton par groupe, un seul pressé', () => {
  const { container, buttons, pressed } = mountedMap();
  const root = container.byClass('carte-gouv')[0];
  assert.equal(root.getAttribute('lang'), 'fr');
  assert.equal(root.getAttribute('dir'), 'ltr');
  assert.deepEqual(texts(container.byClass('carte-gouv__noyau-titre')), ['VERITAS-KERNEL']);
  assert.deepEqual(texts(container.byClass('carte-gouv__noyau-texte')), ['[v26.03.12-Stable]']);
  assert.equal(buttons().length, 4);
  for (const button of buttons()) assert.equal(button.getAttribute('type'), 'button');
  assert.deepEqual(texts(container.byClass('carte-gouv__nom')), GOVERNANCE_MAP.groups.map((group) => group.label));
  assert.deepEqual(pressed(), ['true', 'false', 'false', 'false']);
});

test('carte de gouvernance : chaque groupe porte ses éléments, dans l’ordre de l’app', () => {
  const { container } = mountedMap();
  const groups = container.byClass('carte-gouv__groupe');
  assert.equal(groups.length, 4);
  groups.forEach((group, index) => {
    assert.deepEqual(texts(group.byClass('carte-gouv__titre')), GOVERNANCE_MAP.groups[index].items.map((item) => item.title));
    assert.deepEqual(texts(group.byClass('carte-gouv__texte')), GOVERNANCE_MAP.groups[index].items.map((item) => item.text).filter(Boolean));
  });
});

test('carte de gouvernance : un clic sur le troisième groupe le demande et le presse', () => {
  const { asked, buttons, pressed } = mountedMap();
  buttons()[2].click();
  assert.deepEqual(asked, ['3']);
  assert.deepEqual(pressed(), ['false', 'false', 'true', 'false']);
  buttons()[2].click(); // un second clic ne le relâche pas : un volet reste toujours ouvert
  assert.deepEqual(asked, ['3', '3']);
  assert.deepEqual(pressed(), ['false', 'false', 'true', 'false']);
});

test('carte de gouvernance : select() presse un groupe sans rien demander, une valeur inconnue ne change rien', () => {
  const { asked, map, pressed } = mountedMap('2');
  assert.deepEqual(pressed(), ['false', 'true', 'false', 'false']);
  map.select('4');
  assert.deepEqual(pressed(), ['false', 'false', 'false', 'true']);
  map.select('9');
  assert.deepEqual(pressed(), ['false', 'false', 'false', 'true']);
  assert.deepEqual(asked, []);
});

test('carte de gouvernance : trois liens, dans le groupe 4, hors du bouton', () => {
  const { container, buttons } = mountedMap();
  const links = tagged(container, 'A');
  assert.deepEqual(links.map((link) => link.getAttribute('href')), ['/interpreteur/', '/sequenceur/', '/scanner/']);
  const groups = container.byClass('carte-gouv__groupe');
  assert.equal(tagged(groups[3], 'A').length, 3);
  for (const group of groups.slice(0, 3)) assert.equal(tagged(group, 'A').length, 0);
  for (const button of buttons()) assert.equal(tagged(button, 'A').length, 0);
  // le bouton du groupe 4 garde son nom : il reste le moyen d'ouvrir le volet
  assert.equal(buttons()[3].byClass('carte-gouv__nom').length, 1);
});
