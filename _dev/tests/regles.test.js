// Règles du nouveau site, vérifiées sur les fichiers eux-mêmes (plan de l'étape 1, contraintes globales).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGE_FILES, PAGES as PAGE_DIRS } from '../pages.mjs';

const SITE = fileURLToPath(new URL('../..', import.meta.url));
const CSP = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'self\'; style-src \'self\'; img-src \'self\' data:; font-src \'self\'; connect-src \'self\' https://api.veritas-analyst.org; base-uri \'none\'; form-action \'none\'">';
const SERVED = ['assets', ...PAGE_DIRS];
const PAGES = PAGE_FILES.filter((page) => existsSync(join(SITE, page)));
// Pages indexables : les mentions légales (page de confidentialité de l'app sur l'App Store)
const INDEXED = PAGE_FILES; // étape 6 : toutes les pages du site sont indexables

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
// Dossiers écrits par la publication du corpus (export_corpus.py du Kernel), pas à la main
const GENERATED = ['corpus', 'en', 'lx-1242ba1a'];

test('les pages du site existent : accueil (à la racine), Interpréteur, Scanner, Tarteel, Séquenceur, Bibliothèque', () => {
  assert.ok(PAGES.includes('index.html'), 'index.html');
  for (const name of ['interpreteur', 'scanner', 'tarteel', 'sequenceur', 'bibliotheque']) assert.ok(PAGES.includes(`${name}/index.html`), name);
  assert.ok(!PAGE_FILES.includes('accueil/index.html'), 'accueil/index.html est une page de renvoi');
});

// Étape 6 : plus aucun lien interne vers /accueil/ (page de renvoi), sauf ses propres tests
test('aucun module ni outil ne vise encore /accueil/', () => {
  const tools = walk(join(SITE, '_dev')).filter((path) => /\.m?js$/.test(path) && !path.endsWith('accueil.test.js') && !path.endsWith('regles.test.js'));
  for (const path of [...scripts, ...tools]) assert.doesNotMatch(read(path), /['"`]\/accueil\//, rel(path));
});

// La Bibliothèque ne lit que des fichiers du site : elle ne contacte pas l'API, n'envoie ni clé ni mot de
// passe, et n'en demande pas
test('Bibliothèque : aucun appel à l’API, seuls des fichiers du site sont lus', () => {
  for (const name of [join('pages', 'bibliotheque.js'), join('ui', 'library-view.js'), join('ui', 'diagrams.js'), join('lib', 'library.js'), join('lib', 'library-diagrams.js')]) {
    const path = scripts.find((each) => each.endsWith(name));
    assert.ok(path, name);
    const source = read(path);
    assert.doesNotMatch(source, /from '[^']*\/api\.js'/, name);
    assert.doesNotMatch(source, /key-dialog|credentials\(|getKey\(|getDevPassword\(|apiBase|api\.veritas-analyst/, name);
    for (const call of source.match(/fetch\([^)]*\)/g) || []) assert.match(call, /^fetch\([`']\/assets\//, `${name} : ${call}`);
  }
  const page = read(join(SITE, 'bibliotheque', 'index.html'));
  assert.doesNotMatch(page, /<(input|textarea|form)\b/);
  // Le bouton de la clé n'y est pas : la page n'en donne pas l'ouverture, et le cadre le cache alors
  assert.doesNotMatch(read(scripts.find((each) => each.endsWith(join('pages', 'bibliotheque.js')))), /onKeyClick/);
  assert.match(read(scripts.find((each) => each.endsWith(join('ui', 'shell.js')))), /hidden: !onKeyClick/);
});

// Le manifeste est écrit dans la page : sans script, il reste lisible
test('Bibliothèque : le manifeste est dans la page, avec les emplacements que le module remplit', () => {
  const page = read(join(SITE, 'bibliotheque', 'index.html'));
  for (const id of ['bibliotheque', 'manifeste', 'schema-execution', 'nombre-racines']) assert.match(page, new RegExp(`id="${id}"`), id);
  assert.match(page, /VERITAS KERNEL : MANIFESTE &amp; PROTOCOLE/);
  assert.doesNotMatch(page, /noindex/); // étape 6 : indexable
  assert.match(page, /\/assets\/css\/bibliotheque\.css\?v=\d+/);
});

// Une page oubliée dans _dev/pages.mjs garderait son ancien numéro de version à la mise en ligne suivante
test('toute page qui charge un module du site est recensée dans _dev/pages.mjs', () => {
  const found = readdirSync(SITE).filter((name) => {
    const page = join(SITE, name, 'index.html');
    // corpus/ et en/ : pages écrites par la publication du corpus, vérifiées plus bas
    return !name.startsWith('.') && !name.startsWith('_') && !GENERATED.includes(name) && existsSync(page) && /<script type="module" src="\/assets\/js\/v\d+\//.test(read(page));
  });
  assert.deepEqual(found.sort(), [...PAGE_DIRS].sort());
});

// Étape 5 : les pages du corpus sont écrites chaque nuit par export_corpus.py (Kernel), au gabarit du site
// quand le dépôt le porte. Elles restent indexables ; tout le reste suit les règles des autres pages.
test('pages du corpus : le module ne contacte pas l’API et ne touche ni au titre ni au contenu', () => {
  const path = scripts.find((each) => each.endsWith(join('pages', 'corpus.js')));
  assert.ok(path, 'pages/corpus.js');
  const source = read(path);
  assert.doesNotMatch(source, /from '[^']*\/api\.js'/);
  assert.doesNotMatch(source, /fetch\(|onKeyClick|document\.title|key-dialog/);
  assert.match(source, /initI18n\(\{[^}]*fallback/);
  assert.match(source, /mountShell\(\{ page: 'corpus'/);
});

const corpusPages = ['corpus', join('en', 'corpus')]
  .flatMap((dir) => walk(join(SITE, dir)))
  .filter((path) => path.endsWith('index.html') && /\/assets\/js\/v\d+\/pages\/corpus\.js/.test(read(path)));

// Relecture de l'étape 5 : les pages du corpus au gabarit du site ne sont écrites que sur main (par la publication).
// Une copie de travail qui ne les a pas ferait passer la montée de version à côté d'elles : en ligne, elles
// chargeraient un dossier de modules disparu. Avant toute montée de version, fusionner main dans la branche.
test('pages du corpus : cette copie porte celles de main, au gabarit du site', () => {
  const lists = ['corpus/index.html', 'en/corpus/index.html'].filter((page) => existsSync(join(SITE, page)));
  if (!lists.length) return; // dépôt sans corpus
  assert.ok(corpusPages.length > 0, 'aucune page du corpus au gabarit du site : fusionner main dans la branche avant de monter la version');
  for (const page of lists) assert.ok(corpusPages.includes(join(SITE, page)), `${page} à l'ancien gabarit`);
});

test('pages du corpus au gabarit du site : politique de sécurité, version en place, indexables', () => {
  const sitePage = read(join(SITE, 'sequenceur', 'index.html'));
  const siteVersion = /\?v=(\d+)"/.exec(sitePage)[1];
  for (const path of corpusPages) {
    const html = read(path);
    assert.ok(html.includes(CSP), `${rel(path)} : politique de sécurité`);
    assert.doesNotMatch(html, /noindex/, rel(path));
    assert.doesNotMatch(html, /lx-1242ba1a|llms\.txt/, rel(path));
    assert.doesNotMatch(html, /<script(?![^>]*\s(?:src=|type="application\/ld\+json"))[^>]*>/i, `${rel(path)} : script écrit dans la page`);
    assert.doesNotMatch(html, /\sstyle\s*=|<style\b|\son[a-z]+\s*=/i, rel(path));
    const versions = new Set([...html.matchAll(/\?v=(\d+)"/g)].map((match) => match[1]));
    assert.deepEqual([...versions], [siteVersion], rel(path));
    assert.match(html, new RegExp(`/assets/js/v${siteVersion}/pages/corpus\\.js\\?v=${siteVersion}"`), rel(path));
  }
});

for (const page of PAGES) {
  const html = existsSync(join(SITE, page)) ? read(join(SITE, page)) : '';

  test(`${page} : politique de sécurité exacte, et hors des moteurs de recherche`, () => {
    assert.ok(html.includes(CSP), 'balise Content-Security-Policy');
    if (INDEXED.includes(page)) assert.doesNotMatch(html, /noindex/, 'indexable');
    else assert.ok(html.includes('<meta name="robots" content="noindex">'), 'noindex');
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
  assert.ok(lines.includes('/legal.html text=auto eol=lf'), 'legal.html');
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
