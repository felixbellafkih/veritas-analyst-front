// Fichiers de contenu de la Bibliothèque (assets/bibliotheque/<code>.json) : la thèse et les volets de
// gouvernance, un fichier par langue. Ils sont écrits par la publication du corpus (export_corpus.py du
// Kernel) : le français depuis les fichiers de l'auteur, les autres langues depuis le catalogue de l'app.
// Ces contrôles sont mécaniques : ils ne jugent ni les mots ni les traductions.
// Un chapitre absent d'une langue n'est pas une faute ici : la page l'affiche alors en français.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('../../assets/bibliotheque', import.meta.url));
const LANGUAGES = fileURLToPath(new URL('../../assets/i18n/langues.json', import.meta.url));
const CHAPTERS = ['introduction', 'phase-1', 'phase-2', 'phase-3'];
const PANELS = ['1', '2', '3', '4'];

const codes = JSON.parse(readFileSync(LANGUAGES, 'utf8')).map((language) => language.code).sort();
const names = existsSync(DIR) ? readdirSync(DIR).sort() : [];
const contents = names.map((name) => [name.slice(0, -'.json'.length), JSON.parse(readFileSync(join(DIR, name), 'utf8'))]);
const wrapperLine = /^\s*<\/?div\b[^>]*>\s*$/;

test('un fichier de contenu par langue du site, et rien d’autre dans le dossier', () => {
  assert.equal(codes.length, 70);
  assert.deepEqual(names, codes.map((code) => `${code}.json`));
});

test('chaque fichier se lit et porte sa langue, la thèse et la gouvernance', () => {
  assert.equal(contents.length, 70);
  for (const [code, content] of contents) {
    assert.deepEqual(Object.keys(content), ['lang', 'these', 'gouvernance'], code);
    assert.equal(content.lang, code);
    for (const part of ['these', 'gouvernance']) {
      assert.ok(content[part] && typeof content[part] === 'object' && !Array.isArray(content[part]), `${code} ${part}`);
    }
  }
});

test('le français porte les quatre chapitres et les quatre volets, non vides', () => {
  const french = Object.fromEntries(contents).fr;
  assert.ok(french, 'fr.json');
  assert.deepEqual(Object.keys(french.these), CHAPTERS);
  assert.deepEqual(Object.keys(french.gouvernance), PANELS);
  for (const text of [...Object.values(french.these), ...Object.values(french.gouvernance)]) {
    assert.ok(text.trim().length > 100);
  }
});

test('aucune clé inconnue, aucune valeur qui ne soit un texte non vide', () => {
  const faults = [];
  for (const [code, content] of contents) {
    for (const [part, known] of [['these', CHAPTERS], ['gouvernance', PANELS]]) {
      for (const [key, value] of Object.entries(content[part] || {})) {
        if (!known.includes(key)) faults.push(`${code} ${part} ${key} : clé inconnue`);
        if (typeof value !== 'string' || !value.trim()) faults.push(`${code} ${part} ${key} : pas un texte`);
      }
    }
  }
  assert.deepEqual(faults, []);
});

test('les clés suivent l’ordre de lecture', () => {
  const ordered = (keys, known) => keys.join(' ') === known.filter((key) => keys.includes(key)).join(' ');
  for (const [code, content] of contents) {
    assert.ok(ordered(Object.keys(content.these), CHAPTERS), `${code} these`);
    assert.ok(ordered(Object.keys(content.gouvernance), PANELS), `${code} gouvernance`);
  }
});

test('aucun texte ne garde une ligne faite d’une seule balise <div> ou </div>', () => {
  const faults = [];
  for (const [code, content] of contents) {
    for (const part of ['these', 'gouvernance']) {
      for (const [key, value] of Object.entries(content[part] || {})) {
        if (String(value).split('\n').some((line) => wrapperLine.test(line))) faults.push(`${code} ${part} ${key}`);
      }
    }
  }
  assert.deepEqual(faults, []);
});

test('aucun texte ne porte de retour chariot', () => {
  for (const name of names) assert.ok(!readFileSync(join(DIR, name), 'utf8').includes('\r'), name);
});
