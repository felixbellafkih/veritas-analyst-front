// Adresse et historique du Séquenceur (lib/sequence-history.js) : ce que la page affiche à l'ouverture, ce
// qu'elle écrit dans l'adresse et dans l'historique du navigateur, ce que « précédent » et « suivant » rendent.
// Relecture de l'étape 3 : ces décisions vivaient dans pages/sequenceur.js, sans aucun test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sequenceFormState } from '../../assets/js/v6/lib/sequence-form.js';
import { SEQUENCER_HOME, historyAddress, historyEntry, openingState, planOpen, planPop } from '../../assets/js/v6/lib/sequence-history.js';

const FIRST = { mode: 'verset', sura: 1, start: 1, end: 1, text: '' };
const state = (extra = {}) => sequenceFormState({ ...FIRST, ...extra });
const TEXT = 'بِسْمِ ٱللَّهِ';

test('à l’ouverture : l’adresse l’emporte sur le formulaire gardé, qui l’emporte sur 1:1', () => {
  assert.deepEqual(openingState(null, ''), FIRST);
  assert.deepEqual(openingState({ mode: 'verset', sura: 112, start: 2, end: 3, text: 'x' }, ''), { mode: 'verset', sura: 112, start: 2, end: 3, text: 'x' });
  assert.deepEqual(openingState({ mode: 'texte', sura: 112, start: 2, end: 3, text: TEXT }, ''), { mode: 'texte', sura: 112, start: 2, end: 3, text: TEXT });
  // l'adresse désigne un passage : le mode Verset, même si un texte libre était gardé (le texte reste dans sa zone)
  assert.deepEqual(openingState({ mode: 'texte', text: TEXT }, '?s=2&de=255&a=255'), { mode: 'verset', sura: 2, start: 255, end: 255, text: TEXT });
});

test('à l’ouverture : une adresse hors bornes est ramenée dans la sourate, une adresse illisible est ignorée', () => {
  assert.deepEqual(openingState(null, '?s=2&de=280&a=999'), { ...FIRST, sura: 2, start: 280, end: 286 });
  assert.deepEqual(openingState(null, '?s=1&de=6&a=99'), { ...FIRST, sura: 1, start: 6, end: 7 });
  assert.deepEqual(openingState(null, '?s=2&de=250&a=290'), { ...FIRST, sura: 2, start: 250, end: 259 });
  for (const doubtful of ['?s=999', '?s=abc&de=1&a=2', '?de=3&a=4', '?s=', '?x=1', '?s=2e1']) assert.deepEqual(openingState(null, doubtful), FIRST, doubtful);
  assert.deepEqual(openingState(null, '?s=2&de=abc&a=xyz'), { ...FIRST, sura: 2 });
  // un formulaire gardé illisible ne casse rien
  for (const doubtful of ['x', 12, [], { mode: 'tarteel', sura: 999, text: 12 }]) assert.deepEqual(openingState(doubtful, ''), FIRST);
});

test('adresse : un passage de versets y est écrit, un texte libre jamais', () => {
  assert.equal(historyAddress(state({ sura: 2, start: 255, end: 256 })), '/sequenceur/?s=2&de=255&a=256');
  const free = historyAddress(state({ mode: 'texte', text: TEXT, sura: 2, start: 255, end: 256 }));
  assert.equal(free, SEQUENCER_HOME);
  assert.equal(SEQUENCER_HOME, '/sequenceur/');
  assert.ok(!free.includes('?'));
});

test('historique : ce qu’une ligne retient d’un affichage', () => {
  assert.deepEqual(historyEntry(state({ sura: 2, start: 255, end: 256, text: TEXT })), { mode: 'verset', sura: 2, start: 255, end: 256 });
  assert.deepEqual(historyEntry(state({ mode: 'texte', text: TEXT })), { mode: 'texte', text: TEXT });
});

test('ouverture de la page : la ligne en cours est mise à jour, jamais doublée', () => {
  const plan = planOpen({ state: state(), request: {}, shown: null, location: '/sequenceur/', push: false });
  assert.deepEqual(plan, { state: FIRST, entry: { mode: 'verset', sura: 1, start: 1, end: 1 }, address: '/sequenceur/?s=1&de=1&a=1', method: 'replace' });
  // un autre paramètre de l'adresse (langue, essai local) ne crée pas de ligne non plus
  assert.equal(planOpen({ state: state({ sura: 2, start: 255, end: 255 }), request: {}, shown: null, location: '/sequenceur/?lang=ar&s=2&de=255&a=255', push: false }).method, 'replace');
});

test('envoi d’un passage : une ligne de plus quand il change, aucune quand c’est le même', () => {
  const shown = { mode: 'verset', sura: 1, start: 1, end: 1 };
  const other = planOpen({ state: state(), request: { mode: 'verset', sura: 112, start: 1, end: 4 }, shown, location: '/sequenceur/?s=1&de=1&a=1', push: true });
  assert.equal(other.method, 'push');
  assert.equal(other.address, '/sequenceur/?s=112&de=1&a=4');
  assert.deepEqual(other.entry, { mode: 'verset', sura: 112, start: 1, end: 4 });
  assert.deepEqual(other.state, { ...FIRST, sura: 112, start: 1, end: 4 });
  const same = planOpen({ state: other.state, request: { mode: 'verset', sura: 112, start: 1, end: 4 }, shown: other.entry, location: other.address, push: true });
  assert.equal(same.method, 'replace');
});

test('envoi d’un passage : une demande hors bornes est ramenée avant d’être écrite', () => {
  const plan = planOpen({ state: state(), request: { mode: 'verset', sura: 2, start: 250, end: 290 }, shown: null, location: '/sequenceur/?s=1&de=1&a=1', push: true });
  assert.equal(plan.address, '/sequenceur/?s=2&de=250&a=259');
  assert.deepEqual(plan.entry, { mode: 'verset', sura: 2, start: 250, end: 259 });
});

test('envoi d’un texte libre : l’adresse redevient nue, et chaque texte différent a sa ligne', () => {
  const first = planOpen({ state: state({ sura: 112, start: 1, end: 4 }), request: { mode: 'texte', text: TEXT }, shown: { mode: 'verset', sura: 112, start: 1, end: 4 }, location: '/sequenceur/?s=112&de=1&a=4', push: true });
  assert.equal(first.method, 'push');
  assert.equal(first.address, '/sequenceur/');
  assert.deepEqual(first.entry, { mode: 'texte', text: TEXT });
  // le passage choisi avant reste dans les champs du mode Verset
  assert.deepEqual(first.state, { mode: 'texte', sura: 112, start: 1, end: 4, text: TEXT });
  const again = planOpen({ state: first.state, request: { mode: 'texte', text: TEXT }, shown: first.entry, location: '/sequenceur/', push: true });
  assert.equal(again.method, 'replace');
  const other = planOpen({ state: first.state, request: { mode: 'texte', text: 'نص آخر' }, shown: first.entry, location: '/sequenceur/', push: true });
  assert.equal(other.method, 'push');
  assert.equal(other.address, '/sequenceur/');
  assert.deepEqual(other.entry, { mode: 'texte', text: 'نص آخر' });
});

test('« précédent » et « suivant » : ce que la ligne de l’historique affichait', () => {
  const now = state({ mode: 'texte', text: TEXT, sura: 112, start: 1, end: 4 });
  // retour sur un passage : le mode Verset, et le texte libre reste dans sa zone
  assert.deepEqual(planPop({ state: now, shown: { mode: 'verset', sura: 2, start: 255, end: 255 }, search: '?s=2&de=255&a=255' }),
    { mode: 'verset', sura: 2, start: 255, end: 255, text: TEXT });
  // retour sur un texte libre : le mode Texte libre, avec ce texte
  assert.deepEqual(planPop({ state: state({ sura: 2, start: 255, end: 255 }), shown: { mode: 'texte', text: TEXT }, search: '' }),
    { mode: 'texte', sura: 2, start: 255, end: 255, text: TEXT });
});

test('« précédent » sur une ligne sans mémoire : ce que dit l’adresse ; adresse nue : rien ne change', () => {
  const now = state({ sura: 112, start: 1, end: 4, text: TEXT });
  assert.deepEqual(planPop({ state: now, shown: null, search: '?s=1&de=1&a=7' }), { mode: 'verset', sura: 1, start: 1, end: 7, text: TEXT });
  assert.deepEqual(planPop({ state: now, shown: undefined, search: '' }), now);
  assert.deepEqual(planPop({ state: now, shown: 'x', search: '?s=999' }), now);
});

test('une mémoire d’historique douteuse est vérifiée avant de servir', () => {
  const now = state({ sura: 112, start: 1, end: 4 });
  assert.deepEqual(planPop({ state: now, shown: { mode: 'tarteel', sura: 999, start: -3, end: 'x', text: 12 }, search: '' }), FIRST);
  assert.equal(planPop({ state: now, shown: { mode: 'texte', text: 'a'.repeat(6000) }, search: '' }).text.length, 5000);
  assert.deepEqual(planPop({ state: now, shown: [1, 2], search: '' }), now);
});
