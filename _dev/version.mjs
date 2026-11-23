// Numéro de version des fichiers servis du nouveau site.
//
// Le site en ligne fait garder les scripts et les styles 4 heures par le navigateur (réglage du cache de
// Cloudflare, relevé le 22/11/2026). Une adresse qui ne change pas garderait donc son ancien contenu
// bien après une mise à jour. Deux moyens, un seul numéro N :
// - les modules vivent sous assets/js/v<N>/ : comme ils s'importent par des chemins relatifs, toutes leurs
//   adresses changent ensemble, et un navigateur ne mélange jamais d'anciens modules avec de nouveaux ;
// - les autres fichiers (styles, images, langues) portent ?v=<N> dans les pages.
//
// Usage : node _dev/version.mjs              affiche la version en place
//         node _dev/version.mjs --suivante   passe à la version suivante
// À faire avant chaque mise en ligne qui change un fichier servi (assets/, accueil/, interpreteur/), puis
// relancer les tests : node --test "_dev/tests/*.test.js"
import { readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { PAGE_FILES } from './pages.mjs';

async function list(dir) {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

// Le numéro du seul dossier assets/js/v<N>
export async function currentVersion(rootDir) {
  const versions = (await list(join(rootDir, 'assets', 'js'))).filter((entry) => entry.isDirectory() && /^v\d+$/.test(entry.name));
  if (versions.length !== 1) {
    throw new Error(`assets/js doit contenir un seul dossier de version (trouvé : ${versions.map((entry) => entry.name).join(', ') || 'aucun'})`);
  }
  return Number(versions[0].name.slice(1));
}

// Tests et outils de _dev qui nomment le dossier des modules ; les réponses enregistrées n'en font pas partie
async function tools(dir) {
  const found = [];
  for (const entry of await list(dir)) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'fixtures') found.push(...await tools(path));
    } else if (/\.m?js$/.test(entry.name)) {
      found.push(path);
    }
  }
  return found.sort();
}

// Pages du corpus écrites par la publication du corpus (export_corpus.py du Kernel) au gabarit du site : celles
// qui chargent le module pages/corpus.js de cette version. Les pages de l'ancien gabarit ne sont pas retenues.
async function corpusPages(rootDir, version) {
  const marker = `/assets/js/v${version}/pages/corpus.js`;
  const found = [];
  async function walk(dir) {
    for (const entry of await list(dir)) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.name === 'index.html' && (await readFile(path, 'utf8')).includes(marker)) found.push(path);
    }
  }
  await walk(join(rootDir, 'corpus'));
  await walk(join(rootDir, 'en', 'corpus'));
  return found.sort();
}

// Passe à la version suivante : renomme le dossier des modules, puis met à jour les pages (adresse du
// module et ?v=) et les tests et outils qui nomment ce dossier. Rend {from, to, changed}.
export async function bumpVersion(rootDir) {
  const from = await currentVersion(rootDir);
  const to = from + 1;
  const pageRules = [[new RegExp(`\\?v=${from}(?=")`, 'g'), `?v=${to}`], [new RegExp(`/assets/js/v${from}/`, 'g'), `/assets/js/v${to}/`]];
  const toolRules = [[new RegExp(`assets/js/v${from}/`, 'g'), `assets/js/v${to}/`]];
  // Pages du corpus : seules les adresses (src="…", href="…") changent, jamais le texte d'une analyse
  const inUrl = (url) => url.replace(new RegExp(`\\?v=${from}$`), `?v=${to}`).replace(`/assets/js/v${from}/`, `/assets/js/v${to}/`);
  const corpusRules = [[/(\s(?:src|href)=")([^"]*)"/g, (whole, start, url) => `${start}${inUrl(url)}"`]];
  const targets = [
    ...PAGE_FILES.map((page) => [join(rootDir, page), pageRules]),
    ...(await corpusPages(rootDir, from)).map((path) => [path, corpusRules]),
    ...(await tools(join(rootDir, '_dev'))).map((path) => [path, toolRules]),
  ];

  // Tout est lu et calculé avant la première écriture
  const rewrites = [];
  for (const [path, rules] of targets) {
    let source;
    try {
      source = await readFile(path, 'utf8');
    } catch {
      continue; // page pas encore créée
    }
    const next = rules.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), source);
    if (next !== source) rewrites.push([path, next]);
  }

  await rename(join(rootDir, 'assets', 'js', `v${from}`), join(rootDir, 'assets', 'js', `v${to}`));
  for (const [path, content] of rewrites) await writeFile(path, content, 'utf8');
  return { from, to, changed: rewrites.map(([path]) => relative(rootDir, path).replace(/\\/g, '/')) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
  if (process.argv.includes('--suivante')) {
    const { from, to, changed } = await bumpVersion(root);
    console.log(`Version ${from} → ${to} : assets/js/v${to}/, et ${changed.length} fichier(s) mis à jour.`);
    console.log('À faire maintenant : node --test "_dev/tests/*.test.js"');
  } else {
    console.log(`Version en place : ${await currentVersion(root)}. Version suivante : node _dev/version.mjs --suivante`);
  }
}
