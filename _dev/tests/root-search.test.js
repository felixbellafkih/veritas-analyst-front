// Champ de recherche du Scanner (ui/root-search.js), monté sur un faux DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './aides/faux-dom.mjs';

const dom = installFakeDom();
const { mountRootSearch } = await import('../../assets/js/v1/ui/root-search.js');

const INDEX = [
  { code: 'S-M-A.', arabic: 'س م ع', logic: 'AUDIO_INPUT' },
  { code: 'S-M-W', arabic: 'س م و', logic: 'GLOBAL_ADDRESS_SPACE' },
];

function mounted(index = INDEX) {
  const picked = [];
  const container = dom.node();
  const search = mountRootSearch(container, { onPick: (query) => picked.push(query) });
  search.setIndex(index);
  const input = container.find((node) => node.tagName === 'INPUT')[0];
  const form = container.find((node) => node.tagName === 'FORM')[0];
  const type = (text) => {
    input.value = text;
    input.dispatch('input');
  };
  return { picked, input, form, type, options: () => container.byClass('suggestions__ligne') };
}

test('la frappe propose les racines de la liste', () => {
  const { type, options, input } = mounted();
  type('s-m');
  assert.equal(options().length, 2);
  assert.equal(input.getAttribute('aria-expanded'), 'true');
});

// Relecture de l'étape 2 : la suggestion était choisie dès que le doigt se posait dessus (pointerdown).
// Sur un téléphone, faire défiler la liste ouvrait donc la racine touchée.
test('poser le doigt sur une suggestion ne choisit rien ; le clic choisit', () => {
  const { type, options, picked, input } = mounted();
  type('s-m');
  options()[1].dispatch('pointerdown');
  assert.deepEqual(picked, []);
  assert.equal(options().length, 2);
  options()[1].dispatch('click');
  assert.deepEqual(picked, ['S-M-W']);
  assert.equal(input.value, 'S-M-W');
  assert.equal(options().length, 0);
});

test('appuyer sur une suggestion à la souris ne retire pas le curseur du champ', () => {
  const { type, options, picked } = mounted();
  type('s-m');
  assert.equal(options()[0].dispatch('mousedown').prevented, true);
  assert.deepEqual(picked, []);
});

test('au clavier : flèche puis Entrée choisit la suggestion', () => {
  const { type, input, picked } = mounted();
  type('s-m');
  input.dispatch('keydown', { key: 'ArrowDown' });
  assert.equal(input.getAttribute('aria-activedescendant'), 'scanner-suggestion-0');
  assert.equal(input.dispatch('keydown', { key: 'Enter' }).prevented, true);
  assert.deepEqual(picked, ['S-M-A.']);
});

test('sans liste de racines, le champ marche quand même : pas de suggestions, la recherche part', () => {
  const { type, options, form, picked } = mounted(null);
  type('بِسْمِ');
  assert.equal(options().length, 0);
  assert.equal(form.dispatch('submit').prevented, true);
  assert.deepEqual(picked, ['بِسْمِ']);
});

test('une recherche vide ne part pas', () => {
  const { type, form, picked } = mounted();
  type('   ');
  form.dispatch('submit');
  assert.deepEqual(picked, []);
});
