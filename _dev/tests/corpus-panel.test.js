// Panneau « Valider / Corriger » du corpus (lib/corpus-panel.js) : le corps des trois demandes.
// Les champs sont ceux qu'envoie l'app mobile (veritas_mobile, api_service.dart) aux mêmes routes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { draftRequest, saveRequest, updateRequest, validEntry } from '../../assets/js/v1/lib/corpus-panel.js';

const RESULT = '**[TARGET: m]** | 📊 **Tokens:** Input=1 | Output=1 | Thinking=0 | Total=2\n\nAnalyse';
const VERSE = { mode: 'verset', sura: 2, start: 255, end: 255, text: 'ٱللَّهُ' };
const RANGE = { mode: 'verset', sura: 2, start: 1, end: 5, text: 'الٓمٓ' };
const ENTRY = { id: 'a1b2c3d4e5f6', reference: '2:255', status: 'validated', final_output: 'Analyse', note: '' };

test('brouillon, première analyse d’un passage en mode Verset : la référence et le type viennent du passage', () => {
  assert.deepEqual(draftRequest({ input: 'ٱللَّهُ', result: RESULT, passage: VERSE, first: true }),
    { verse_input: 'ٱللَّهُ', result: RESULT, reference: '2:255', kind: 'verse' });
  assert.deepEqual(draftRequest({ input: 'الٓمٓ', result: RESULT, passage: RANGE, first: true }),
    { verse_input: 'الٓمٓ', result: RESULT, reference: '2:1-5', kind: 'range' });
});

test('brouillon, Tarteel et Texte libre : le serveur déduit la référence de la saisie et de la réponse', () => {
  const cluster = 'Analyse ce cluster de versets interconnectés (Triangulation : S-M-W) :\n\n[2:19] : x';
  assert.deepEqual(draftRequest({ input: cluster, result: RESULT, passage: { mode: 'tarteel', primary: 'S-M-W', constraint: '', verses: ['[2:19] : x'] }, first: true }),
    { verse_input: cluster, result: RESULT });
  assert.deepEqual(draftRequest({ input: 'un texte', result: RESULT, passage: { mode: 'libre', text: 'un texte' }, first: true }),
    { verse_input: 'un texte', result: RESULT });
  assert.deepEqual(draftRequest({ input: 'un texte', result: RESULT, passage: null, first: true }), { verse_input: 'un texte', result: RESULT });
});

test('brouillon, après une suite de conversation : la saisie est le dernier message, sans référence proposée', () => {
  assert.deepEqual(draftRequest({ input: 'Objection', result: RESULT, passage: VERSE, first: false }), { verse_input: 'Objection', result: RESULT });
});

test('enregistrement : les champs de l’app mobile, référence et note sans espaces de bord', () => {
  assert.deepEqual(
    saveRequest({ action: 'validate', input: 'ٱللَّهُ', result: RESULT, kind: 'verse', language: 'English', reference: ' 2:255 ', finalText: ' Analyse\n', note: ' relu ' }),
    { action: 'validate', verse_input: 'ٱللَّهُ', result: RESULT, reference: '2:255', kind: 'verse', language: 'English', final_text: ' Analyse\n', note: 'relu' });
});

test('enregistrement : sans type ni langue connus, les valeurs par défaut de l’API', () => {
  const body = saveRequest({ action: 'correct', input: 'x', result: RESULT, kind: '', language: null, reference: '', finalText: 'y', note: undefined });
  assert.equal(body.kind, 'free');
  assert.equal(body.language, 'Français');
  assert.equal(body.reference, '');
  assert.equal(body.note, '');
});

test('mise à jour : l’adresse porte l’identifiant, et la version attendue est l’entrée rendue par le serveur', () => {
  assert.deepEqual(updateRequest(ENTRY, { reference: '2:255 ', finalText: 'Analyse corrigée', note: ' n ' }),
    { id: 'a1b2c3d4e5f6', body: { reference: '2:255', final_text: 'Analyse corrigée', note: 'n', expected: ENTRY } });
});

test('validEntry : une entrée porte un identifiant et ses champs modifiables, tous en texte', () => {
  assert.equal(validEntry(ENTRY), true);
  assert.equal(validEntry({ ...ENTRY, status: 'corrected', note: 'n' }), true);
  for (const doubtful of [null, undefined, 'x', [], {}, { ...ENTRY, id: '' }, { ...ENTRY, id: 12 }, { ...ENTRY, final_output: null }, { id: 'a' }]) {
    assert.equal(validEntry(doubtful), false, JSON.stringify(doubtful));
  }
});
