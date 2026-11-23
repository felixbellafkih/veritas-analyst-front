// Fichiers de langue du site (assets/i18n/<code>.json). Ces traductions sont faites par une machine : ces
// contrôles sont mécaniques, ils ne jugent pas les mots.
// Relecture de l'étape 3 : en afrikaans, un saut de ligne avait pris la place du « · » d'un texte, et le
// contrôle fait à la main ne l'avait pas vu.
// Un texte du site pas encore traduit n'est pas une faute ici : il s'affiche en français en attendant.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('../../assets/i18n', import.meta.url));
const files = readdirSync(DIR).filter((name) => name.endsWith('.json') && name !== 'langues.json').sort();
const tables = files.map((name) => [name.slice(0, -'.json'.length), JSON.parse(readFileSync(join(DIR, name), 'utf8'))]);
const markers = (text) => (text.match(/\{[a-z]+\}/g) || []).sort().join(' ');
const short = (text) => text.slice(0, 50);

test('les 69 fichiers de langue se lisent, et chaque traduction est un texte', () => {
  assert.equal(tables.length, 69);
  for (const [code, table] of tables) {
    assert.ok(table && typeof table === 'object' && !Array.isArray(table), code);
    for (const [source, value] of Object.entries(table)) assert.equal(typeof value, 'string', `${code} « ${short(source)} »`);
  }
});

test('aucune traduction ne perd ni n’invente un repère ({n}, {total}…)', () => {
  const faults = [];
  for (const [code, table] of tables) {
    for (const [source, value] of Object.entries(table)) {
      if (markers(source) !== markers(value)) faults.push(`${code} « ${short(source)} »`);
    }
  }
  assert.deepEqual(faults, []);
});

test('aucune traduction n’ajoute de saut de ligne', () => {
  const faults = [];
  for (const [code, table] of tables) {
    for (const [source, value] of Object.entries(table)) {
      if (!/[\r\n]/.test(source) && /[\r\n]/.test(value)) faults.push(`${code} « ${short(source)} »`);
    }
  }
  assert.deepEqual(faults, []);
});
