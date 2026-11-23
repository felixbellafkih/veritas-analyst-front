// /classique/ (étape 6) : l'app Streamlit en plein écran, comme l'était l'accueil avant que le nouveau site ne
// devienne officiel. « Version classique » du menu y mène, dans le même onglet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLASSIC_URL } from '../../assets/js/v6/lib/config.js';
import { STATIC_FILES } from '../pages.mjs';

const SITE = fileURLToPath(new URL('../..', import.meta.url));
const path = join(SITE, 'classique', 'index.html');
const html = existsSync(path) ? readFileSync(path, 'utf8') : '';
const CSP = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'self\'; style-src \'self\'; img-src \'self\' data:; font-src \'self\'; connect-src \'self\' https://api.veritas-analyst.org; frame-src https://veritas-analyst.streamlit.app; base-uri \'none\'; form-action \'none\'">';

test('l’app dans un cadre, avec les droits du presse-papiers de l’ancien accueil', () => {
  assert.ok(html.includes('<iframe src="https://veritas-analyst.streamlit.app/?embed=true" allow="clipboard-read; clipboard-write"'), 'cadre');
  assert.ok(html.includes('<title>VERITAS | Analyse Systémique du Texte Coranique</title>'));
});

test('politique de sécurité des autres pages, avec le seul cadre de l’app ; rien d’écrit dans la page', () => {
  assert.ok(html.includes(CSP), 'politique de sécurité');
  assert.ok(html.includes('<meta name="robots" content="noindex">'));
  assert.doesNotMatch(html, /<style\b|\sstyle\s*=|<script\b/i);
  assert.match(html, /<link rel="stylesheet" href="\/assets\/css\/classique\.css\?v=\d+">/);
  assert.ok(existsSync(join(SITE, 'assets', 'css', 'classique.css')));
});

test('la barre basse : le nouvel accueil, puis le corpus', () => {
  const bar = html.slice(html.indexOf('<nav'), html.indexOf('</nav>'));
  assert.deepEqual([...bar.matchAll(/href="([^"]+)"/g)].map((match) => match[1]), ['/', '/corpus/', '/en/corpus/']);
  assert.ok(bar.includes('← Nouveau site'));
});

test('« Version classique » mène à /classique/, dans le même onglet', () => {
  assert.equal(CLASSIC_URL, '/classique/');
  // chemin écrit d'un seul tenant : la montée de version le réécrit (assets/js/v<N>/)
  const shell = readFileSync(fileURLToPath(new URL('../../assets/js/v6/ui/shell.js', import.meta.url)), 'utf8');
  const link = shell.slice(shell.indexOf('function classicLink'), shell.indexOf('}', shell.indexOf('function classicLink')));
  assert.doesNotMatch(link, /_blank|icon\('external'/);
});

test('la montée de version suit la page (feuille ?v=)', () => {
  assert.ok(STATIC_FILES.includes('classique/index.html'));
});
