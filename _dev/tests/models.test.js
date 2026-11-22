import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modelMenu } from '../../assets/js/v1/lib/models.js';

const REPONSE = { default: 'gemini-3.1-pro-preview', models: ['gemini-3.1-pro-preview', 'gemini-2.5-flash', 'gemini-2.5-pro'] };

test('menu : le modèle par défaut en tête, et choisi quand rien n’est gardé', () => {
  assert.deepEqual(modelMenu(REPONSE, null), {
    models: ['gemini-3.1-pro-preview', 'gemini-2.5-flash', 'gemini-2.5-pro'],
    defaultModel: 'gemini-3.1-pro-preview',
    selected: 'gemini-3.1-pro-preview',
  });
});

test('menu : le choix gardé pour l’onglet revient s’il est dans la liste', () => {
  assert.equal(modelMenu(REPONSE, 'gemini-2.5-flash').selected, 'gemini-2.5-flash');
});

test('menu : un choix gardé absent de la liste est abandonné', () => {
  assert.equal(modelMenu(REPONSE, 'gemini-1.0-ancien').selected, 'gemini-3.1-pro-preview');
  assert.equal(modelMenu(REPONSE, 42).selected, 'gemini-3.1-pro-preview');
});

test('menu : le modèle par défaut passe en tête, même rangé ailleurs ou absent de la liste', () => {
  assert.deepEqual(modelMenu({ default: 'gemini-b', models: ['gemini-a', 'gemini-b', 'gemini-c'] }, null).models, ['gemini-b', 'gemini-a', 'gemini-c']);
  const missing = modelMenu({ default: 'gemini-z', models: ['gemini-a'] }, null);
  assert.deepEqual(missing.models, ['gemini-z', 'gemini-a']);
  assert.equal(missing.defaultModel, 'gemini-z');
});

test('menu : sans modèle par défaut annoncé, le premier de la liste en tient lieu', () => {
  const menu = modelMenu({ models: ['gemini-a', 'gemini-b'] }, 'gemini-b');
  assert.equal(menu.defaultModel, 'gemini-a');
  assert.equal(menu.selected, 'gemini-b');
});

test('menu : une liste réduite au modèle par défaut donne un menu à un seul choix', () => {
  assert.deepEqual(modelMenu({ default: 'gemini-a', models: ['gemini-a'] }, null), { models: ['gemini-a'], defaultModel: 'gemini-a', selected: 'gemini-a' });
  assert.deepEqual(modelMenu({ default: 'gemini-a', models: [] }, null).models, ['gemini-a']);
});

test('menu : les doublons et les noms mal formés sont écartés', () => {
  const menu = modelMenu({ default: 'gemini-a', models: ['gemini-a', 'gemini-b', 'gemini-b', '', null, 7, 'avec espace', 'x'.repeat(101)] }, null);
  assert.deepEqual(menu.models, ['gemini-a', 'gemini-b']);
});

test('menu : rien d’exploitable, pas de menu', () => {
  for (const data of [null, undefined, 'texte', 42, {}, { models: [] }, { models: 'gemini-a' }, { models: [null, ''] }, { default: 7, models: [] }]) {
    assert.equal(modelMenu(data, null), null, JSON.stringify(data));
  }
});
