// Règles propres à la page d'accueil (accueil/index.html), vérifiées sur le fichier lui-même.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLASSIC_URL } from '../../assets/js/v1/lib/config.js';

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

test('outils : l’Interpréteur mène au nouveau site, les trois autres à la version classique', () => {
  assert.ok(html.includes('href="/interpreteur/"'));
  const classic = [...html.matchAll(/<a\b[^>]*>/g)].map((match) => match[0]).filter((tag) => tag.includes(`href="${CLASSIC_URL}"`));
  assert.equal(classic.length, 3);
  for (const tag of classic) {
    assert.ok(tag.includes('target="_blank"'), tag);
    assert.ok(tag.includes('rel="noopener"'), tag);
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
