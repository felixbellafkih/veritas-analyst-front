// Collecte des textes français du site (_dev/textes.mjs) : ce sont eux que l'auteur valide, puis qu'on traduit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectTexts } from '../textes.mjs';

const SITE = fileURLToPath(new URL('../..', import.meta.url));

async function withSite(files, check) {
  const root = await mkdtemp(join(tmpdir(), 'veritas-textes-'));
  try {
    for (const [name, content] of Object.entries(files)) {
      await mkdir(dirname(join(root, name)), { recursive: true });
      await writeFile(join(root, name), content, 'utf8');
    }
    await check(await collectTexts(root));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('textes des modules et des pages, triés, sans doublon', async () => {
  await withSite({
    'assets/js/a.js': "const a = t('Bonjour'); const b = t(\"Au revoir\", { n: 1 }); const c = t('Bonjour');",
    'interpreteur/index.html': '<button data-i18n-aria-label="Fermer"><span data-i18n>Envoyer</span></button>',
  }, ({ texts, errors }) => {
    assert.deepEqual(texts, ['Au revoir', 'Bonjour', 'Envoyer', 'Fermer']);
    assert.deepEqual(errors, []);
  });
});

test('tm et tx sont collectés comme t ; td ne l’est pas', async () => {
  await withSite({
    'assets/js/ui/b.js': "tm('**Gras** ici'); const x = tx('Message'); td(valeur); td('Donnée');",
  }, ({ texts, errors }) => {
    assert.deepEqual(texts, ['**Gras** ici', 'Message']);
    assert.deepEqual(errors, []);
  });
});

test('un texte qui n’est pas écrit en toutes lettres est une erreur', async () => {
  await withSite({ 'assets/js/c.js': 'const a = t(variable);\nconst b = tm(autre, { n: 1 });' }, ({ texts, errors }) => {
    assert.deepEqual(texts, []);
    assert.equal(errors.length, 2);
    assert.match(errors[0], /c\.js/);
  });
  await withSite({ 'assets/js/d.js': 'const a = t(`Bonjour ${nom}`);' }, ({ errors }) => {
    assert.equal(errors.length, 1);
  });
});

test('les définitions et les autres fonctions ne sont pas des appels', async () => {
  await withSite({
    'assets/js/e.js': [
      'export function t(text, vars) { return translate(catalog, text, vars); }',
      'export const tx = (text) => text;',
      'export function tm(text, vars) { return render(t(text, vars)); }',
      "const parts = 'a,b'.split(','); list.sort(compare); format(value); objet.t(valeur);",
    ].join('\n'),
  }, ({ texts, errors }) => {
    assert.deepEqual(texts, []);
    assert.deepEqual(errors, ['assets/js/e.js : t(text, vars) — le texte doit être écrit en toutes lettres']);
  });
});

test('guillemets, apostrophes échappées et accents graves', async () => {
  await withSite({
    'assets/js/f.js': "t('L\\'analyse'); t(\"a \\\"b\\\"\"); t(`Sans variable`); t('{n} versets envoyés sur {total}', { n, total });",
  }, ({ texts, errors }) => {
    assert.deepEqual(texts, ['L\'analyse', 'Sans variable', 'a "b"', '{n} versets envoyés sur {total}']);
    assert.deepEqual(errors, []);
  });
});

test('pages : attributs, texte des éléments, entités, espaces', async () => {
  await withSite({
    'index.html': [
      '<input data-i18n-placeholder="Rechercher &amp; trouver" data-i18n-title="Aide">',
      '<p data-i18n>',
      '  Une phrase   sur',
      '  deux lignes.',
      '</p>',
      '<p class="x" data-i18n-md>**Gras** et &quot;guillemets&quot;</p>',
      '<p>Texte non marqué</p>',
    ].join('\n'),
  }, ({ texts, errors }) => {
    assert.deepEqual(texts, ['**Gras** et "guillemets"', 'Aide', 'Rechercher & trouver', 'Une phrase sur deux lignes.']);
    assert.deepEqual(errors, []);
  });
});

test('un élément marqué qui contient une balise est une erreur', async () => {
  await withSite({ 'index.html': '<p data-i18n>Texte <strong>gras</strong></p>' }, ({ errors }) => {
    assert.equal(errors.length, 1);
  });
});

test('la liste du site est à jour (sinon : node _dev/textes.mjs)', async () => {
  const { texts, errors, places } = await collectTexts(SITE);
  assert.deepEqual(errors, []);
  const saved = JSON.parse(await readFile(join(SITE, '_dev', 'textes.json'), 'utf8'));
  assert.deepEqual(saved, { texts, places });
  assert.ok(texts.length > 10);
});

test('places : pour chaque texte, le premier fichier où il figure', async () => {
  await withSite({
    'assets/js/ui/b.js': "t('Commun'); t('Du module');",
    'index.html': '<p data-i18n>Commun</p><p data-i18n>De la page</p>',
    'interpreteur/index.html': '<p data-i18n>De la page</p>',
  }, ({ texts, places }) => {
    assert.deepEqual(texts, ['Commun', 'De la page', 'Du module']);
    assert.deepEqual(places, { Commun: 'assets/js/ui/b.js', 'De la page': 'index.html', 'Du module': 'assets/js/ui/b.js' });
  });
});

// Le numéro de version est écrit par addition : le passage à la version suivante ne le réécrit pas
test('places : le dossier de version des modules n’y figure pas', async () => {
  await withSite({ [`assets/js/v${6 + 1}/ui/b.js`]: "t('Du module');" }, ({ places }) => {
    assert.deepEqual(places, { 'Du module': 'assets/js/ui/b.js' });
  });
});
