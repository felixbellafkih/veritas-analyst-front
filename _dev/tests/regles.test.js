// Règles du nouveau site, vérifiées sur les fichiers eux-mêmes (plan de l'étape 1, contraintes globales).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = fileURLToPath(new URL('../..', import.meta.url));
const CSP = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'self\'; style-src \'self\'; img-src \'self\' data:; font-src \'self\'; connect-src \'self\' https://api.veritas-analyst.org; base-uri \'none\'; form-action \'none\'">';
const SERVED = ['assets', 'accueil', 'interpreteur'];
const PAGES = ['interpreteur/index.html', 'accueil/index.html'].filter((page) => existsSync(join(SITE, page)));

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
const rel = (path) => relative(SITE, path).replace(/\\/g, '/');
const servedFiles = SERVED.flatMap((dir) => walk(join(SITE, dir)));
const textFiles = servedFiles.filter((path) => /\.(js|css|html|json|svg|txt)$/.test(path));
const scripts = walk(join(SITE, 'assets', 'js')).filter((path) => path.endsWith('.js'));
const read = (path) => readFileSync(path, 'utf8');

test('la page de l’Interpréteur existe', () => {
  assert.ok(PAGES.includes('interpreteur/index.html'));
});

for (const page of PAGES) {
  const html = existsSync(join(SITE, page)) ? read(join(SITE, page)) : '';

  test(`${page} : politique de sécurité exacte, et hors des moteurs de recherche`, () => {
    assert.ok(html.includes(CSP), 'balise Content-Security-Policy');
    assert.ok(html.includes('<meta name="robots" content="noindex">'), 'noindex');
    assert.match(html, /^<!doctype html>\s*<html lang="fr" dir="ltr">/i);
  });

  test(`${page} : rien que la politique de sécurité refuserait`, () => {
    assert.doesNotMatch(html, /<script(?![^>]*\ssrc=)[^>]*>/i, 'script écrit dans la page');
    assert.doesNotMatch(html, /<style\b/i, 'styles écrits dans la page');
    assert.doesNotMatch(html, /\sstyle\s*=/i, 'attribut style');
    assert.doesNotMatch(html, /\son[a-z]+\s*=/i, 'gestionnaire écrit dans la page');
    assert.doesNotMatch(html, /(?:src|href)="(?:https?:)?\/\/(?!veritas-analyst\.org)[^"]*\.(?:js|css|woff2?)\b/i, 'script, style ou police d’un autre site');
  });

  test(`${page} : chaque adresse /assets/ porte le même numéro de version, et son fichier existe`, () => {
    const urls = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1]);
    assert.ok(urls.length >= 4, `${urls.length} adresses`);
    const versions = new Set();
    for (const url of urls) {
      const match = /^(\/assets\/[^?]+)\?v=(\d+)$/.exec(url);
      assert.ok(match, `sans ?v= : ${url}`);
      versions.add(match[2]);
      assert.ok(existsSync(join(SITE, match[1])), `fichier absent : ${match[1]}`);
    }
    assert.equal(versions.size, 1, `plusieurs versions : ${[...versions]}`);
  });

  test(`${page} : le thème est posé avant le premier affichage`, () => {
    const themeAt = html.search(/<script src="\/assets\/js\/theme-init\.js\?v=\d+"><\/script>/);
    const moduleAt = html.search(/<script type="module"/);
    assert.ok(themeAt > 0, 'theme-init.js chargé comme script classique');
    assert.ok(moduleAt > themeAt, 'avant les modules');
    assert.ok(html.indexOf('</head>') > themeAt, 'dans <head>');
  });
}

test('toutes les pages portent le même numéro de version', () => {
  const versions = new Set(PAGES.flatMap((page) => [...read(join(SITE, page)).matchAll(/\?v=(\d+)"/g)].map((match) => match[1])));
  assert.equal(versions.size, 1);
});

test('aucun module n’insère de HTML ni n’évalue de texte', () => {
  assert.ok(scripts.length >= 10, `${scripts.length} modules`);
  const forbidden = ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write', 'eval(', 'new Function', "setAttribute('style'", 'setAttribute("style"', 'srcdoc', 'DOMParser', 'createContextualFragment'];
  for (const path of scripts) {
    const source = read(path);
    for (const word of forbidden) assert.ok(!source.includes(word), `${rel(path)} contient ${word}`);
  }
});

test('la clé ne part jamais dans la console', () => {
  for (const path of scripts) assert.doesNotMatch(read(path), /console\.(log|info|debug|warn|error)\(/, rel(path));
});

test('aucun lien vers le LEXICON discret ni vers llms.txt', () => {
  for (const path of textFiles) {
    const source = read(path);
    assert.ok(!source.includes('lx-1242ba1a'), rel(path));
    assert.ok(!source.includes('llms.txt'), rel(path));
  }
});

test('aucun fichier Markdown parmi les fichiers servis (GitHub Pages en ferait des pages)', () => {
  assert.deepEqual(servedFiles.filter((path) => path.endsWith('.md')).map(rel), []);
});

test('aucun fichier servi sous un nom qui commence par _ ou par un point', () => {
  assert.deepEqual(servedFiles.map(rel).filter((path) => path.split('/').some((part) => part.startsWith('_') || part.startsWith('.'))), []);
});

test('theme-init.js est un script classique', () => {
  const source = read(join(SITE, 'assets', 'js', 'theme-init.js'));
  assert.doesNotMatch(source, /\b(import|export)\b/);
});

test('les modules sans interface ne touchent ni au document ni à la fenêtre', () => {
  const pure = [...walk(join(SITE, 'assets', 'js', 'lib')), join(SITE, 'assets', 'js', 'api.js')].filter((path) => existsSync(path));
  assert.ok(pure.length >= 10);
  for (const path of pure) assert.doesNotMatch(read(path), /\b(document|window|localStorage|sessionStorage|navigator)\./, rel(path));
});

// L'insertion native (append, prepend, replaceChildren…) écrit le mot « null » ou « undefined » dans la page
// quand on lui passe une valeur absente. Les modules d'interface passent donc par add() et fill() de dom.js,
// qui ignorent ces valeurs.
test('interface : aucune insertion native hors de dom.js', () => {
  const dom = scripts.filter((path) => /^assets\/js\/(ui|pages)\//.test(rel(path)) && rel(path) !== 'assets/js/ui/dom.js');
  assert.ok(dom.length >= 8);
  for (const path of dom) assert.doesNotMatch(read(path), /\.(append|prepend|replaceChildren|before|after|replaceWith)\(/, rel(path));
});
