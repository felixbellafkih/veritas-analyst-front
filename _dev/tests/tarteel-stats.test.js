// Chiffres d'un cluster Tarteel et adresse de la page (lib/tarteel-stats.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { clusterCopyText, indexesOfSura, parseTarteelQuery, suraDistribution, suraOf, tarteelQuery } from '../../assets/js/v1/lib/tarteel-stats.js';

const V = ['[2:22] : a', '[2:164] : b', '[3:5] : c', 'sans repère'];
const REAL = JSON.parse(readFileSync(fileURLToPath(new URL('../fixtures/tarteel.json', import.meta.url)), 'utf8')).clusters['S-M-W|'];

test('suraOf : la sourate d’un verset du cluster, ou rien', () => {
  assert.deepEqual(V.map(suraOf), [2, 2, 3, null]);
  assert.equal(suraOf('[114:6] : x'), 114);
  assert.equal(suraOf(null), null);
});

test('suraDistribution : du plus fourni au moins fourni, puis par numéro de sourate', () => {
  assert.deepEqual(suraDistribution(V), [{ sura: 2, count: 2 }, { sura: 3, count: 1 }]);
  assert.deepEqual(suraDistribution(['[5:1] : a', '[3:1] : b', '[5:2] : c', '[4:1] : d']), [{ sura: 5, count: 2 }, { sura: 3, count: 1 }, { sura: 4, count: 1 }]);
  assert.deepEqual(suraDistribution([]), []);
  assert.deepEqual(suraDistribution(null), []);
});

// Les rangs rendus sont ceux du cluster entier : c'est avec eux que les cases se cochent, filtre ou non
test('indexesOfSura : les rangs, dans le cluster entier, des versets d’une sourate', () => {
  assert.deepEqual(indexesOfSura(V, 2), [0, 1]);
  assert.deepEqual(indexesOfSura(V, 3), [2]);
  assert.deepEqual(indexesOfSura(V, 9), []);
  assert.deepEqual(indexesOfSura(V, null), [0, 1, 2, 3]);
});

test('le cluster réel de S-M-W : 352 versets dans 81 sourates', () => {
  const distribution = suraDistribution(REAL);
  assert.equal(REAL.length, 352);
  assert.equal(distribution.length, 81);
  assert.equal(distribution.reduce((sum, entry) => sum + entry.count, 0), 352);
  assert.deepEqual(distribution[0], { sura: 6, count: 18 });
  assert.equal(indexesOfSura(REAL, 6).length, 18);
});

test('clusterCopyText : un verset par ligne, tel que l’API le donne', () => {
  assert.equal(clusterCopyText(['[2:22] : a', '[3:5] : c']), '[2:22] : a\n[3:5] : c');
  assert.equal(clusterCopyText([]), '');
  assert.equal(clusterCopyText(null), '');
});

test('adresse de la page Tarteel : les racines y voyagent, la sélection jamais', () => {
  assert.equal(tarteelQuery({ primary: 'S-M-W', constraint: '' }), '?p=S-M-W');
  assert.equal(tarteelQuery({ primary: ' S-M-W ', constraint: ' N-Z-L ' }), '?p=S-M-W&c=N-Z-L');
  assert.equal(tarteelQuery({ primary: '', constraint: 'N-Z-L' }), '');
  assert.equal(tarteelQuery({ primary: 'ض ر ب' }), `?p=${encodeURIComponent('ض ر ب')}`);
  assert.deepEqual(parseTarteelQuery('?p=S-M-W&c=N-Z-L'), { primary: 'S-M-W', constraint: 'N-Z-L' });
  assert.deepEqual(parseTarteelQuery('?p=%20S-M-W%20'), { primary: 'S-M-W', constraint: '' });
  assert.deepEqual(parseTarteelQuery('?x=1'), { primary: '', constraint: '' });
  assert.deepEqual(parseTarteelQuery(''), { primary: '', constraint: '' });
  assert.equal(parseTarteelQuery(`?p=${'a'.repeat(300)}`).primary.length, 100);
  const arabic = { primary: 'ض ر ب', constraint: 'ع ب د' };
  assert.deepEqual(parseTarteelQuery(tarteelQuery(arabic)), arabic);
});
