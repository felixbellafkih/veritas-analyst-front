import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FREE_TEXT_MAX, ROOT_MAX, formState } from '../../assets/js/v3/lib/form-state.js';

const DEPART = { mode: 'verset', sura: 1, start: 1, end: 1, primary: '', constraint: '', text: '', language: null };

test('rien de gardé, ou une valeur illisible : le formulaire de départ', () => {
  for (const saved of [null, undefined, 'texte', 42, [], true]) assert.deepEqual(formState(saved), DEPART, JSON.stringify(saved));
});

test('ancien format (mode Verset seul) : le passage revient', () => {
  assert.deepEqual(formState({ mode: 'verset', sura: 2, start: 255, end: 255 }), { ...DEPART, sura: 2, start: 255, end: 255 });
});

test('le passage est ramené dans la sourate, à 10 versets au plus', () => {
  assert.deepEqual(formState({ sura: 1, start: 5, end: 99 }), { ...DEPART, start: 5, end: 7 });
  assert.deepEqual(formState({ sura: 2, start: 1, end: 200 }), { ...DEPART, sura: 2, start: 1, end: 10 });
  assert.deepEqual(formState({ sura: 999, start: 3, end: 4 }), DEPART);
  assert.deepEqual(formState({ sura: 'x' }), DEPART);
});

test('mode : verset, tarteel ou libre ; tout autre revient à verset', () => {
  assert.equal(formState({ mode: 'tarteel' }).mode, 'tarteel');
  assert.equal(formState({ mode: 'libre' }).mode, 'libre');
  assert.equal(formState({ mode: 'autre' }).mode, 'verset');
  assert.equal(formState({ mode: 7 }).mode, 'verset');
});

test('racines du mode Tarteel : gardées telles que saisies, bornées en longueur', () => {
  const state = formState({ mode: 'tarteel', primary: ' S-M-W', constraint: 'ض ر ب ' });
  assert.equal(state.primary, ' S-M-W');
  assert.equal(state.constraint, 'ض ر ب ');
  assert.equal(ROOT_MAX, 100);
  assert.equal(formState({ primary: 'x'.repeat(150) }).primary.length, 100);
  assert.equal(formState({ primary: 7, constraint: null }).primary, '');
  assert.equal(formState({ primary: 7, constraint: null }).constraint, '');
});

test('texte libre : gardé tel quel, borné à 10 000 caractères', () => {
  assert.equal(FREE_TEXT_MAX, 10000);
  assert.equal(formState({ mode: 'libre', text: 'ligne 1\nligne 2 ' }).text, 'ligne 1\nligne 2 ');
  assert.equal(formState({ text: 'x'.repeat(10500) }).text.length, 10000);
  assert.equal(formState({ text: { a: 1 } }).text, '');
});

test('langue de la réponse : le code choisi par le visiteur, sinon rien', () => {
  assert.equal(formState({ language: 'en' }).language, 'en');
  assert.equal(formState({ language: 'zh-CN' }).language, 'zh-CN');
  assert.equal(formState({ language: 'English' }).language, null);
  assert.equal(formState({ language: 7 }).language, null);
  assert.equal(formState({}).language, null);
});
