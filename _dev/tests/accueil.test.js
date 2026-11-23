// Règles propres à la page d'accueil (accueil/index.html), vérifiées sur le fichier lui-même.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLASSIC_URL } from '../../assets/js/v5/lib/config.js';

const SITE = fileURLToPath(new URL('../..', import.meta.url));
const path = join(SITE, 'accueil', 'index.html');
const html = existsSync(path) ? readFileSync(path, 'utf8') : '';
const ANALYSES = ['1/1', '6/159', '18/96-97'];

test('la page d’accueil existe', () => {
  assert.ok(html.length > 0);
});

// export_corpus.py laisse intacte la page d'accueil qui porte cette marque (conception §6.3)
test('la marque du corpus figure une seule fois, dans le pied de page', () => {
  assert.equal(html.split('<!-- corpus-link -->').length - 1, 1);
  const at = html.indexOf('<!-- corpus-link -->');
  assert.ok(at > html.indexOf('<footer') && at < html.indexOf('</footer>'));
});

test('les trois analyses du corpus : un lien chacune, vers une page publiée en français et en anglais', () => {
  for (const reference of ANALYSES) {
    assert.equal(html.split(`href="/corpus/${reference}/"`).length - 1, 1, reference);
    assert.ok(existsSync(join(SITE, 'corpus', ...reference.split('/'), 'index.html')), `corpus/${reference}`);
    assert.ok(existsSync(join(SITE, 'en', 'corpus', ...reference.split('/'), 'index.html')), `en/corpus/${reference}`);
  }
});

// Étape 3 : chaque outil a sa page sur le nouveau site ; plus aucune carte ne renvoie à la version classique
test('outils : Interpréteur, Tarteel, Séquenceur et Scanner mènent au nouveau site', () => {
  const cards = [...html.matchAll(/<a class="outil carte"[^>]*>[\s\S]*?<\/a>/g)].map((match) => match[0]);
  assert.equal(cards.length, 4);
  const card = (name) => cards.find((text) => text.includes(`data-i18n>${name}</span>`));
  for (const [name, href] of [['Interpréteur', '/interpreteur/'], ['Tarteel', '/tarteel/'], ['Séquenceur', '/sequenceur/'], ['Scanner', '/scanner/']]) {
    assert.ok(card(name).startsWith(`<a class="outil carte" href="${href}">`), name);
    assert.ok(!card(name).includes('dans la version classique'), name);
    assert.ok(!card(name).includes(CLASSIC_URL), name);
  }
});

// Ce qui vient du LEXICON ou de l'API n'est jamais recopié dans la page : une correction du LEXICON se
// voit ainsi d'elle-même sur l'accueil, et un chiffre que l'API n'a pas donné ne s'affiche pas.
test('ni chiffre ni définition de racine écrits dans la page', () => {
  assert.ok(html.includes('<body'));
  const visible = html.slice(html.indexOf('<body'));
  for (const word of ['1994', '1 994', 'GLOBAL_ADDRESS_SPACE', 'Signal/Flux', '6236', '6 236']) assert.ok(!visible.includes(word), word);
});

test('aucun extrait d’analyse écrit dans la page : il est lu sur la liste publiée du corpus', () => {
  assert.ok(html.includes('<body'));
  assert.ok(!html.includes('pointeur d'), 'extrait de 1:1');
  assert.ok(!html.includes('architecture réseau'), 'extrait de 6:159');
});

test('la carte de racine mène à sa fiche dans le Scanner', () => {
  const page = readFileSync(fileURLToPath(new URL('../../assets/js/v5/pages/accueil.js', import.meta.url)), 'utf8');
  assert.match(page, /scannerHref\(/);
  assert.match(page, /Ouvrir cette racine dans le Scanner/);
});

// L'ordre du menu est vérifié sur lib/destinations.js (_dev/tests/destinations.test.js)
test('le socle bâtit le menu, la barre d’onglets et « Plus » à partir de lib/destinations.js', () => {
  const source = readFileSync(fileURLToPath(new URL('../../assets/js/v5/ui/shell.js', import.meta.url)), 'utf8');
  for (const name of ['menuDestinations', 'tabDestinations', 'moreDestinations']) assert.ok(source.includes(`${name}(`), name);
  assert.doesNotMatch(source, /ready: (true|false)/);
});
