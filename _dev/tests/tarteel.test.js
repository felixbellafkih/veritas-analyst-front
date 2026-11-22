import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as tarteel from '../../assets/js/v1/lib/tarteel.js';
import { clusterText, clusterVerse, pickVerses, tarteelState } from '../../assets/js/v1/lib/tarteel.js';

// Décision de l'auteur du 22/11/2026 : plus de plafond de 57 occurrences, plus de limite de 30 versets
// envoyés. Le visiteur coche lui-même les versets à analyser.
test('plus de plafond ni de limite d’envoi', () => {
  assert.equal('CEILING' in tarteel, false);
  assert.equal('SENT_LIMIT' in tarteel, false);
});

test('pas de racine primaire : rien à dire', () => {
  assert.equal(tarteelState({ primary: '', constraint: '', primaryFrequency: 0, clusterFrequency: 0 }).state, 'vide');
  assert.equal(tarteelState({ primary: '   ', constraint: 'X', primaryFrequency: 9, clusterFrequency: 9 }).state, 'vide');
});

test('fréquences pas encore connues : rien à dire', () => {
  assert.equal(tarteelState({ primary: 'S-M-W', constraint: '' }).state, 'vide');
});

test('signal pur dès une occurrence, quel que soit leur nombre', () => {
  assert.deepEqual(tarteelState({ primary: 'S-M-W', constraint: '', primaryFrequency: 352, clusterFrequency: 352 }), { state: 'pur', count: 352 });
  assert.deepEqual(tarteelState({ primary: 'S-M-W', constraint: 'A-R-D.', primaryFrequency: 352, clusterFrequency: 224 }), { state: 'pur', count: 224 });
  assert.deepEqual(tarteelState({ primary: 'S-M-W', constraint: 'N-Z-L', primaryFrequency: 352, clusterFrequency: 47 }), { state: 'pur', count: 47 });
  assert.deepEqual(tarteelState({ primary: 'Q', constraint: 'Y', primaryFrequency: 40, clusterFrequency: 1 }), { state: 'pur', count: 1 });
});

test('sans contrainte, le nombre est celui de la racine primaire ; avec, celui du croisement', () => {
  assert.equal(tarteelState({ primary: 'Q', constraint: '  ', primaryFrequency: 40, clusterFrequency: 3 }).count, 40);
  assert.equal(tarteelState({ primary: 'Q', constraint: 'Y', primaryFrequency: 40, clusterFrequency: 3 }).count, 3);
});

test('aucune occurrence', () => {
  assert.deepEqual(tarteelState({ primary: 'S-M-W', constraint: 'X', primaryFrequency: 352, clusterFrequency: 0 }), { state: 'aucune', count: 0 });
  assert.deepEqual(tarteelState({ primary: 'X-X-X', constraint: '', primaryFrequency: 0, clusterFrequency: 0 }), { state: 'aucune', count: 0 });
});

test('clusterText : la phrase que le corpus reconnaît, au caractère près', () => {
  assert.equal(clusterText('D.-R-B', 'A.-B-D', ['[2:22] : x', '[3:4] : y']),
    'Analyse ce cluster de versets interconnectés (Triangulation : D.-R-B ∩ A.-B-D) :\n\n[2:22] : x\n\n[3:4] : y');
  assert.equal(clusterText(' D.-R-B ', '', ['[2:22] : x']),
    'Analyse ce cluster de versets interconnectés (Triangulation : D.-R-B) :\n\n[2:22] : x');
  assert.equal(clusterText('ض ر ب', ' ع ب د ', ['[2:22] : x']),
    'Analyse ce cluster de versets interconnectés (Triangulation : ض ر ب ∩ ع ب د) :\n\n[2:22] : x');
});

test('clusterText : tous les versets reçus partent, sans coupe', () => {
  const verses = Array.from({ length: 120 }, (_, index) => `[2:${index + 1}] : verset ${index + 1}`);
  const text = clusterText('S-M-W', '', verses);
  assert.ok(text.endsWith('[2:120] : verset 120'));
  assert.equal(text.split('\n\n').length, 121); // la phrase, puis les 120 versets
});

test('pickVerses : les versets cochés, dans l’ordre du cluster', () => {
  const verses = ['a', 'b', 'c', 'd'];
  assert.deepEqual(pickVerses(verses, new Set([2, 0])), ['a', 'c']);
  assert.deepEqual(pickVerses(verses, [3, 3, 1]), ['b', 'd']);
  assert.deepEqual(pickVerses(verses, new Set()), []);
});

test('pickVerses : une case qui ne correspond à aucun verset est ignorée', () => {
  assert.deepEqual(pickVerses(['a', 'b'], new Set([9, -1, 1.5, 1])), ['b']);
  assert.deepEqual(pickVerses(null, new Set([0])), []);
  assert.deepEqual(pickVerses(['a'], null), []);
});

test('clusterVerse : sépare la référence du texte, pour l’affichage', () => {
  assert.deepEqual(clusterVerse('[2:22] : ٱلَّذِى جَعَلَ لَكُمُ'), { reference: '2:22', text: 'ٱلَّذِى جَعَلَ لَكُمُ' });
  assert.deepEqual(clusterVerse('[114:6] :  مِنَ ٱلْجِنَّةِ  '), { reference: '114:6', text: 'مِنَ ٱلْجِنَّةِ' });
  assert.deepEqual(clusterVerse('[1:1] : ﻿بِسْمِ'), { reference: '1:1', text: 'بِسْمِ' });
});

test('clusterVerse : un élément d’une autre forme s’affiche tel quel', () => {
  assert.deepEqual(clusterVerse('texte sans repère'), { reference: '', text: 'texte sans repère' });
  assert.deepEqual(clusterVerse(null), { reference: '', text: '' });
  assert.deepEqual(clusterVerse(42), { reference: '', text: '42' });
});
