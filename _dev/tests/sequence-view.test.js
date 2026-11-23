// Résultat du Séquenceur (ui/sequence-view.js), monté sur un faux DOM : un bloc par verset, la transcription,
// le journal. Un bloc déjà affiché n'est pas rebâti quand un autre change.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { installFakeDom } from './aides/faux-dom.mjs';

const dom = installFakeDom();
const { mountSequenceView } = await import('../../assets/js/v5/ui/sequence-view.js');
const { parseSequence } = await import('../../assets/js/v5/lib/sequence.js');
const { ApiFailure } = await import('../../assets/js/v5/lib/failures.js');
const { interpreterHref } = await import('../../assets/js/v5/lib/verses.js');

const file = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const SEQ = JSON.parse(file('../fixtures/sequences.json'));
const stripAscii = (text) => text.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');
const V = Object.fromEntries(Object.entries(JSON.parse(file('../fixtures/versets.json'))).map(([reference, text]) => [reference, stripAscii(text)]));

const ready = (reference, key = V[reference]) => ({ reference, text: `texte ${reference}`, step: 'pret', sequence: parseSequence(SEQ[key]), failure: null });
const waiting = (reference, text = '') => ({ reference, text, step: 'attente', sequence: null, failure: null });
const failed = (reference, failure) => ({ reference, text: '', step: 'echec', sequence: null, failure });
const NETWORK = new ApiFailure('network', { detail: 'fetch failed' });
const MISSING = new ApiFailure('http', { status: 404, detail: 'Verse 2:1 not found in local database.' });

function verses(blocks, sura = 1) {
  return { mode: 'verset', passage: { sura, start: 1, end: blocks.length }, blocks, pending: blocks.filter((block) => block.step === 'attente').length };
}
const freeText = (block) => ({ mode: 'texte', passage: null, blocks: [block], pending: block.step === 'attente' ? 1 : 0 });

function mounted() {
  const retried = [];
  const container = dom.node();
  const view = mountSequenceView(container, { onRetry: (index) => retried.push(index), address: () => 'http://localhost/sequenceur/' });
  const texts = (name, root = container) => root.byClass(name).map((node) => node.textContent);
  return { container, view, retried, texts, blocks: () => container.byClass('bloc'), buttons: (root = container) => root.find((node) => node.tagName === 'BUTTON') };
}

test('sans rien à montrer : la zone de résultat reste vide', () => {
  const { container, view } = mounted();
  view.show({ mode: null, passage: null, blocks: [], pending: 0 });
  assert.equal(container.byClass('sequence__tete')[0].hidden, true);
  assert.equal(container.byClass('bloc').length, 0);
  assert.equal(container.byClass('sequence__transcription')[0].hidden, true);
  assert.equal(container.byClass('sequence__journal')[0].hidden, true);
});

test('un bloc par verset : une chaîne, une attente, un échec avec « Réessayer »', () => {
  const { view, blocks, texts, retried, buttons } = mounted();
  view.show(verses([ready('1:1'), waiting('1:2', 'texte 1:2'), failed('1:3', MISSING)]));
  assert.equal(blocks().length, 3);
  assert.deepEqual(blocks().map((block) => texts('verset__ref', block)[0]), ['1:1', '1:2', '1:3']);
  assert.equal(blocks()[0].byClass('chaine').length, 1);
  assert.equal(blocks()[0].byClass('chaine__maillon').length, 5);
  assert.equal(blocks()[1].byClass('chaine').length, 0);
  assert.deepEqual(texts('bloc__attente', blocks()[1]), ['Séquence en cours…']);
  assert.deepEqual(texts('message__titre', blocks()[2]), ['Passage introuvable.']);
  const retry = buttons(blocks()[2])[0];
  assert.equal(retry.textContent, 'Réessayer');
  retry.click();
  assert.deepEqual(retried, [2]);
});

test('le texte arabe de chaque verset, complet, de droite à gauche', () => {
  const { view, blocks } = mounted();
  view.show(verses([waiting('1:1'), waiting('1:2', 'ٱلْحَمْدُ لِلَّهِ')]));
  assert.equal(blocks()[0].byClass('bloc__texte')[0].hidden, true);
  const text = blocks()[1].byClass('bloc__texte')[0];
  assert.equal(text.hidden, false);
  assert.equal(text.textContent, 'ٱلْحَمْدُ لِلَّهِ');
  assert.deepEqual([text.attrs.lang, text.attrs.dir], ['ar', 'rtl']);
});

test('un bloc déjà affiché n’est pas rebâti quand un autre change', () => {
  const { view, container, blocks } = mounted();
  // Comme le déroulement réel : un bloc séquencé garde la même séquence d'une vue à l'autre
  const first = ready('1:1');
  view.show(verses([first, waiting('1:2'), waiting('1:3')]));
  const firstBlock = blocks()[0];
  const firstChain = container.byClass('chaine')[0];
  view.show(verses([{ ...first }, waiting('1:2', 'texte 1:2'), waiting('1:3')]));
  view.show(verses([{ ...first }, ready('1:2'), waiting('1:3')]));
  assert.equal(blocks()[0], firstBlock);
  assert.equal(container.byClass('chaine')[0], firstChain);
  assert.equal(container.byClass('chaine').length, 2);
  assert.equal(blocks()[1].byClass('bloc__attente').length, 0);
});

test('un autre passage : tous les blocs repartent de zéro', () => {
  const { view, container, blocks } = mounted();
  view.show(verses([ready('1:1'), ready('1:2')]));
  const old = container.byClass('chaine')[0];
  view.show(verses([waiting('112:1')], 112));
  assert.equal(blocks().length, 1);
  assert.equal(container.byClass('chaine').length, 0);
  view.show(verses([ready('112:1')], 112));
  assert.notEqual(container.byClass('chaine')[0], old);
});

test('en-tête : le nom du passage et les comptes, mis à jour à mesure', () => {
  const { view, texts, container } = mounted();
  view.show(verses([ready('1:1'), waiting('1:2')]));
  assert.equal(container.byClass('sequence__tete')[0].hidden, false);
  assert.deepEqual(texts('sequence__titre'), ['Al-Fatihah 1:1-2']);
  assert.deepEqual(texts('sequence__compte'), ['Éléments : 5', 'Variables : 4', 'Opérateurs : 1']);
  view.show(verses([ready('1:1'), ready('1:2')]));
  assert.deepEqual(texts('sequence__compte'), ['Éléments : 10', 'Variables : 8', 'Opérateurs : 2']);
});

test('texte libre : un bloc sans référence, les mots sans racine comptés', () => {
  const { view, texts, blocks, container } = mounted();
  view.show(freeText({ ...ready(null, 'hello world'), text: 'hello world' }));
  assert.deepEqual(texts('sequence__titre'), ['Texte libre']);
  assert.equal(blocks().length, 1);
  assert.equal(blocks()[0].byClass('verset__ref').length, 0);
  const text = blocks()[0].byClass('bloc__texte')[0];
  assert.equal(text.textContent, 'hello world');
  assert.equal(text.attrs.dir, 'auto');
  assert.deepEqual(texts('sequence__compte'), ['Éléments : 2', 'Variables : 0', 'Opérateurs : 0', 'Sans racine connue : 2']);
  // ni adresse à copier ni lien vers l'Interpréteur : ils ne valent que pour un passage de versets
  assert.equal(container.byClass('sequence__vers')[0].hidden, true);
  assert.equal(container.byClass('sequence__adresse')[0].hidden, true);
});

test('versets : le lien vers l’Interpréteur ouvre le même passage', () => {
  const { view, container } = mounted();
  view.show(verses([ready('1:1'), ready('1:2')]));
  const link = container.byClass('sequence__vers')[0];
  assert.equal(link.hidden, false);
  assert.equal(link.tagName, 'A');
  assert.equal(link.attrs.href, interpreterHref({ sura: 1, start: 1, end: 2 }));
  assert.equal(container.byClass('sequence__adresse')[0].hidden, false);
});

test('une séquence sans élément : la page le dit, sans chaîne', () => {
  const { view, blocks, texts } = mounted();
  view.show(freeText({ ...ready(null, '123'), text: '123' }));
  assert.equal(blocks()[0].byClass('chaine').length, 0);
  assert.deepEqual(texts('bloc__vide', blocks()[0]), ['Aucun élément à afficher.']);
});

test('transcription : dans l’ordre des blocs séquencés, chacune sous sa référence', () => {
  const { view, container, texts } = mounted();
  view.show(verses([waiting('1:1'), waiting('1:2')]));
  const section = container.byClass('sequence__transcription')[0];
  assert.equal(section.hidden, true);
  view.show(verses([waiting('1:1'), ready('1:2'), ready('1:3')]));
  assert.equal(section.hidden, false);
  assert.deepEqual(texts('transcription__ref', section), ['1:2', '1:3']);
  assert.equal(section.byClass('transcription__texte').length, 2);
  // la mise en forme : les fonctions en gras, les états en italique, jamais de balisage brut
  assert.ok(section.find((node) => node.tagName === 'STRONG').some((node) => node.textContent === 'POSITIVE_ACK'));
  assert.ok(section.find((node) => node.tagName === 'EM').length > 0);
  assert.ok(texts('sequence__sous-titre', section)[0].startsWith('Lecture séquentielle'));
  view.show(verses([ready('1:1'), ready('1:2'), ready('1:3')]));
  assert.deepEqual(texts('transcription__ref', section), ['1:1', '1:2', '1:3']);
});

test('journal : replié, les lignes telles que l’API les rend', () => {
  const { view, container, texts } = mounted();
  view.show(verses([ready('1:1')]));
  const journal = container.byClass('sequence__journal')[0];
  assert.equal(journal.tagName, 'DETAILS');
  assert.equal(journal.hidden, false);
  assert.equal(journal.hasAttribute('open'), false);
  assert.equal(journal.find((node) => node.tagName === 'SUMMARY')[0].textContent, 'SYSTEM EXECUTION LOG');
  assert.equal(texts('journal__ligne', journal).length, 5);
  assert.equal(texts('journal__ligne', journal)[0], '> [LEXER] Operator: ب -> TOOL_WITH');
});

test('serveur injoignable pour tous les versets : un seul message, qui relance tout', () => {
  const { view, container, retried, buttons, texts } = mounted();
  view.show(verses([failed('1:1', NETWORK), failed('1:2', NETWORK)]));
  const panne = container.byClass('sequence__panne')[0];
  assert.equal(panne.hidden, false);
  assert.deepEqual(texts('message__titre', panne), ['Connexion impossible. Vérifiez votre réseau, puis réessayez.']);
  assert.equal(container.byClass('sequence__blocs')[0].hidden, true);
  buttons(panne)[0].click();
  assert.deepEqual(retried, [0, 1]);
  // dès qu'un bloc repart, les blocs reviennent et le message s'efface
  view.show(verses([waiting('1:1'), failed('1:2', NETWORK)]));
  assert.equal(panne.hidden, true);
  assert.equal(container.byClass('sequence__blocs')[0].hidden, false);
});

test('un seul verset en échec garde son message dans son bloc', () => {
  const { view, container, blocks, texts } = mounted();
  view.show(verses([failed('1:1', NETWORK)]));
  assert.equal(container.byClass('sequence__panne')[0].hidden, true);
  assert.deepEqual(texts('message__titre', blocks()[0]), ['Connexion impossible. Vérifiez votre réseau, puis réessayez.']);
});

test('légende : repliée, sous l’en-tête', () => {
  const { view, container } = mounted();
  view.show(verses([ready('1:1')]));
  const legend = container.byClass('sequence__legende')[0];
  assert.equal(legend.tagName, 'DETAILS');
  assert.equal(legend.find((node) => node.tagName === 'SUMMARY')[0].textContent, 'Comment lire cette chaîne');
  assert.ok(legend.find((node) => node.tagName === 'LI').length >= 3);
});

// Relecture de l'étape 3 : « Réessayer » disparaît au clic ; le curseur du clavier retombait en haut de la page
test('après « Réessayer », le curseur reste sur le bloc relancé', () => {
  const { view, blocks, buttons, retried } = mounted();
  view.show(verses([ready('1:1'), failed('1:2', NETWORK)]));
  assert.equal(blocks()[1].attrs.tabindex, '-1');
  buttons(blocks()[1])[0].click();
  assert.deepEqual(retried, [1]);
  assert.equal(dom.focused(), blocks()[1]);
});

test('après « Réessayer » du message unique de panne, le curseur va sur le premier bloc', () => {
  const { view, container, blocks, buttons, retried } = mounted();
  view.show(verses([failed('1:1', NETWORK), failed('1:2', NETWORK)]));
  buttons(container.byClass('sequence__panne')[0])[0].click();
  assert.deepEqual(retried, [0, 1]);
  assert.equal(dom.focused(), blocks()[0]);
});
