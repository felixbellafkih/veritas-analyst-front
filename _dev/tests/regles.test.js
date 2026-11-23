// Règles du nouveau site, vérifiées sur les fichiers eux-mêmes (plan de l'étape 1, contraintes globales).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGES as PAGE_DIRS } from '../pages.mjs';

const SITE = fileURLToPath(new URL('../..', import.meta.url));
const CSP = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'self\'; style-src \'self\'; img-src \'self\' data:; font-src \'self\'; connect-src \'self\' https://api.veritas-analyst.org; base-uri \'none\'; form-action \'none\'">';
const SERVED = ['assets', ...PAGE_DIRS];
const PAGES = PAGE_DIRS.map((name) => `${name}/index.html`).filter((page) => existsSync(join(SITE, page)));

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

// Les modules vivent sous assets/js/v<N>/ : leur adresse change à chaque version, pour qu'un navigateur ne
// mélange jamais d'anciens modules avec de nouveaux (voir _dev/version.mjs).
const JS = join(SITE, 'assets', 'js');
const versionDirs = existsSync(JS) ? readdirSync(JS).filter((name) => /^v\d+$/.test(name)) : [];
const MODULES = join(JS, versionDirs[0] || 'v0');
const moduleRel = (path) => relative(MODULES, path).replace(/\\/g, '/');

test('les pages du site existent : accueil, Interpréteur, Scanner, Tarteel, Séquenceur', () => {
  for (const name of ['accueil', 'interpreteur', 'scanner', 'tarteel', 'sequenceur']) assert.ok(PAGES.includes(`${name}/index.html`), name);
});

// Une page oubliée dans _dev/pages.mjs garderait son ancien numéro de version à la mise en ligne suivante
test('toute page qui charge un module du site est recensée dans _dev/pages.mjs', () => {
  const found = readdirSync(SITE).filter((name) => {
    const page = join(SITE, name, 'index.html');
    return !name.startsWith('.') && !name.startsWith('_') && existsSync(page) && /<script type="module" src="\/assets\/js\/v\d+\//.test(read(page));
  });
  assert.deepEqual(found.sort(), [...PAGE_DIRS].sort());
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

  test(`${page} : son module est servi depuis le dossier de version, au même numéro que ?v=`, () => {
    const match = /<script type="module" src="\/assets\/js\/v(\d+)\/pages\/[a-z-]+\.js\?v=(\d+)"><\/script>/.exec(html);
    assert.ok(match, 'module de la page');
    assert.equal(match[1], match[2]);
    assert.equal(`v${match[1]}`, versionDirs[0]);
    assert.doesNotMatch(html, /\/assets\/js\/(?:lib|ui|pages)\//, 'adresse de module sans version');
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
  const pure = [...walk(join(MODULES, 'lib')), join(MODULES, 'api.js')].filter((path) => existsSync(path));
  assert.ok(pure.length >= 10);
  for (const path of pure) assert.doesNotMatch(read(path), /\b(document|window|localStorage|sessionStorage|navigator)\./, rel(path));
});

// L'insertion native (append, prepend, replaceChildren…) écrit le mot « null » ou « undefined » dans la page
// quand on lui passe une valeur absente. Les modules d'interface passent donc par add() et fill() de dom.js,
// qui ignorent ces valeurs.
test('interface : aucune insertion native hors de dom.js', () => {
  const dom = walk(MODULES).filter((path) => /^(ui|pages)\//.test(moduleRel(path)) && moduleRel(path) !== 'ui/dom.js');
  assert.ok(dom.length >= 8);
  for (const path of dom) assert.doesNotMatch(read(path), /\.(append|prepend|replaceChildren|before|after|replaceWith)\(/, rel(path));
});

test('les modules sont rangés sous un seul dossier de version', () => {
  assert.equal(versionDirs.length, 1, `dossiers de version : ${versionDirs}`);
  assert.deepEqual(readdirSync(JS).filter((name) => name !== versionDirs[0]), ['theme-init.js']);
  assert.ok(existsSync(join(MODULES, 'pages', 'interpreteur.js')));
});

// Un import écrit autrement (adresse absolue, autre dossier) sortirait du dossier de version : il serait
// gardé en cache par le navigateur sous une adresse qui ne change pas.
test('les modules ne s’importent que par des chemins relatifs, à l’intérieur du dossier de version', () => {
  const modules = walk(MODULES);
  assert.ok(modules.length >= 30, `${modules.length} modules`);
  for (const path of modules) {
    for (const match of read(path).matchAll(/(?:\bfrom\s+|\bimport\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm)) {
      assert.match(match[1], /^\.\.?\//, `${rel(path)} importe ${match[1]}`);
      assert.ok(!relative(MODULES, join(dirname(path), match[1])).startsWith('..'), `${rel(path)} sort du dossier de version : ${match[1]}`);
    }
  }
});

// « text » sur un dossier entier ferait convertir les fins de ligne d'une image ou d'une police ajoutée plus
// tard (un PNG commence par un retour chariot suivi d'un saut de ligne) : avec « text=auto », git reconnaît
// les fichiers binaires et les laisse intacts.
test('.gitattributes : aucun dossier entier forcé en texte', () => {
  const lines = read(join(SITE, '.gitattributes')).split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
  const folders = lines.filter((line) => line.split(/\s+/)[0].endsWith('/**'));
  assert.ok(folders.length >= 4, `${folders.length} dossiers`);
  for (const line of folders) assert.match(line, /\stext=auto(\s|$)/, line);
});

// Relecture du 22/11/2026, liste des versets du mode Tarteel (module d'interface, sans autre test
// automatique) : la touche Entrée sur la case d'un verset lançait l'analyse, donc une demande facturée, et
// « Analyser » sans case cochée plaçait le curseur sur une case hors de vue.
test('Tarteel : Entrée sur une case ne lance pas l’analyse ; le curseur va sur un bouton visible', () => {
  const list = read(scripts.find((path) => path.endsWith(join('ui', 'cluster-list.js'))));
  assert.match(list, /list\.addEventListener\('keydown'/, 'aucune écoute du clavier sur la liste des versets');
  assert.match(list, /event\.key === 'Enter'[\s\S]{0,120}event\.preventDefault\(\)/, 'Entrée n’est pas neutralisée');
  const form = read(scripts.find((path) => path.endsWith(join('ui', 'passage-form.js'))));
  assert.doesNotMatch(form, /first\.focus\(\{ preventScroll: true \}\)/, 'curseur placé sur une case sans la montrer');
  assert.match(form, /focusTools\(\)/, 'le curseur doit aller sur « Tout sélectionner »');
});

// Étape 2 : la liste des versets est un module partagé par l'Interpréteur et la page Tarteel. Deux copies
// de cette liste finiraient par diverger sur ce qui part à l'analyse.
test('la liste des versets d’un cluster n’est bâtie qu’à un endroit : ui/cluster-list.js', () => {
  const builders = scripts.filter((path) => /cluster__case/.test(read(path))).map(rel);
  assert.deepEqual(builders.map((path) => path.split('/').slice(-2).join('/')), ['ui/cluster-list.js']);
  const form = read(scripts.find((path) => path.endsWith(join('ui', 'passage-form.js'))));
  assert.match(form, /mountClusterList\(/);
});

// Une page sans cette ligne prendrait des fins de ligne Windows sur ce PC, à la différence des autres
test('.gitattributes : chaque page du site garde ses fins de ligne LF', () => {
  const lines = read(join(SITE, '.gitattributes')).split('\n').map((line) => line.trim());
  for (const name of PAGE_DIRS) assert.ok(lines.includes(`/${name}/** text=auto eol=lf`), name);
});

// Les deux pages qui montrent un cluster disent la même chose du signal : un seul module les écrit
test('Tarteel : les messages du signal ne sont écrits qu’à un endroit (ui/tarteel-status.js)', () => {
  const writers = scripts.filter((path) => /Signal pur \(\{n\} occurrences triangulées\)/.test(read(path))).map((path) => rel(path).split('/').slice(-2).join('/'));
  assert.deepEqual(writers, ['ui/tarteel-status.js']);
});

// Ni le Scanner, ni la page Tarteel, ni le Séquenceur n'envoient de clé : ils ne font que des lectures publiques
test('pages de lecture : aucune analyse n’y est lancée, aucune clé n’y est envoyée', () => {
  for (const name of ['scanner.js', 'tarteel.js', 'sequenceur.js']) {
    const source = read(scripts.find((path) => path.endsWith(join('pages', name))));
    assert.doesNotMatch(source, /api\.(analyze|models|corpus[A-Z]\w*|devMode)\(/, name);
    assert.doesNotMatch(source, /credentials\(\)/, name);
  }
});

// Un point final dans une adresse se perd au copier-coller : seules ces deux fonctions savent l'encoder
test('les adresses du Scanner et du Tarteel sont bâties par scannerHref et tarteelQuery', () => {
  const byHand = scripts.filter((path) => /\/(tarteel\/\?p=|scanner\/\?q=)/.test(read(path))).map((path) => rel(path).split('/').slice(-2).join('/'));
  assert.deepEqual(byHand, ['lib/roots-index.js']);
});

// Le report d'une sélection est pris une fois, à l'ouverture de l'Interpréteur, et non à chaque cluster prêt
test('Interpréteur : le report du Tarteel est lu à l’ouverture de la page, hors de l’affichage du cluster', () => {
  const source = read(scripts.find((path) => path.endsWith(join('ui', 'passage-form.js'))));
  assert.equal(source.split('takeTarteelHandoff(').length - 1, 1);
  const show = source.slice(source.indexOf('function showTarteel('), source.indexOf('const probe = createTarteelProbe'));
  assert.ok(show.length > 0);
  assert.doesNotMatch(show, /takeTarteelHandoff/);
  assert.match(show, /handoff\.take\(/);
});

// Étape 3 : l'adresse d'un passage dans un outil (?s=…&de=…&a=…) n'est écrite qu'à un endroit
test('les adresses d’un passage, vers le Séquenceur ou l’Interpréteur, sont bâties dans lib/verses.js', () => {
  const byHand = scripts.filter((path) => /\/(sequenceur|interpreteur)\/(\?|\$\{)/.test(read(path))).map((path) => rel(path).split('/').slice(-2).join('/'));
  assert.deepEqual(byHand, ['lib/verses.js']);
});

// Les champs « sourate, du verset, au verset » servent à l'Interpréteur et au Séquenceur : un seul module les bâtit
test('les champs de verset ne sont bâtis qu’à un endroit : ui/verse-fields.js', () => {
  const builders = scripts.filter((path) => /verset-debut/.test(read(path))).map((path) => rel(path).split('/').slice(-2).join('/'));
  assert.deepEqual(builders, ['ui/verse-fields.js']);
});

// Depuis le mode Verset de l'Interpréteur, le même passage s'ouvre dans le Séquenceur
test('Interpréteur : le lien vers le Séquenceur est bâti par sequencerHref', () => {
  const source = read(scripts.find((path) => path.endsWith(join('ui', 'passage-form.js'))));
  assert.match(source, /sequencerHref\(state\)/);
  assert.match(source, /Voir la séquence de ce passage/);
});
