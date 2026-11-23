// La mise en forme, éprouvée sur toutes les analyses publiées du corpus (français et anglais).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { outline, parseMarkdown, plainText } from '../../assets/js/v3/lib/markdown.js';

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]+/g;
const arabicOf = (text) => (text.match(ARABIC) || []).join('');
const lettersOf = (text) => (text.match(/[\p{L}\p{N}]+/gu) || []).join('');

const corpus = readFileSync(new URL('../../corpus/data/veritas_corpus.jsonl', import.meta.url), 'utf8')
  .split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line));
const texts = [];
for (const entry of corpus) {
  if (entry.analysis) texts.push([`${entry.reference} (fr)`, entry.analysis]);
  if (entry.analysis_en) texts.push([`${entry.reference} (en)`, entry.analysis_en]);
}

test('le corpus est là', () => {
  assert.ok(texts.length >= 30, `${texts.length} textes`);
});

for (const [name, source] of texts) {
  test(`corpus ${name}`, () => {
    const blocks = parseMarkdown(source);
    const expected = source.split('\n').filter((line) => line.startsWith('### ')).length;
    assert.equal(blocks.filter((block) => block.type === 'heading' && block.level === 3).length, expected, 'titres de niveau 3');
    assert.equal(outline(blocks).length, expected, 'sommaire');
    const flat = plainText(blocks);
    // Aucun caractère arabe perdu, ajouté ou déplacé
    assert.equal(arabicOf(flat), arabicOf(source), 'texte arabe');
    // Aucune lettre ni aucun chiffre perdu : seules les marques de mise en forme disparaissent
    assert.equal(lettersOf(flat), lettersOf(source), 'lettres et chiffres');
    // Chaque tableau garde ses lignes
    const tableLines = source.split('\n').filter((line) => line.trim().startsWith('|')).length;
    const tables = blocks.filter((block) => block.type === 'table');
    assert.equal(tables.reduce((total, table) => total + table.rows.length + 2, 0), tableLines, 'lignes de tableau');
  });
}
