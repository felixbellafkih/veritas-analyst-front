import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analysisRequest, credentialHeaders, followUpRequest } from '../../assets/js/v4/lib/request.js';
import { clusterText } from '../../assets/js/v4/lib/tarteel.js';

const O = { language: 'Français', model: null, defaultModel: 'gemini-3.1-pro-preview' };

test('mode Verset : le texte de l’API sans U+FEFF, et la référence en nombres', () => {
  assert.deepEqual(analysisRequest({ mode: 'verset', sura: 1, start: 1, end: 1, text: '﻿بِسْمِ ٱللَّهِ' }, O),
    { verse_text: 'بِسْمِ ٱللَّهِ', language: 'Français', sura_num: 1, verse_start: 1, verse_end: 1 });
  assert.deepEqual(analysisRequest({ mode: 'verset', sura: 2, start: 1, end: 5, text: 'نص' }, { ...O, language: 'English' }),
    { verse_text: 'نص', language: 'English', sura_num: 2, verse_start: 1, verse_end: 5 });
});

test('mode Verset : pas de demande tant que le texte n’est pas là', () => {
  assert.equal(analysisRequest({ mode: 'verset', sura: 1, start: 1, end: 1, text: '' }, O), null);
  assert.equal(analysisRequest({ mode: 'verset', sura: 1, start: 1, end: 1, text: '﻿ ' }, O), null);
  assert.equal(analysisRequest({ mode: 'verset', sura: 1, start: 1, end: 1 }, O), null);
});

test('mode Tarteel : la phrase du cluster, sans champ de sourate', () => {
  const verses = ['[2:22] : x', '[3:4] : y'];
  assert.deepEqual(analysisRequest({ mode: 'tarteel', primary: 'D.-R-B', constraint: 'A.-B-D', verses }, O),
    { verse_text: clusterText('D.-R-B', 'A.-B-D', verses), language: 'Français' });
  assert.equal(analysisRequest({ mode: 'tarteel', primary: 'D.-R-B', constraint: '', verses: [] }, O), null);
});

test('mode Texte libre : le texte tel que saisi', () => {
  assert.deepEqual(analysisRequest({ mode: 'libre', text: ' ما معنى الصمد؟ ' }, O), { verse_text: ' ما معنى الصمد؟ ', language: 'Français' });
  assert.equal(analysisRequest({ mode: 'libre', text: '   ' }, O), null);
  assert.equal(analysisRequest({ mode: 'libre' }, O), null);
});

test('mode inconnu : pas de demande', () => {
  assert.equal(analysisRequest({ mode: 'autre', text: 'x' }, O), null);
  assert.equal(analysisRequest(null, O), null);
});

test('modèle : envoyé seulement s’il diffère du modèle par défaut', () => {
  const passage = { mode: 'libre', text: 'x' };
  assert.deepEqual(analysisRequest(passage, { ...O, model: 'gemini-2.5-flash' }), { verse_text: 'x', language: 'Français', model: 'gemini-2.5-flash' });
  assert.deepEqual(analysisRequest(passage, { ...O, model: 'gemini-3.1-pro-preview' }), { verse_text: 'x', language: 'Français' });
  assert.deepEqual(analysisRequest(passage, { ...O, model: '' }), { verse_text: 'x', language: 'Français' });
});

test('suite de conversation : le message et l’historique, sans champ de sourate', () => {
  const h = [{ role: 'user', text: 'a' }, { role: 'model', text: 'b' }];
  assert.deepEqual(followUpRequest('Objection', h, O), { verse_text: 'Objection', language: 'Français', history: h });
  assert.deepEqual(followUpRequest('Objection', h, { ...O, model: 'gemini-2.5-flash' }),
    { verse_text: 'Objection', language: 'Français', history: h, model: 'gemini-2.5-flash' });
  assert.deepEqual(followUpRequest('Objection', [], O), { verse_text: 'Objection', language: 'Français' });
  assert.equal(followUpRequest('  ', h, O), null);
  assert.equal(followUpRequest(null, h, O), null);
});

test('en-têtes : la clé, ou le mot de passe développeur, jamais les deux', () => {
  assert.deepEqual(credentialHeaders({ key: 'k', devPassword: '' }), { 'X-API-Key': 'k' });
  assert.deepEqual(credentialHeaders({ key: 'k', devPassword: 'd' }), { 'X-Dev-Password': 'd' });
  assert.deepEqual(credentialHeaders({ key: '', devPassword: 'd' }), { 'X-Dev-Password': 'd' });
  assert.deepEqual(credentialHeaders({ key: '', devPassword: '' }), {});
  assert.deepEqual(credentialHeaders(undefined), {});
});
