// Polices hébergées sur le site (assets/fonts) et leurs déclarations (assets/css/base.css).
// Aucun appel à Google Fonts ni à un autre site : les fichiers sont dans le dépôt, avec leur licence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = fileURLToPath(new URL('../..', import.meta.url));
const FONTS = join(SITE, 'assets', 'fonts');
const STYLES = join(SITE, 'assets', 'css');
const css = readFileSync(join(STYLES, 'base.css'), 'utf8');

const value = (body, name) => {
  const match = new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(body);
  return match ? match[1].trim().replace(/\s+/g, ' ') : '';
};
const faces = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(([, body]) => ({
  family: value(body, 'font-family').replace(/"/g, ''),
  weight: value(body, 'font-weight'),
  style: value(body, 'font-style'),
  display: value(body, 'font-display'),
  src: value(body, 'src'),
  range: value(body, 'unicode-range'),
}));
const fileOf = (face) => {
  const match = /^url\("\.\.\/fonts\/([a-z0-9-]+\.woff2)"\) format\("woff2"\)$/.exec(face.src);
  return match ? match[1] : null;
};
const weights = (family) => [...new Set(faces.filter((face) => face.family === family).map((face) => face.weight))].sort();
const hosted = existsSync(FONTS) ? readdirSync(FONTS).filter((name) => name.endsWith('.woff2')).sort() : [];

test('les quatre familles de la conception sont déclarées, avec les graisses que leurs fichiers offrent', () => {
  assert.deepEqual([...new Set(faces.map((face) => face.family))].sort(), ['Amiri', 'Inter', 'JetBrains Mono', 'Space Grotesk']);
  assert.deepEqual(weights('Inter'), ['100 900']);
  assert.deepEqual(weights('Space Grotesk'), ['300 700']);
  assert.deepEqual(weights('JetBrains Mono'), ['400 800']);
  assert.deepEqual(weights('Amiri'), ['400', '700']);
});

test('les familles déclarées sont celles que les styles demandent en premier', () => {
  for (const [variable, family] of [['--police-titres', 'Space Grotesk'], ['--police-texte', 'Inter'], ['--police-codes', 'JetBrains Mono'], ['--police-arabe', 'Amiri']]) {
    assert.match(css, new RegExp(`${variable}:\\s*"${family}"`), variable);
  }
});

test('chaque déclaration : un fichier du site, le texte affiché sans attendre la police, une plage de caractères', () => {
  assert.equal(faces.length, 16);
  for (const face of faces) {
    const file = fileOf(face);
    assert.ok(file, `source inattendue : ${face.src}`);
    assert.ok(existsSync(join(FONTS, file)), `fichier absent : ${file}`);
    assert.equal(face.display, 'swap', file);
    assert.equal(face.style, 'normal', file);
    assert.match(face.range, /^U\+[0-9A-F]{4}/, file);
  }
});

test('chaque fichier de police est un WOFF2, déclaré une seule fois', () => {
  assert.equal(hosted.length, 16);
  assert.deepEqual(faces.map(fileOf).sort(), hosted);
  assert.equal(new Set(hosted).size, hosted.length);
  for (const file of hosted) assert.equal(readFileSync(join(FONTS, file)).toString('latin1', 0, 4), 'wOF2', file);
});

// Un fichier ne se charge que si la page affiche un caractère de sa plage : les plages d'une même famille
// et d'une même graisse ne doivent donc pas se recouvrir sur les caractères courants
test('la police arabe : une plage pour l’écriture arabe, une pour l’espace et la ponctuation', () => {
  const amiri = faces.filter((face) => face.family === 'Amiri' && face.weight === '400');
  assert.equal(amiri.length, 2);
  const arabic = amiri.find((face) => face.range.includes('U+0600-06FF'));
  const latin = amiri.find((face) => face.range.startsWith('U+0000-00FF'));
  assert.ok(arabic && latin && arabic !== latin);
  assert.ok(!arabic.range.includes('U+0000'), 'la plage arabe ne couvre pas le latin');
  assert.ok(!latin.range.includes('U+0600'), 'la plage latine ne couvre pas l’arabe');
});

test('aucune feuille de style n’appelle un autre site', () => {
  for (const name of readdirSync(STYLES).filter((file) => file.endsWith('.css'))) {
    const source = readFileSync(join(STYLES, name), 'utf8');
    assert.doesNotMatch(source, /@import/, name);
    for (const [, target] of source.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
      assert.match(target, /^\.\.\/(fonts|img)\/[a-z0-9.-]+$/, `${name} : ${target}`);
    }
  }
});

// La liste des langues de la réponse montre soixante-dix noms, chacun dans sa propre écriture. Dans la police
// du site, elle ferait charger à chaque visite les fichiers cyrillique, grec et vietnamien pour ces seuls noms.
test('la liste des langues de la réponse s’affiche dans la police de l’appareil', () => {
  const rule = /\.saisie--langues\s*\{([^}]*)\}/.exec(readFileSync(join(STYLES, 'composants.css'), 'utf8'));
  assert.ok(rule, 'règle .saisie--langues absente');
  const family = value(rule[1], 'font-family');
  assert.match(family, /^system-ui,/);
  for (const name of new Set(faces.map((face) => face.family))) assert.ok(!family.includes(name), `police du site : ${name}`);

  const version = readdirSync(join(SITE, 'assets', 'js')).find((name) => /^v\d+$/.test(name));
  const form = readFileSync(join(SITE, 'assets', 'js', version, 'ui', 'passage-form.js'), 'utf8');
  const select = /el\('select', \{ class: '([^']*)', attrs: \{ id: 'langue-reponse' \} \}\)/.exec(form);
  assert.ok(select, 'liste des langues de la réponse introuvable');
  assert.ok(select[1].split(' ').includes('saisie--langues'), select[1]);
});

test('licences : le texte de la licence libre et les auteurs de chaque police accompagnent les fichiers', () => {
  const licences = readFileSync(join(FONTS, 'LICENCES.txt'), 'utf8');
  assert.ok(licences.includes('SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007'));
  assert.ok(licences.includes('PERMISSION & CONDITIONS'));
  for (const notice of [
    'Copyright 2016 The Inter Project Authors (https://github.com/rsms/inter)',
    'Copyright 2020 The Space Grotesk Project Authors (https://github.com/floriankarsten/space-grotesk)',
    'Copyright 2020 The JetBrains Mono Project Authors (https://github.com/JetBrains/JetBrainsMono)',
    'Copyright 2010-2022 The Amiri Project Authors (https://github.com/aliftype/amiri).',
  ]) assert.ok(licences.includes(notice), notice);
  for (const file of hosted) assert.ok(licences.includes(file), `fichier non cité : ${file}`);
});
