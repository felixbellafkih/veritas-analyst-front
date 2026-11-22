// Liste des racines du Scanner (lib/roots-index.js) : lecture du fichier livré par le site, et recherche.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { filterRoots, foldArabic, parseRootsIndex, scannerHref, scannerQuery, searchRoots } from '../../assets/js/v1/lib/roots-index.js';

const INDEX = parseRootsIndex({ roots: [
  ['S-M-W', 'س م و', 'GLOBAL_ADDRESS_SPACE // STACK_LAYER'],
  ['S-M-A.', 'س م ع', 'AUDIO_INPUT'],
  ['A-R-D.', 'أ ر ض', 'LOCAL_HOST'],
  ['D.-R-B', 'ض ر ب', 'IMPACT'],
  ['A-B-D', 'أ ب د', 'INFINITE_LOOP'],
  ['A.-B-D', 'ع ب د', 'WORKER_PROCESS'],
] });
const codes = (found) => found.map((entry) => entry.code);

test('parseRootsIndex : une entrée par ligne bien formée', () => {
  assert.deepEqual(INDEX[0], { code: 'S-M-W', arabic: 'س م و', logic: 'GLOBAL_ADDRESS_SPACE // STACK_LAYER' });
  assert.equal(INDEX.length, 6);
});

test('parseRootsIndex : un contenu douteux ne casse rien', () => {
  for (const doubtful of [null, undefined, 'x', 12, [], {}, { roots: 'x' }, { roots: null }]) assert.deepEqual(parseRootsIndex(doubtful), []);
  const mixed = parseRootsIndex({ roots: [['X'], null, 'S-M-W', ['', 'a', 'b'], [12, 'a', 'b'], ['K-T-B', 'ك ت ب', 'WRITE'], ['Q-R-A', 'ق ر أ', null]] });
  assert.deepEqual(mixed, [{ code: 'K-T-B', arabic: 'ك ت ب', logic: 'WRITE' }]);
});

test('foldArabic : sans signes, sans espaces, alifs ramenés à un seul', () => {
  assert.equal(foldArabic('بِسْمِ'), 'بسم');
  assert.equal(foldArabic('س م و'), 'سمو');
  assert.equal(foldArabic('أ ر ض'), 'ارض');
  assert.equal(foldArabic('ٱلرَّحْمَٰنِ'), 'الرحمن');
  assert.equal(foldArabic('سـمـو'), 'سمو');
  assert.equal(foldArabic(null), '');
});

test('searchRoots : par le code, quelle que soit la casse', () => {
  assert.deepEqual(codes(searchRoots(INDEX, 's-m-w')), ['S-M-W']);
  assert.deepEqual(codes(searchRoots(INDEX, ' S-M-W ')), ['S-M-W']);
  assert.deepEqual(codes(searchRoots(INDEX, 'S-M')), ['S-M-W', 'S-M-A.']);
});

test('searchRoots : lettres collées, et le code exact passe devant son voisin', () => {
  assert.deepEqual(codes(searchRoots(INDEX, 'smw')), ['S-M-W']);
  assert.deepEqual(codes(searchRoots(INDEX, 'sm')), ['S-M-W', 'S-M-A.']);
  assert.deepEqual(codes(searchRoots(INDEX, 'a.-b-d')), ['A.-B-D', 'A-B-D']);
  assert.deepEqual(codes(searchRoots(INDEX, 'a-b-d')), ['A-B-D', 'A.-B-D']);
});

test('searchRoots : par les lettres arabes, avec ou sans espaces ni signes', () => {
  assert.deepEqual(codes(searchRoots(INDEX, 'سمو')), ['S-M-W']);
  assert.deepEqual(codes(searchRoots(INDEX, 'س م')), ['S-M-W', 'S-M-A.']);
  assert.deepEqual(codes(searchRoots(INDEX, 'ارض')), ['A-R-D.']);
  assert.deepEqual(codes(searchRoots(INDEX, 'ضَرَبَ')), ['D.-R-B']);
});

test('searchRoots : un mot complexe ne correspond à aucune racine de la liste (l’API le décompile)', () => {
  assert.deepEqual(searchRoots(INDEX, 'بِسْمِ'), []);
});

test('searchRoots : par la fonction, à partir de deux caractères', () => {
  assert.deepEqual(codes(searchRoots(INDEX, 'host')), ['A-R-D.']);
  assert.deepEqual(codes(searchRoots(INDEX, 'stack')), ['S-M-W']);
  assert.deepEqual(searchRoots(INDEX, 'x'), []);
});

test('searchRoots : saisie vide, limite, liste absente', () => {
  assert.deepEqual(searchRoots(INDEX, '   '), []);
  assert.deepEqual(searchRoots(INDEX, null), []);
  assert.deepEqual(searchRoots([], 'S-M-W'), []);
  assert.equal(searchRoots(INDEX, 'a', 2).length, 2);
  const many = parseRootsIndex({ roots: Array.from({ length: 30 }, (_, index) => [`S-M-${index}`, 'س م', 'X']) });
  assert.equal(searchRoots(many, 's-m').length, 8);
});

test('filterRoots : la même correspondance, sans limite, dans l’ordre de la liste', () => {
  assert.equal(filterRoots(INDEX, '').length, 6);
  assert.equal(filterRoots(INDEX, '   ').length, 6);
  assert.deepEqual(codes(filterRoots(INDEX, 'b-d')), []);
  assert.deepEqual(codes(filterRoots(INDEX, 'a')), ['A-R-D.', 'A-B-D', 'A.-B-D']);
  assert.deepEqual(codes(filterRoots(INDEX, 'loop')), ['A-B-D']);
});

test('adresse du Scanner : la saisie y voyage encodée, et revient propre', () => {
  assert.equal(scannerHref('S-M-W'), '/scanner/?q=S-M-W');
  assert.equal(scannerHref('بِسْمِ'), `/scanner/?q=${encodeURIComponent('بِسْمِ')}`);
  assert.equal(scannerHref(' A.-B-D '), '/scanner/?q=A.-B-D');
  assert.equal(scannerQuery('?q=%20S-M-W%20'), 'S-M-W');
  assert.equal(scannerQuery(`?q=${encodeURIComponent('بِسْمِ')}`), 'بِسْمِ');
  assert.equal(scannerQuery('?x=1'), '');
  assert.equal(scannerQuery(''), '');
  assert.equal(scannerQuery(`?q=${'a'.repeat(300)}`).length, 100);
});

test('le fichier livré par le site : 1 994 racines, et la recherche y trouve S-M-W', () => {
  const file = fileURLToPath(new URL('../../assets/data/racines.json', import.meta.url));
  const real = parseRootsIndex(JSON.parse(readFileSync(file, 'utf8')));
  assert.equal(real.length, 1994);
  assert.equal(new Set(real.map((entry) => entry.code)).size, 1994);
  assert.equal(searchRoots(real, 's-m-w')[0].code, 'S-M-W');
  assert.equal(searchRoots(real, 'سمو')[0].code, 'S-M-W');
  assert.ok(real.every((entry) => entry.arabic && entry.logic !== undefined));
});
