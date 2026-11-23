// Mentions légales (/legal.html), rhabillées à l'étape 5. Cette adresse est la page de confidentialité et de
// support de l'app sur l'App Store : elle ne change pas, et son texte reste celui de l'auteur, mot pour mot.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PAGE_FILES } from '../pages.mjs';

const SITE = fileURLToPath(new URL('../..', import.meta.url));
const read = (name) => readFileSync(fileURLToPath(new URL(`../../${name}`, import.meta.url)), 'utf8');
// Le texte de l'auteur avant l'étape 5 (fusion de l'étape 4, 23/11/2026)
const before = execFileSync('git', ['show', '95c419c:legal.html'], { cwd: SITE, encoding: 'utf8' });
const page = read('legal.html');

const ENTITIES = { '&amp;': '&', '&copy;': '©', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
const visibleText = (fragment) => fragment
  .replace(/<[^>]*>/g, ' ')
  .replace(/&(?:amp|copy|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity])
  .replace(/\s+/g, ' ')
  .trim();
const between = (html, start, end) => {
  const from = html.search(start);
  assert.ok(from >= 0, `${start}`);
  return html.slice(from, html.indexOf(end, from));
};

test('le texte de l’auteur est gardé mot pour mot, dans le même ordre', () => {
  const old = visibleText(between(before, /<body>/, '</body>'));
  const now = visibleText(between(page, /<main id="contenu"/, '</main>'));
  assert.ok(old.length > 900, `${old.length} caractères`);
  assert.equal(now, old);
});

test('même titre de page, contenu en anglais, page indexable', () => {
  assert.match(page, /<title>Veritas Analyst - Legal &amp; Support<\/title>/);
  assert.match(page, /<main id="contenu" class="page legal" lang="en" dir="ltr">/);
  assert.doesNotMatch(page, /noindex/);
});

test('la page est recensée avec les autres, et rhabillée par le cadre du site', () => {
  assert.ok(PAGE_FILES.includes('legal.html'));
  for (const slot of ['<header id="entete" class="entete"></header>', '<footer id="pied" class="pied"></footer>', '<nav id="onglets" class="onglets"></nav>']) {
    assert.ok(page.includes(slot), slot);
  }
  assert.match(page, /<script type="module" src="\/assets\/js\/v\d+\/pages\/legal\.js\?v=\d+"><\/script>/);
});

test('le module des mentions légales ne contacte pas l’API et n’offre pas la clé', () => {
  const source = readFileSync(fileURLToPath(new URL('../../assets/js/v6/pages/legal.js', import.meta.url)), 'utf8');
  assert.doesNotMatch(source, /from '[^']*\/api\.js'|fetch\(|onKeyClick|key-dialog/);
  assert.match(source, /mountShell\(\{ page: 'legal'/);
});
