import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SURAS, clampRange, cleanVerseText, parsePassageQuery, passageQuery, referenceLabel, resultTitle } from '../../assets/js/v4/lib/verses.js';

test('SURAS : 114 sourates, 6236 versets', () => {
  assert.equal(SURAS.length, 114);
  assert.equal(SURAS.reduce((total, sura) => total + sura.verses, 0), 6236);
  assert.deepEqual(SURAS[0], { n: 1, name: 'Al-Fatihah', verses: 7 });
  assert.equal(SURAS[1].verses, 286);
  assert.deepEqual(SURAS[113], { n: 114, name: 'An-Nas', verses: 6 });
  assert.deepEqual(SURAS.map((sura) => sura.n), Array.from({ length: 114 }, (_, index) => index + 1));
});

test('clampRange : dans la sourate, 10 versets au plus', () => {
  assert.deepEqual(clampRange(1, 1, 1), { start: 1, end: 1 });
  assert.deepEqual(clampRange(1, 5, 30), { start: 5, end: 7 });
  assert.deepEqual(clampRange(2, 1, 30), { start: 1, end: 10 });
  assert.deepEqual(clampRange(2, 280, 300), { start: 280, end: 286 });
  assert.deepEqual(clampRange(2, 999, 999), { start: 286, end: 286 });
});

test('clampRange : valeurs absentes ou incohérentes ramenées à un verset valable', () => {
  assert.deepEqual(clampRange(2, 0, 0), { start: 1, end: 1 });
  assert.deepEqual(clampRange(2, 5, 3), { start: 5, end: 5 });
  assert.deepEqual(clampRange(2, 'abc', undefined), { start: 1, end: 1 });
  assert.deepEqual(clampRange(2, -4, 2), { start: 1, end: 2 });
  assert.deepEqual(clampRange(2, 3.9, 5.2), { start: 3, end: 5 });
});

test('clampRange : sourate inconnue', () => {
  assert.equal(clampRange(115, 1, 1), null);
  assert.equal(clampRange(0, 1, 1), null);
  assert.equal(clampRange('x', 1, 1), null);
  assert.equal(clampRange(undefined, 1, 1), null);
  assert.equal(clampRange(1.5, 1, 1), null);
});

test('cleanVerseText : retire U+FEFF, et rien d’autre', () => {
  assert.equal(cleanVerseText('﻿بِسْمِ ٱللَّهِ'), 'بِسْمِ ٱللَّهِ');
  assert.equal(cleanVerseText(' a ﻿ b '), ' a  b ');
  assert.equal(cleanVerseText(null), '');
});

test('passageQuery et parsePassageQuery : le passage voyage dans l’adresse, en nombres', () => {
  assert.equal(passageQuery({ sura: 2, start: 255, end: 255 }), '?s=2&de=255&a=255');
  assert.deepEqual(parsePassageQuery('?s=2&de=255&a=255'), { sura: 2, start: 255, end: 255 });
  assert.deepEqual(parsePassageQuery(passageQuery({ sura: 1, start: 1, end: 7 })), { sura: 1, start: 1, end: 7 });
  assert.deepEqual(parsePassageQuery('?lang=en&s=2&de=1&a=5'), { sura: 2, start: 1, end: 5 });
});

test('parsePassageQuery : valeurs ramenées dans les bornes', () => {
  assert.deepEqual(parsePassageQuery('?s=2&de=280&a=999'), { sura: 2, start: 280, end: 286 });
  assert.deepEqual(parsePassageQuery('?s=2'), { sura: 2, start: 1, end: 1 });
  assert.deepEqual(parsePassageQuery('?s=2&de=5'), { sura: 2, start: 5, end: 5 });
  assert.deepEqual(parsePassageQuery('?s=2&de=abc&a=3'), { sura: 2, start: 1, end: 3 });
});

test('parsePassageQuery : pas de passage, ou sourate qui n’est pas un nombre valable', () => {
  for (const search of ['', '?', '?s=abc', '?s=115&de=1&a=1', '?s=0', '?s=1e2', '?s=-1', '?s=<script>', '?de=1&a=2']) {
    assert.equal(parsePassageQuery(search), null, search);
  }
  assert.equal(parsePassageQuery(undefined), null);
});

test('referenceLabel et resultTitle', () => {
  assert.equal(referenceLabel({ sura: 1, start: 1, end: 1 }), '1:1');
  assert.equal(referenceLabel({ sura: 2, start: 1, end: 5 }), '2:1-5');
  assert.equal(resultTitle({ sura: 1, start: 1, end: 1 }), 'Al-Fatihah 1:1');
  assert.equal(resultTitle({ sura: 2, start: 1, end: 5 }), 'Al-Baqarah 2:1-5');
});
