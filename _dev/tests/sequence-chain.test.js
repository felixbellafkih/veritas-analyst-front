// Chaîne de cartes du Séquenceur (ui/sequence-chain.js), montée sur un faux DOM avec les réponses capturées
// de la vraie API. Chaque élément reçu a sa carte, dans l'ordre ; rien de ce qui vient de l'API n'est lu
// comme du balisage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { installFakeDom } from './aides/faux-dom.mjs';

const dom = installFakeDom();
const { mountSequenceChain } = await import('../../assets/js/v6/ui/sequence-chain.js');
const { parseSequence } = await import('../../assets/js/v6/lib/sequence.js');
const { scannerHref } = await import('../../assets/js/v6/lib/roots-index.js');

const file = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const SEQ = JSON.parse(file('../fixtures/sequences.json'));
const stripAscii = (text) => text.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');
const V = Object.fromEntries(Object.entries(JSON.parse(file('../fixtures/versets.json'))).map(([reference, text]) => [reference, stripAscii(text)]));
const elementsOf = (key) => parseSequence(SEQ[key]).elements;

const element = (extra = {}) => ({ kind: 'variable', arabic: 'كلمة', label: '', root: 'K-L-M', state: '[BASE_VARIABLE]', func: 'F', inputs: [], outputs: [], quantifiers: [], link: 'solid', ...extra });

function mounted(elements, options = {}) {
  const container = dom.node();
  mountSequenceChain(container, { elements, ...options });
  const cards = () => container.byClass('chaine__maillon');
  const within = (card, name) => card.byClass(name);
  const text = (card, name) => within(card, name).map((node) => node.textContent);
  return {
    container, cards, text,
    links: () => container.find((node) => node.tagName === 'A'),
    more: container.byClass('chaine__suite')[0],
    linkKind: (card) => ['plein', 'pointille', 'simple'].filter((name) => card.classList.contains(`chaine__maillon--${name}`)),
  };
}

test('basmala : cinq cartes, numérotées dans l’ordre', () => {
  const { cards, text, container } = mounted(elementsOf(V['1:1']));
  assert.equal(cards().length, 5);
  assert.deepEqual(cards().map((card) => text(card, 'carte-mot__rang')[0]), ['1', '2', '3', '4', '5']);
  assert.deepEqual(cards().map((card) => text(card, 'carte-mot__mot')[0]), ['ب', 'سم', 'الله', 'الرحمن', 'الرحيم']);
  assert.equal(container.find((node) => node.tagName === 'OL').length, 1);
});

test('carte d’une variable : le mot, la racine en lien vers le Scanner, l’état, la fonction', () => {
  const { cards, text, links } = mounted(elementsOf(V['1:1']));
  const card = cards()[1];
  assert.ok(card.classList.contains('chaine__maillon--variable'));
  const word = card.byClass('carte-mot__mot')[0];
  assert.deepEqual([word.attrs.lang, word.attrs.dir], ['ar', 'rtl']);
  const link = card.find((node) => node.tagName === 'A')[0];
  assert.equal(link.attrs.href, scannerHref('S-M-W'));
  assert.equal(link.textContent, 'S-M-W');
  assert.equal(link.attrs.dir, 'ltr');
  assert.deepEqual(text(card, 'carte-mot__etat'), ['[SYSTEM_POINTER]']);
  assert.deepEqual(text(card, 'carte-mot__fonction'), ['GLOBAL_ADDRESS_SPACE']);
  // une étiquette ne peut se couper qu'après « _ » : deux coupures possibles ici
  assert.equal(card.byClass('carte-mot__fonction')[0].find((node) => node.tagName === 'WBR').length, 2);
  assert.equal(links().length, 4);
});

test('carte d’un opérateur : le mot et son étiquette, sans lien', () => {
  const { cards, text } = mounted(elementsOf(V['1:1']));
  const card = cards()[0];
  assert.ok(card.classList.contains('chaine__maillon--operateur'));
  assert.deepEqual(text(card, 'carte-mot__etiquette'), ['TOOL_WITH']);
  assert.equal(card.find((node) => node.tagName === 'A').length, 0);
  assert.equal(card.byClass('carte-mot__etiquette')[0].attrs.dir, 'ltr');
});

test('une racine qui finit par un point : l’adresse du Scanner l’encode', () => {
  const { links } = mounted([element({ root: 'A-R-D.' })]);
  assert.equal(links()[0].attrs.href, '/scanner/?q=A-R-D%2E');
  assert.equal(links()[0].textContent, 'A-R-D.');
});

test('le trait qui arrive à une carte : plein, pointillé ou simple ; aucun pour la première', () => {
  const basmala = mounted(elementsOf(V['1:1']));
  assert.deepEqual(basmala.cards().map(basmala.linkKind), [[], ['plein'], ['plein'], ['plein'], ['plein']]);
  assert.equal(basmala.cards()[0].byClass('chaine__trait').length, 0);
  assert.equal(basmala.cards()[1].byClass('chaine__trait')[0].attrs['aria-hidden'], 'true');
  const second = mounted(elementsOf(V['1:2']));
  assert.ok(second.cards().some((card) => second.linkKind(card)[0] === 'pointille'));
  const plain = mounted([element({ link: null }), element({ link: 'plain' })]);
  assert.deepEqual(plain.cards().map(plain.linkKind), [[], ['simple']]);
});

test('un texte hostile venu de l’API reste du texte', () => {
  const { cards, text, container } = mounted(elementsOf('<b>بِسْمِ</b>'));
  assert.deepEqual(text(cards()[0], 'carte-mot__mot'), ['<b>بسم</b>']);
  assert.equal(container.find((node) => node.tagName === 'B').length, 0);
});

test('mots sans racine connue : des cartes d’alerte, sans lien', () => {
  const { cards, text, links } = mounted(elementsOf('hello world'));
  assert.equal(cards().length, 2);
  assert.ok(cards().every((card) => card.classList.contains('chaine__maillon--inconnu')));
  assert.deepEqual(text(cards()[0], 'carte-mot__mot'), ['hello']);
  assert.deepEqual(text(cards()[0], 'carte-mot__alerte'), ['UNMAPPED ROOT']);
  assert.deepEqual(text(cards()[0], 'carte-mot__etat'), ['[BASE_VARIABLE]']);
  assert.equal(links().length, 0);
});

test('un type que le site ne connaît pas garde sa carte, avec le type reçu', () => {
  const { cards, text } = mounted([element({ kind: 'other', label: 'FUTUR', root: '', link: null })]);
  assert.ok(cards()[0].classList.contains('chaine__maillon--autre'));
  assert.deepEqual(text(cards()[0], 'carte-mot__etiquette'), ['FUTUR']);
});

test('quantificateurs, connecteurs et pointeurs : affichés quand l’API en rend, absents sinon', () => {
  const basmala = mounted(elementsOf(V['1:1']));
  assert.equal(basmala.container.byClass('carte-mot__plus').length, 0);

  const second = mounted(elementsOf(V['1:2']));
  const dual = second.cards().find((card) => card.byClass('carte-mot__plus').length);
  assert.deepEqual(second.text(dual, 'carte-mot__titre'), ['QUANTIFICATEURS']);
  assert.deepEqual(second.text(dual, 'carte-mot__ligne'), ['[DUAL_STATE]']);

  const fourth = mounted(elementsOf(V['1:4']));
  const pointed = fourth.cards().find((card) => card.byClass('carte-mot__plus').length);
  assert.deepEqual(fourth.text(pointed, 'carte-mot__titre'), ['CONNECTIQUE (I/O)']);
  assert.deepEqual(fourth.text(pointed, 'carte-mot__ligne'), ['OUT : [USER_NODE]']);

  const both = mounted([element({ inputs: ['[A]'], outputs: ['[B]', '[C]'], quantifiers: ['[Q]'] })]);
  assert.deepEqual(both.text(both.cards()[0], 'carte-mot__titre'), ['CONNECTIQUE (I/O)', 'QUANTIFICATEURS']);
  assert.deepEqual(both.text(both.cards()[0], 'carte-mot__ligne'), ['IN : [A]', 'OUT : [B]', 'OUT : [C]', '[Q]']);
});

test('longue chaîne : une première tranche, puis la suite à la demande, rangs gardés', () => {
  const many = Array.from({ length: 300 }, (_, index) => element({ arabic: `m${index + 1}`, link: index ? 'solid' : null }));
  const { cards, text, more } = mounted(many, { slice: 120 });
  assert.equal(cards().length, 120);
  assert.equal(more.hidden, false);
  more.click();
  assert.equal(cards().length, 240);
  assert.deepEqual(text(cards()[120], 'carte-mot__rang'), ['121']);
  assert.deepEqual(text(cards()[120], 'carte-mot__mot'), ['m121']);
  more.click();
  assert.equal(cards().length, 300);
  assert.equal(more.hidden, true);
  more.click();
  assert.equal(cards().length, 300);
});

test('chaîne courte ou vide : pas de bouton de suite', () => {
  assert.equal(mounted(elementsOf(V['2:255'])).more.hidden, true);
  assert.equal(mounted(elementsOf(V['2:255'])).cards().length, 70);
  const empty = mounted([]);
  assert.equal(empty.cards().length, 0);
  assert.equal(empty.more.hidden, true);
});

// La couleur que l'API joint à chaque élément est faite pour le fond sombre de l'app actuelle
test('la couleur envoyée par l’API n’est lue nulle part', () => {
  for (const path of ['../../assets/js/v6/ui/sequence-chain.js', '../../assets/js/v6/lib/sequence.js']) {
    assert.doesNotMatch(file(path), /\.color\b|\[['"]color['"]\]/, path);
  }
});

// Chaque variable porte un lien : sans curseur unique, sept versets imposeraient des dizaines de tabulations
// avant d'atteindre la transcription (même constat que pour la liste des versets du Tarteel, étape 2).
test('clavier : un seul arrêt de tabulation par chaîne, les flèches passent d’une racine à l’autre', () => {
  const { links } = mounted(elementsOf(V['1:1']));
  const reach = () => links().map((link) => link.tabIndex);
  assert.deepEqual(reach(), [0, -1, -1, -1]);
  const right = links()[0].dispatch('keydown', { key: 'ArrowRight' });
  assert.equal(right.prevented, true);
  assert.equal(dom.focused(), links()[1]);
  assert.deepEqual(reach(), [-1, 0, -1, -1]);
  links()[1].dispatch('keydown', { key: 'ArrowDown' });
  assert.equal(dom.focused(), links()[2]);
  links()[2].dispatch('keydown', { key: 'ArrowLeft' });
  assert.equal(dom.focused(), links()[1]);
  links()[1].dispatch('keydown', { key: 'End' });
  assert.equal(dom.focused(), links()[3]);
  assert.deepEqual(reach(), [-1, -1, -1, 0]);
  links()[3].dispatch('keydown', { key: 'ArrowRight' });
  assert.equal(dom.focused(), links()[3]);
  links()[3].dispatch('keydown', { key: 'Home' });
  assert.equal(dom.focused(), links()[0]);
  assert.deepEqual(reach(), [0, -1, -1, -1]);
  // une autre touche garde son effet : Entrée ouvre le lien, Tab quitte la chaîne
  assert.equal(links()[0].dispatch('keydown', { key: 'Enter' }).prevented, false);
  assert.equal(links()[0].dispatch('keydown', { key: 'Tab' }).prevented, false);
});

test('clavier : dans une page de droite à gauche, la flèche gauche avance', () => {
  document.documentElement.dir = 'rtl';
  try {
    const { links } = mounted(elementsOf(V['1:1']));
    links()[0].dispatch('keydown', { key: 'ArrowLeft' });
    assert.equal(dom.focused(), links()[1]);
    links()[1].dispatch('keydown', { key: 'ArrowRight' });
    assert.equal(dom.focused(), links()[0]);
  } finally {
    document.documentElement.dir = 'ltr';
  }
});

test('clavier : le lien où l’on arrive par un clic devient le seul atteignable par Tab', () => {
  const { links } = mounted(elementsOf(V['1:1']));
  links()[2].focus();
  assert.deepEqual(links().map((link) => link.tabIndex), [-1, -1, 0, -1]);
});

test('clavier : Fin bâtit la chaîne jusqu’au bout, et la suite arrive avec des liens hors du parcours de Tab', () => {
  const many = Array.from({ length: 300 }, (_, index) => element({ arabic: `m${index + 1}`, link: index ? 'solid' : null }));
  const { links, cards, more } = mounted(many, { slice: 120 });
  more.click();
  assert.equal(links().filter((link) => link.tabIndex === 0).length, 1);
  links()[0].dispatch('keydown', { key: 'End' });
  assert.equal(cards().length, 300);
  assert.equal(dom.focused(), links()[299]);
  assert.equal(links().filter((link) => link.tabIndex === 0).length, 1);
});

// Relecture de l'étape 3 : curseur sur une racine, Alt+← ne ramenait plus à la page précédente
test('clavier : une touche tenue avec Alt, Ctrl, Cmd ou Maj reste au navigateur', () => {
  const { links } = mounted(elementsOf(V['1:1']));
  links()[1].focus();
  for (const [key, modifier] of [['ArrowLeft', 'altKey'], ['ArrowLeft', 'metaKey'], ['Home', 'ctrlKey'], ['ArrowDown', 'shiftKey'], ['End', 'ctrlKey']]) {
    const event = links()[1].dispatch('keydown', { key, [modifier]: true });
    assert.equal(event.prevented, false, `${modifier}+${key}`);
    assert.equal(dom.focused(), links()[1], `${modifier}+${key}`);
  }
  assert.deepEqual(links().map((link) => link.tabIndex), [-1, 0, -1, -1]);
});

// Relecture de l'étape 3 : une longue étiquette de connecteur sortait de sa carte sur téléphone
test('connecteurs et quantificateurs : leurs étiquettes peuvent aussi se couper après « _ »', () => {
  const { cards } = mounted([element({ inputs: ['[INSTRUMENTAL_BIND]'], outputs: ['[CLIENT_ENVIRONMENT]'], quantifiers: ['[PLURAL_MASCULINE_SOUND_STATE]'] })]);
  const lines = cards()[0].byClass('carte-mot__ligne');
  assert.deepEqual(lines.map((line) => line.textContent), ['IN : [INSTRUMENTAL_BIND]', 'OUT : [CLIENT_ENVIRONMENT]', '[PLURAL_MASCULINE_SOUND_STATE]']);
  assert.deepEqual(lines.map((line) => line.find((node) => node.tagName === 'WBR').length), [1, 1, 3]);
});
