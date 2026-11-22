// Fiche d'une racine (lib/root-sheet.js), bâtie sur les réponses réelles de GET /analyze/root/{saisie}
// capturées dans _dev/fixtures/racines.json.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { rootSheet } from '../../assets/js/v2/lib/root-sheet.js';

const FIX = JSON.parse(readFileSync(fileURLToPath(new URL('../fixtures/racines.json', import.meta.url)), 'utf8'));
const answer = (root) => ({ root_data: { root: 'K-T-B', arabic: 'ك ت ب', logic_function: 'WRITE', ...root }, is_decompiled: false, decompilation_data: null });

test('fiche de S-M-W : lettres, code, fonction, définition, équation, dérivations', () => {
  const sheet = rootSheet(FIX['S-M-W']);
  assert.equal(sheet.code, 'S-M-W');
  assert.equal(sheet.arabic, 'س م و');
  assert.ok(sheet.logic.startsWith('GLOBAL_ADDRESS_SPACE'));
  assert.equal(sheet.description, FIX['S-M-W'].root_data.description_clean);
  assert.equal(sheet.equation, FIX['S-M-W'].root_data.physical_equation);
  assert.deepEqual(sheet.tiles.map((tile) => [tile.letter, tile.code]), [['س', 'S'], ['م', 'M'], ['و', 'W']]);
  assert.deepEqual(sheet.opposites, ['A-R-D.']);
  assert.equal(sheet.instances.length, 2);
  assert.deepEqual(sheet.instances[0], { word: 'اسْم', type: 'NOUN', definition: 'Pointeur d\'identification d\'une variable.' });
  assert.equal(sheet.decompiled, null);
});

test('racine opposée : « None », « N/A », vide ou absente, il n’y en a pas', () => {
  assert.deepEqual(rootSheet(FIX['D.-R-B']).opposites, []);
  for (const value of ['None', 'none', 'N/A', '', '   ', null, undefined, 12]) {
    assert.deepEqual(rootSheet(answer({ binary_pair: value })).opposites, [], JSON.stringify(value));
  }
});

test('racine opposée : une ou plusieurs, séparées par « / »', () => {
  assert.deepEqual(rootSheet(answer({ binary_pair: ' A-R-D. ' })).opposites, ['A-R-D.']);
  assert.deepEqual(rootSheet(answer({ binary_pair: 'N-W-R / Z.-L-M' })).opposites, ['N-W-R', 'Z.-L-M']);
  assert.deepEqual(rootSheet(answer({ binary_pair: 'A / None / ' })).opposites, ['A']);
});

test('mot complexe : la décompilation rendue par l’API', () => {
  const bismi = rootSheet(FIX['بِسْمِ']);
  assert.equal(bismi.code, 'S-M-W');
  assert.deepEqual(bismi.decompiled, {
    signal: 'بِسْمِ',
    state: { label: '[BASE_VARIABLE]', tag: 'SYS_BASE', note: 'Noyau fondamental non modifié ou racine pure' },
    inputs: ['[INSTRUMENTAL_BIND]'],
    outputs: [],
    quantifiers: [],
  });
  const verb = rootSheet(FIX['يَضْرِبُونَ']);
  assert.equal(verb.code, 'D.-R-B');
  assert.equal(verb.decompiled.state.label, '[DYNAMIC_EXECUTION]');
  assert.deepEqual(verb.decompiled.quantifiers, ['[PLURAL_STATE]']);
});

test('décompilation sans état connu : l’état de base, comme dans l’app', () => {
  const sheet = rootSheet({ ...answer({}), is_decompiled: true, decompilation_data: { original_signal: 'كتاب', tasreef: null, quantifiers: null, buses: [{ tag: 'X' }, { logic_mod: '[IN]' }], pointers: [{ logic_mod: '[OUT]' }, null] } });
  assert.deepEqual(sheet.decompiled, { signal: 'كتاب', state: { label: '[BASE_VARIABLE]', tag: '', note: '' }, inputs: ['[IN]'], outputs: ['[OUT]'], quantifiers: [] });
  // décompilation annoncée mais absente : pas d'encart
  assert.equal(rootSheet({ ...answer({}), is_decompiled: true, decompilation_data: null }).decompiled, null);
  assert.equal(rootSheet({ ...answer({}), is_decompiled: false, decompilation_data: { original_signal: 'x' } }).decompiled, null);
});

test('fiche incomplète : ce qui manque est vide, rien ne casse', () => {
  const sheet = rootSheet(answer({}));
  assert.deepEqual([sheet.description, sheet.equation, sheet.tiles, sheet.opposites, sheet.instances], ['', '', null, [], []]);
  const odd = rootSheet(answer({ instances: [null, 'x', { word: 'كتاب' }, { word: 'كاتب', type: 'NOUN', definition: 'Agent.' }, {}], description: 'Texte. 🚨 note interne', physical_equation: 'forme libre' }));
  assert.deepEqual(odd.instances, [{ word: 'كتاب', type: '', definition: '' }, { word: 'كاتب', type: 'NOUN', definition: 'Agent.' }]);
  assert.equal(odd.description, 'Texte.');       // sans description_clean : la description, sans sa note interne
  assert.equal(odd.equation, 'forme libre');
  assert.equal(odd.tiles, null);
});

test('réponse sans racine : pas de fiche', () => {
  for (const doubtful of [null, undefined, 'x', {}, { root_data: null }, { root_data: {} }, { root_data: { root: '  ' } }]) {
    assert.equal(rootSheet(doubtful), null, JSON.stringify(doubtful));
  }
});

test('un texte hostile reste un texte : la fiche ne transforme rien', () => {
  const hostile = '<img src=x onerror=alert(1)>';
  const sheet = rootSheet(answer({ description_clean: hostile, logic_function: hostile, binary_pair: hostile }));
  assert.equal(sheet.description, hostile);
  assert.equal(sheet.logic, hostile);
  assert.deepEqual(sheet.opposites, [hostile]);
});
