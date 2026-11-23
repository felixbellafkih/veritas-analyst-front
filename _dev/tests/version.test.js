// Numéro de version des fichiers servis (_dev/version.mjs), sur un petit site bâti dans un dossier temporaire.
// Les numéros d'essai (41, 42) sont écrits par addition, pour que le passage à la version suivante du vrai
// site ne les réécrive jamais.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { bumpVersion, currentVersion } from '../version.mjs';

const OLD = 40 + 1;
const NEW = OLD + 1;
const dir = (n) => `assets/js/v${n}`;

function site(version) {
  return {
    [`${dir(version)}/pages/a.js`]: "import { b } from '../lib/b.js';\nexport const a = b;\n",
    [`${dir(version)}/lib/b.js`]: 'export const b = 1;\n',
    'assets/js/theme-init.js': '// classique\n',
    'assets/css/base.css': 'body { margin: 0; }\n',
    'accueil/index.html': [
      `<link rel="stylesheet" href="/assets/css/base.css?v=${version}">`,
      `<script src="/assets/js/theme-init.js?v=${version}"></script>`,
      `<script type="module" src="/${dir(version)}/pages/a.js?v=${version}"></script>`,
      `<a href="/corpus/?v=${version}0">autre nombre</a>`,
    ].join('\n'),
    'interpreteur/index.html': `<script type="module" src="/${dir(version)}/pages/a.js?v=${version}"></script>\n`,
    '_dev/tests/x.test.js': `import { b } from '../../${dir(version)}/lib/b.js';\nconst autre = '${dir(version)}0/lib/b.js';\n`,
    '_dev/outil.mjs': `// lit ${dir(version)}/lib/b.js\n`,
    '_dev/fixtures/donnee.txt': `${dir(version)}/lib/b.js\n`,
  };
}

async function withSite(files, check) {
  const root = await mkdtemp(join(tmpdir(), 'veritas-version-'));
  try {
    for (const [name, content] of Object.entries(files)) {
      await mkdir(dirname(join(root, name)), { recursive: true });
      await writeFile(join(root, name), content, 'utf8');
    }
    await check(root, (name) => readFile(join(root, name), 'utf8'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('version en place : celle du dossier des modules', async () => {
  await withSite(site(OLD), async (root) => {
    assert.equal(await currentVersion(root), OLD);
  });
});

test('version suivante : le dossier des modules change de nom, les pages et les outils suivent', async () => {
  await withSite(site(OLD), async (root, read) => {
    const result = await bumpVersion(root);
    assert.equal(result.from, OLD);
    assert.equal(result.to, NEW);
    assert.ok(!existsSync(join(root, dir(OLD))));
    assert.ok(existsSync(join(root, dir(NEW), 'pages', 'a.js')));
    assert.ok(existsSync(join(root, dir(NEW), 'lib', 'b.js')));
    assert.equal(await currentVersion(root), NEW);

    const home = await read('accueil/index.html');
    assert.ok(home.includes(`href="/assets/css/base.css?v=${NEW}"`));
    assert.ok(home.includes(`src="/assets/js/theme-init.js?v=${NEW}"`));
    assert.ok(home.includes(`src="/${dir(NEW)}/pages/a.js?v=${NEW}"`));
    assert.ok(!home.includes(`?v=${OLD}"`));
    assert.ok((await read('interpreteur/index.html')).includes(`src="/${dir(NEW)}/pages/a.js?v=${NEW}"`));

    assert.ok((await read('_dev/tests/x.test.js')).includes(`'../../${dir(NEW)}/lib/b.js'`));
    assert.ok((await read('_dev/outil.mjs')).includes(`${dir(NEW)}/lib/b.js`));
    assert.deepEqual(result.changed.sort(), ['_dev/outil.mjs', '_dev/tests/x.test.js', 'accueil/index.html', 'interpreteur/index.html']);
  });
});

test('version suivante : un autre nombre qui commence pareil n’est pas touché, ni les données enregistrées', async () => {
  await withSite(site(OLD), async (root, read) => {
    await bumpVersion(root);
    assert.ok((await read('accueil/index.html')).includes(`href="/corpus/?v=${OLD}0"`));
    assert.ok((await read('_dev/tests/x.test.js')).includes(`'${dir(OLD)}0/lib/b.js'`));
    assert.equal(await read('_dev/fixtures/donnee.txt'), `${dir(OLD)}/lib/b.js\n`);
  });
});

test('les modules gardent leurs liens relatifs : rien n’y est réécrit', async () => {
  await withSite(site(OLD), async (root, read) => {
    await bumpVersion(root);
    assert.equal(await read(`${dir(NEW)}/pages/a.js`), "import { b } from '../lib/b.js';\nexport const a = b;\n");
  });
});

test('aucun dossier de version, ou plusieurs : erreur, rien n’est modifié', async () => {
  const none = site(OLD);
  delete none[`${dir(OLD)}/pages/a.js`];
  delete none[`${dir(OLD)}/lib/b.js`];
  await withSite(none, async (root) => {
    await assert.rejects(() => currentVersion(root), /dossier de version/);
    await assert.rejects(() => bumpVersion(root), /dossier de version/);
  });
  await withSite({ ...site(OLD), [`${dir(NEW)}/lib/b.js`]: 'export const b = 2;\n' }, async (root, read) => {
    await assert.rejects(() => bumpVersion(root), /dossier de version/);
    assert.ok((await read('accueil/index.html')).includes(`?v=${OLD}"`));
    assert.ok(existsSync(join(root, dir(OLD))));
  });
});

test('une page ajoutée plus tard (Scanner) passe elle aussi à la version suivante', async () => {
  const files = site(OLD);
  files['scanner/index.html'] = `<link rel="stylesheet" href="/assets/css/scanner.css?v=${OLD}">\n<script type="module" src="/${dir(OLD)}/pages/a.js?v=${OLD}"></script>\n`;
  await withSite(files, async (root, read) => {
    const { changed } = await bumpVersion(root);
    assert.ok(changed.includes('scanner/index.html'));
    const page = await read('scanner/index.html');
    assert.ok(page.includes(`/assets/css/scanner.css?v=${NEW}"`));
    assert.ok(page.includes(`/${dir(NEW)}/pages/a.js?v=${NEW}"`));
  });
});

// Étape 5 : les pages du corpus sont écrites par la publication du corpus avec le numéro en place ; la montée de
// version les fait suivre, sans toucher à celles de l'ancien gabarit ni aux pages du LEXICON.
test('version suivante : les pages du corpus au gabarit du site suivent ; les autres restent telles quelles', async () => {
  const corpusPage = (version, extra = '') => [
    `<link rel="stylesheet" href="/assets/css/corpus.css?v=${version}">`,
    `<script type="module" src="/${dir(version)}/pages/corpus.js?v=${version}"></script>`,
    `<p>Une analyse qui cite ?v=${version} et /${dir(version)}/ dans son texte.</p>${extra}`,
  ].join('\n');
  const oldStyle = `<link rel="stylesheet" href="/corpus/style.css">\n<p>?v=${OLD}" et /${dir(OLD)}/</p>\n`;
  const files = {
    ...site(OLD),
    'corpus/index.html': corpusPage(OLD),
    'corpus/2/255/index.html': corpusPage(OLD),
    'en/corpus/1/1/index.html': corpusPage(OLD),
    'corpus/9/84/index.html': oldStyle,
    'lx-1242ba1a/a-b-b/index.html': oldStyle,
    'corpus/data/veritas_corpus.jsonl': `{"x": "/${dir(OLD)}/pages/corpus.js?v=${OLD}\\""}\n`,
  };
  await withSite(files, async (root, read) => {
    const { changed } = await bumpVersion(root);
    for (const name of ['corpus/index.html', 'corpus/2/255/index.html', 'en/corpus/1/1/index.html']) {
      const html = await read(name);
      assert.ok(html.includes(`/assets/css/corpus.css?v=${NEW}"`), name);
      assert.ok(html.includes(`<script type="module" src="/${dir(NEW)}/pages/corpus.js?v=${NEW}"></script>`), name);
      // le texte d'une analyse n'est pas réécrit : ?v= hors d'un attribut, chemin hors d'une adresse
      assert.ok(html.includes(`cite ?v=${OLD} et /${dir(OLD)}/ dans son texte`), name);
      assert.ok(changed.includes(name), name);
    }
    assert.equal(await read('corpus/9/84/index.html'), oldStyle);
    assert.equal(await read('lx-1242ba1a/a-b-b/index.html'), oldStyle);
    assert.equal(await read('corpus/data/veritas_corpus.jsonl'), files['corpus/data/veritas_corpus.jsonl']);
    assert.ok(!changed.some((name) => name.startsWith('lx-') || name.endsWith('.jsonl') || name === 'corpus/9/84/index.html'));
  });
});
