import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../../assets/js/v1/lib/store.js';

function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (name) => (data.has(name) ? data.get(name) : null),
    setItem: (name, value) => { data.set(name, String(value)); },
    removeItem: (name) => { data.delete(name); },
  };
}

function brokenStorage() {
  const refuse = () => { throw new Error('stockage refusé'); };
  return { getItem: refuse, setItem: refuse, removeItem: refuse };
}

function setup(localInitial, sessionInitial) {
  const local = fakeStorage(localInitial);
  const session = fakeStorage(sessionInitial);
  return { local, session, store: createStore({ local, session }) };
}

test('clé : par défaut, gardée pour l’onglet seulement', () => {
  const { local, session, store } = setup();
  assert.equal(store.getKey(), '');
  assert.equal(store.setKey('abc'), true);
  assert.equal(session.data.get('veritas.cle'), 'abc');
  assert.equal(local.data.has('veritas.cle'), false);
  assert.equal(store.keyIsRemembered(), false);
  assert.equal(store.getKey(), 'abc');
});

test('clé : avec la case, gardée sur l’appareil et retrouvée par un autre onglet', () => {
  const { local, store } = setup();
  assert.equal(store.setKey('abc', { remember: true }), true);
  assert.equal(local.data.get('veritas.cle'), 'abc');
  assert.equal(store.keyIsRemembered(), true);
  const otherTab = createStore({ local, session: fakeStorage() });
  assert.equal(otherTab.getKey(), 'abc');
});

test('clé : enregistrer sans la case efface celle de l’appareil', () => {
  const { local, session, store } = setup();
  store.setKey('abc', { remember: true });
  assert.equal(store.setKey('def'), true);
  assert.equal(local.data.has('veritas.cle'), false);
  assert.equal(session.data.get('veritas.cle'), 'def');
});

test('clé : oublier la retire de l’onglet et de l’appareil', () => {
  const { local, session, store } = setup();
  store.setKey('abc', { remember: true });
  store.forgetKey();
  assert.equal(local.data.has('veritas.cle'), false);
  assert.equal(session.data.has('veritas.cle'), false);
  assert.equal(store.getKey(), '');
});

test('clé collée : les espaces de bord partent, le reste est refusé sans rien stocker', () => {
  const { local, session, store } = setup();
  for (const refused of ['ab c', 'clé', '', '   ', 'a\nb', 'x'.repeat(201), null, undefined]) {
    assert.equal(store.validKey(refused), false, String(refused));
    assert.equal(store.setKey(refused, { remember: true }), false, String(refused));
  }
  assert.equal(local.data.size, 0);
  assert.equal(session.data.size, 0);
  assert.equal(store.getKey(), '');
  assert.equal(store.validKey('  abc\n'), true);
  assert.equal(store.setKey('  abc\n'), true);
  assert.equal(store.getKey(), 'abc');
  assert.equal(store.setKey('﻿AIzaSy-_x1 '), true);
  assert.equal(store.getKey(), 'AIzaSy-_x1');
});

test('clé : un refus ne touche pas à la clé déjà en place', () => {
  const { store } = setup();
  store.setKey('abc');
  assert.equal(store.setKey('ab c'), false);
  assert.equal(store.getKey(), 'abc');
});

test('mot de passe développeur : jamais sur l’appareil', () => {
  const { local, session, store } = setup();
  assert.equal(store.getDevPassword(), '');
  assert.equal(store.setDevPassword('secret', { remember: true }), true);
  assert.equal(session.data.get('veritas.dev'), 'secret');
  assert.equal(local.data.has('veritas.dev'), false);
  assert.equal(store.getDevPassword(), 'secret');
  store.clearDevPassword();
  assert.equal(session.data.has('veritas.dev'), false);
  assert.equal(store.getDevPassword(), '');
});

test('mot de passe développeur : espaces permis, caractères hors Latin-1 refusés', () => {
  const { session, store } = setup();
  assert.equal(store.setDevPassword('mot de passe'), true);
  assert.equal(store.getDevPassword(), 'mot de passe');
  assert.equal(store.setDevPassword('كلمة'), false);
  assert.equal(store.setDevPassword(''), false);
  assert.equal(store.setDevPassword('a\nb'), false);
  assert.equal(session.data.get('veritas.dev'), 'mot de passe');
});

test('credentials : la clé, puis le mot de passe développeur', () => {
  const { store } = setup();
  assert.deepEqual(store.credentials(), { key: '', devPassword: '' });
  store.setKey('abc');
  assert.deepEqual(store.credentials(), { key: 'abc', devPassword: '' });
  store.setDevPassword('secret');
  assert.deepEqual(store.credentials(), { key: 'abc', devPassword: 'secret' });
});

test('stockage en panne : le site marche pour la visite en cours', () => {
  const store = createStore({ local: brokenStorage(), session: brokenStorage() });
  assert.doesNotThrow(() => store.setKey('abc', { remember: true }));
  assert.equal(store.getKey(), 'abc');
  assert.equal(store.setTheme('jour'), true);
  assert.equal(store.getTheme(), 'jour');
  store.setDevPassword('secret');
  assert.equal(store.getDevPassword(), 'secret');
  store.saveConversation({ history: [], result: 'R' });
  assert.deepEqual(store.loadConversation(), { history: [], result: 'R' });
  assert.doesNotThrow(() => store.forgetKey());
  assert.equal(store.getKey(), '');
});

test('sans stockage du tout (Node) : mémoire seule', () => {
  const store = createStore();
  assert.equal(store.setKey('abc'), true);
  assert.equal(store.getKey(), 'abc');
});

test('conversation : aller-retour, et rien si le contenu est illisible', () => {
  const { session, store } = setup();
  assert.equal(store.loadConversation(), null);
  store.saveConversation({ history: [{ role: 'user', text: 'بِسْمِ' }], result: 'R' });
  assert.deepEqual(store.loadConversation(), { history: [{ role: 'user', text: 'بِسْمِ' }], result: 'R' });
  session.data.set('veritas.conversation', '{cassé');
  assert.equal(store.loadConversation(), null);
  store.saveConversation({ result: 'R' });
  store.clearConversation();
  assert.equal(session.data.has('veritas.conversation'), false);
  assert.equal(store.loadConversation(), null);
});

test('thème : nuit ou jour, rien d’autre', () => {
  const { local, store } = setup({ 'veritas.theme': 'rose' });
  assert.equal(store.getTheme(), null);
  assert.equal(store.setTheme('rose'), false);
  assert.equal(local.data.get('veritas.theme'), 'rose');
  assert.equal(store.setTheme('jour'), true);
  assert.equal(local.data.get('veritas.theme'), 'jour');
  assert.equal(store.getTheme(), 'jour');
  assert.equal(store.setTheme('nuit'), true);
  assert.equal(store.getTheme(), 'nuit');
});

test('langue : gardée sur l’appareil, valeur douteuse ignorée', () => {
  const { local, store } = setup({ 'veritas.lang': '<script>' });
  assert.equal(store.getLang(), null);
  store.setLang('zh-TW');
  assert.equal(local.data.get('veritas.lang'), 'zh-TW');
  assert.equal(store.getLang(), 'zh-TW');
});

test('modèle et formulaire : gardés pour l’onglet', () => {
  const { local, session, store } = setup();
  assert.equal(store.getModel(), null);
  store.setModel('gemini-2.5-flash');
  assert.equal(session.data.get('veritas.modele'), 'gemini-2.5-flash');
  assert.equal(store.getModel(), 'gemini-2.5-flash');
  assert.equal(store.loadForm(), null);
  store.saveForm({ mode: 'verset', sura: 2, start: 255, end: 255 });
  assert.deepEqual(store.loadForm(), { mode: 'verset', sura: 2, start: 255, end: 255 });
  assert.equal(local.data.size, 0);
});

test('choix de l’API en local : gardé pour l’onglet seulement', () => {
  const local = new Map();
  const session = new Map();
  const area = (map) => ({ getItem: (name) => (map.has(name) ? map.get(name) : null), setItem: (name, value) => map.set(name, String(value)), removeItem: (name) => map.delete(name) });
  const store = createStore({ local: area(local), session: area(session) });
  assert.equal(store.getApiChoice(), null);
  store.setApiChoice('reel');
  assert.equal(store.getApiChoice(), 'reel');
  assert.equal(session.get('veritas.api'), 'reel');
  assert.equal(local.size, 0);
  store.setApiChoice('faux');
  assert.equal(store.getApiChoice(), 'faux');
});
