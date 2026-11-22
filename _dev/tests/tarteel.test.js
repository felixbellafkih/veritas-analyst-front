import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CEILING, SENT_LIMIT, clusterText, clusterVerse, tarteelState } from '../../assets/js/lib/tarteel.js';

test('seuils : plafond de 57 occurrences, 30 versets envoyés', () => {
  assert.equal(CEILING, 57);
  assert.equal(SENT_LIMIT, 30);
});

test('pas de racine primaire : rien à dire', () => {
  assert.equal(tarteelState({ primary: '', constraint: '', primaryFrequency: 0, clusterFrequency: 0 }).state, 'vide');
  assert.equal(tarteelState({ primary: '   ', constraint: 'X', primaryFrequency: 9, clusterFrequency: 9 }).state, 'vide');
});

test('fréquences pas encore connues : rien à dire', () => {
  assert.equal(tarteelState({ primary: 'S-M-W', constraint: '' }).state, 'vide');
});

test('surcharge : racine au-dessus du plafond, sans contrainte', () => {
  assert.deepEqual(tarteelState({ primary: 'S-M-W', constraint: '', primaryFrequency: 352, clusterFrequency: 352 }),
    { state: 'surcharge', count: 352, constraintRequired: true });
  assert.equal(tarteelState({ primary: 'S-M-W', constraint: '  ', primaryFrequency: 58, clusterFrequency: 58 }).state, 'surcharge');
});

test('triangulation insuffisante : le cluster dépasse encore le plafond', () => {
  assert.deepEqual(tarteelState({ primary: 'S-M-W', constraint: 'A-R-D.', primaryFrequency: 352, clusterFrequency: 224 }),
    { state: 'insuffisant', count: 224, constraintRequired: true });
  assert.equal(tarteelState({ primary: 'S-M-W', constraint: 'X', primaryFrequency: 352, clusterFrequency: 58 }).state, 'insuffisant');
});

test('signal pur : de 1 à 57 occurrences', () => {
  assert.deepEqual(tarteelState({ primary: 'S-M-W', constraint: 'X', primaryFrequency: 352, clusterFrequency: 57 }),
    { state: 'pur', count: 57, constraintRequired: true });
  assert.deepEqual(tarteelState({ primary: 'Q', constraint: '', primaryFrequency: 40, clusterFrequency: 40 }),
    { state: 'pur', count: 40, constraintRequired: false });
  assert.equal(tarteelState({ primary: 'Q', constraint: '', primaryFrequency: 57, clusterFrequency: 57 }).state, 'pur');
  assert.equal(tarteelState({ primary: 'Q', constraint: 'Y', primaryFrequency: 40, clusterFrequency: 1 }).state, 'pur');
});

test('aucune occurrence', () => {
  assert.deepEqual(tarteelState({ primary: 'S-M-W', constraint: 'X', primaryFrequency: 352, clusterFrequency: 0 }),
    { state: 'aucune', count: 0, constraintRequired: true });
  assert.equal(tarteelState({ primary: 'X-X-X', constraint: '', primaryFrequency: 0, clusterFrequency: 0 }).state, 'aucune');
});

test('clusterText : la phrase que le corpus reconnaît, au caractère près', () => {
  assert.equal(clusterText('D.-R-B', 'A.-B-D', ['[2:22] : x', '[3:4] : y']),
    'Analyse ce cluster de versets interconnectés (Triangulation : D.-R-B ∩ A.-B-D) :\n\n[2:22] : x\n\n[3:4] : y');
  assert.equal(clusterText(' D.-R-B ', '', ['[2:22] : x']),
    'Analyse ce cluster de versets interconnectés (Triangulation : D.-R-B) :\n\n[2:22] : x');
  assert.equal(clusterText('ض ر ب', ' ع ب د ', ['[2:22] : x']),
    'Analyse ce cluster de versets interconnectés (Triangulation : ض ر ب ∩ ع ب د) :\n\n[2:22] : x');
});

test('clusterText : 30 versets au plus', () => {
  const verses = Array.from({ length: 31 }, (_, index) => `[2:${index + 1}] : verset ${index + 1}`);
  const text = clusterText('S-M-W', 'N-Z-L', verses);
  assert.ok(text.includes('verset 30'));
  assert.ok(!text.includes('verset 31'));
  assert.equal(text.split('\n\n').length, 31); // la phrase, puis 30 versets
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
