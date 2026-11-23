// Formulaire du Séquenceur gardé pour l'onglet (lib/sequence-form.js), et adresses d'un passage (lib/verses.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEQUENCE_TEXT_MAX } from '../../assets/js/v5/lib/sequence.js';
import { sequenceFormState } from '../../assets/js/v5/lib/sequence-form.js';
import { interpreterHref, parsePassageQuery, sequencerHref } from '../../assets/js/v5/lib/verses.js';

const FIRST = { mode: 'verset', sura: 1, start: 1, end: 1, text: '' };

test('sequenceFormState : sans rien de gardé, le verset 1:1', () => {
  for (const doubtful of [null, undefined, 'x', 12, [], {}]) assert.deepEqual(sequenceFormState(doubtful), FIRST);
});

test('sequenceFormState : le mode, le passage et le texte gardés reviennent', () => {
  assert.deepEqual(sequenceFormState({ mode: 'texte', sura: 2, start: 255, end: 256, text: 'بِسْمِ' }),
    { mode: 'texte', sura: 2, start: 255, end: 256, text: 'بِسْمِ' });
  assert.equal(sequenceFormState({ mode: 'tarteel' }).mode, 'verset');
  assert.equal(sequenceFormState({ mode: 'libre' }).mode, 'verset');
});

test('sequenceFormState : un passage hors bornes est ramené à dix versets, dans la sourate', () => {
  assert.deepEqual(sequenceFormState({ sura: 2, start: 250, end: 290 }), { ...FIRST, sura: 2, start: 250, end: 259 });
  assert.deepEqual(sequenceFormState({ sura: 1, start: 5, end: 99 }), { ...FIRST, sura: 1, start: 5, end: 7 });
  assert.deepEqual(sequenceFormState({ sura: 999, start: 3, end: 4 }), FIRST);
  assert.deepEqual(sequenceFormState({ sura: 'x' }), FIRST);
});

test('sequenceFormState : un texte trop long est coupé, autre chose qu’un texte vaut vide', () => {
  assert.equal(sequenceFormState({ text: 'a'.repeat(6000) }).text.length, SEQUENCE_TEXT_MAX);
  assert.equal(sequenceFormState({ text: 12 }).text, '');
  assert.equal(sequenceFormState({ text: null }).text, '');
});

test('adresses d’un passage : le Séquenceur et l’Interpréteur, relues par parsePassageQuery', () => {
  const passage = { sura: 2, start: 255, end: 255 };
  assert.equal(sequencerHref(passage), '/sequenceur/?s=2&de=255&a=255');
  assert.equal(interpreterHref(passage), '/interpreteur/?s=2&de=255&a=255');
  for (const href of [sequencerHref({ sura: 1, start: 1, end: 7 }), interpreterHref({ sura: 1, start: 1, end: 7 })]) {
    assert.deepEqual(parsePassageQuery(href.slice(href.indexOf('?'))), { sura: 1, start: 1, end: 7 });
  }
});
