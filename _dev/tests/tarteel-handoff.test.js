// Sélection reportée de la page Tarteel à l'Interpréteur (lib/tarteel-handoff.js).
// Le report ne porte que des références : dans l'Interpréteur, le cluster est relu, et seules les
// références retrouvées dans CE cluster, pour CES racines, se cochent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyHandoff, handoffSlot, makeHandoff } from '../../assets/js/v1/lib/tarteel-handoff.js';

const V = ['[2:22] : a', '[2:164] : b', '[3:5] : c'];

test('makeHandoff : les racines et les références des versets cochés, dans l’ordre du cluster', () => {
  assert.deepEqual(makeHandoff(' S-M-W ', 'N-Z-L', V, [2, 0]), { primary: 'S-M-W', constraint: 'N-Z-L', references: ['2:22', '3:5'] });
  assert.deepEqual(makeHandoff('S-M-W', '  ', V, new Set([1])), { primary: 'S-M-W', constraint: '', references: ['2:164'] });
  assert.deepEqual(makeHandoff('S-M-W', '', V, []), { primary: 'S-M-W', constraint: '', references: [] });
});

test('makeHandoff : un verset sans référence, ou un rang hors du cluster, n’est pas reporté', () => {
  assert.deepEqual(makeHandoff('X', '', ['texte sans repère', '[4:1] : d'], [0, 1, 7, -1]).references, ['4:1']);
});

test('applyHandoff : les rangs à cocher dans le cluster relu', () => {
  const report = makeHandoff('S-M-W', 'N-Z-L', V, [2, 0]);
  assert.deepEqual(applyHandoff(report, 'S-M-W', 'N-Z-L', V), [0, 2]);
  assert.deepEqual(applyHandoff(report, ' S-M-W ', ' N-Z-L ', V), [0, 2]);
});

test('applyHandoff : d’autres racines, rien ne se coche', () => {
  const report = makeHandoff('S-M-W', 'N-Z-L', V, [0, 1, 2]);
  assert.deepEqual(applyHandoff(report, 'S-M-W', '', V), []);
  assert.deepEqual(applyHandoff(report, 'S-M-A.', 'N-Z-L', V), []);
  assert.deepEqual(applyHandoff(report, 's-m-w', 'N-Z-L', V), []); // la saisie est comparée telle quelle
});

test('applyHandoff : le cluster a changé entre-temps, seules les références retrouvées se cochent', () => {
  const report = makeHandoff('S-M-W', 'N-Z-L', V, [0, 2]);
  assert.deepEqual(applyHandoff(report, 'S-M-W', 'N-Z-L', ['[9:1] : x', '[3:5] : c', 'sans repère']), [1]);
  assert.deepEqual(applyHandoff(report, 'S-M-W', 'N-Z-L', []), []);
});

test('applyHandoff : un report absent ou douteux ne coche rien', () => {
  for (const doubtful of [null, undefined, 'x', 12, [], {}, { primary: 'S-M-W', constraint: 'N-Z-L' },
    { primary: 'S-M-W', constraint: 'N-Z-L', references: 'x' }, { primary: 12, constraint: '', references: ['2:22'] }]) {
    assert.deepEqual(applyHandoff(doubtful, 'S-M-W', 'N-Z-L', V), [], JSON.stringify(doubtful));
  }
  // des références qui ne sont pas des textes sont ignorées
  assert.deepEqual(applyHandoff({ primary: 'S-M-W', constraint: 'N-Z-L', references: [null, 12, '3:5'] }, 'S-M-W', 'N-Z-L', V), [2]);
});

// Relecture de l'étape 2 : le report était lu dans l'onglet au premier cluster prêt. Si ce cluster n'arrivait
// pas (serveur en panne), le report restait dans l'onglet et cochait des versets bien plus tard, pour les
// mêmes racines. Il est maintenant pris une fois, à l'ouverture de la page, et tenu ici.
test('handoffSlot : le report sert au premier cluster prêt, puis plus jamais', () => {
  const slot = handoffSlot(makeHandoff('S-M-W', 'N-Z-L', V, [0, 2]));
  assert.deepEqual(slot.take('S-M-W', 'N-Z-L', V), [0, 2]);
  assert.deepEqual(slot.take('S-M-W', 'N-Z-L', V), []);
});

test('handoffSlot : un premier cluster fait pour d’autres racines consomme le report sans rien cocher', () => {
  const slot = handoffSlot(makeHandoff('S-M-W', 'N-Z-L', V, [0, 2]));
  assert.deepEqual(slot.take('S-M-W', '', V), []);
  assert.deepEqual(slot.take('S-M-W', 'N-Z-L', V), []);
});

test('handoffSlot : sans report, rien ne se coche', () => {
  assert.deepEqual(handoffSlot(null).take('S-M-W', '', V), []);
  assert.deepEqual(handoffSlot(undefined).take('S-M-W', '', V), []);
});
