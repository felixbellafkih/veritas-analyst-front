// Bibliothèque (lib/library.js) : les trois documents, l'adresse de chacun, la lecture tolérante des fichiers
// de contenu (assets/bibliotheque/<code>.json) et le choix entre le texte de la langue et le français.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  GOVERNANCE_PANELS, LIBRARY_DOCS, LIBRARY_HOME, THESIS_CHAPTERS,
  chapterNeighbours, libraryHref, parseLibraryContent, parseLibraryQuery, pickText,
} from '../../assets/js/v3/lib/library.js';
import { parseMarkdown } from '../../assets/js/v3/lib/markdown.js';

const HOME = { doc: 'manifeste', chapter: 'introduction', panel: '1' };
const file = (code) => JSON.parse(readFileSync(fileURLToPath(new URL(`../../assets/bibliotheque/${code}.json`, import.meta.url)), 'utf8'));
const EMPTY = { these: {}, gouvernance: {} };

test('trois documents, quatre chapitres, quatre volets, avec les libellés de l’app', () => {
  assert.deepEqual(LIBRARY_DOCS, ['manifeste', 'these', 'gouvernance']);
  assert.deepEqual(THESIS_CHAPTERS.map((chapter) => chapter.id), ['introduction', 'phase-1', 'phase-2', 'phase-3']);
  assert.deepEqual(THESIS_CHAPTERS.map((chapter) => chapter.label), [
    'Introduction : Maqasid Al-Huruf', 'Phase 1 : Le Bootstrap', 'Phase 2 : La Syntaxe', 'Phase 3 : Le Requêtage',
  ]);
  assert.deepEqual(GOVERNANCE_PANELS.map((panel) => panel.id), ['1', '2', '3', '4']);
  assert.deepEqual(GOVERNANCE_PANELS.map((panel) => panel.label), [
    '1. AXIOMES DE COHÉRENCE', '2. STANDARD VTS-v2', '3. ARCHITECTURE HARDWARE', "4. UNITÉS D'ANALYSE",
  ]);
  assert.deepEqual(GOVERNANCE_PANELS.map((panel) => panel.title), [
    "1. Philosophie du Noyau : Ghayr dhi 'iwaj", '2. Standard de Transcription VTS-v2 (Emphatiques)',
    '3. Architecture Hardware (Couches Logiques)', "4. Modules Majeurs de l'Interface",
  ]);
});

test('l’adresse dit le document, le chapitre ou le volet', () => {
  assert.deepEqual(parseLibraryQuery(''), HOME);
  assert.deepEqual(parseLibraryQuery('?doc=these&ch=phase-2'), { doc: 'these', chapter: 'phase-2', panel: '1' });
  assert.deepEqual(parseLibraryQuery('?doc=gouvernance&v=3'), { doc: 'gouvernance', chapter: 'introduction', panel: '3' });
  assert.deepEqual(parseLibraryQuery('?doc=these'), { doc: 'these', chapter: 'introduction', panel: '1' });
  assert.deepEqual(parseLibraryQuery('?doc=gouvernance'), { doc: 'gouvernance', chapter: 'introduction', panel: '1' });
});

test('une adresse inconnue ou illisible ouvre ce qui existe', () => {
  assert.deepEqual(parseLibraryQuery('?doc=x&ch=phase-9&v=7'), HOME);
  assert.deepEqual(parseLibraryQuery('?doc=these&ch=phase-9'), { doc: 'these', chapter: 'introduction', panel: '1' });
  assert.deepEqual(parseLibraryQuery('?doc=gouvernance&v=0'), { doc: 'gouvernance', chapter: 'introduction', panel: '1' });
  assert.deepEqual(parseLibraryQuery('?doc=gouvernance&v=01'), { doc: 'gouvernance', chapter: 'introduction', panel: '1' });
  for (const doubtful of [null, undefined, 42, '?', '?doc=', '?DOC=these', '?doc=These', '?doc=__proto__', '?ch=phase-1', '?v=2', '?doc=constructor&ch=toString']) {
    const parsed = parseLibraryQuery(doubtful);
    assert.equal(parsed.doc, 'manifeste', String(doubtful));
    assert.ok(THESIS_CHAPTERS.some((chapter) => chapter.id === parsed.chapter), String(doubtful));
    assert.ok(GOVERNANCE_PANELS.some((panel) => panel.id === parsed.panel), String(doubtful));
  }
});

test('l’adresse de chaque document', () => {
  assert.equal(LIBRARY_HOME, '/bibliotheque/');
  assert.equal(libraryHref({ doc: 'manifeste' }), '/bibliotheque/');
  assert.equal(libraryHref({ doc: 'these', chapter: 'phase-1' }), '/bibliotheque/?doc=these&ch=phase-1');
  assert.equal(libraryHref({ doc: 'gouvernance', panel: '2' }), '/bibliotheque/?doc=gouvernance&v=2');
  // une valeur inconnue ne passe pas dans l'adresse
  assert.equal(libraryHref({ doc: 'these', chapter: 'x&y=1' }), '/bibliotheque/?doc=these&ch=introduction');
  assert.equal(libraryHref({ doc: 'gouvernance', panel: '9' }), '/bibliotheque/?doc=gouvernance&v=1');
  assert.equal(libraryHref({ doc: 'ailleurs' }), '/bibliotheque/');
  assert.equal(libraryHref(null), '/bibliotheque/');
});

test('aller-retour entre l’adresse et sa lecture, pour chaque chapitre et chaque volet', () => {
  const search = (href) => href.slice(LIBRARY_HOME.length);
  for (const { id } of THESIS_CHAPTERS) {
    assert.deepEqual(parseLibraryQuery(search(libraryHref({ doc: 'these', chapter: id }))), { doc: 'these', chapter: id, panel: '1' });
  }
  for (const { id } of GOVERNANCE_PANELS) {
    assert.deepEqual(parseLibraryQuery(search(libraryHref({ doc: 'gouvernance', panel: id }))), { doc: 'gouvernance', chapter: 'introduction', panel: id });
  }
  assert.deepEqual(parseLibraryQuery(search(libraryHref({ doc: 'manifeste', chapter: 'phase-2', panel: '3' }))), HOME);
});

test('le chapitre d’avant et le chapitre d’après', () => {
  assert.deepEqual(chapterNeighbours('introduction'), { previous: null, next: 'phase-1' });
  assert.deepEqual(chapterNeighbours('phase-1'), { previous: 'introduction', next: 'phase-2' });
  assert.deepEqual(chapterNeighbours('phase-3'), { previous: 'phase-2', next: null });
  assert.deepEqual(chapterNeighbours('ailleurs'), { previous: null, next: null });
});

test('un fichier de contenu douteux est lu sans rien casser', () => {
  for (const doubtful of [null, undefined, 'x', 42, [], {}, { these: 'x' }, { these: [], gouvernance: null }, { these: null }]) {
    assert.deepEqual(parseLibraryContent(doubtful), EMPTY, JSON.stringify(doubtful));
  }
  assert.deepEqual(parseLibraryContent({
    lang: 'en',
    these: { introduction: 'A', 'phase-9': 'inconnue', 'phase-1': '', 'phase-2': '   ', 'phase-3': 3, __proto__: 'x' },
    gouvernance: { 1: 'G1', 2: null, 3: ['x'], 4: { a: 1 }, 5: 'inconnu' },
    autre: { introduction: 'ailleurs' },
  }), { these: { introduction: 'A' }, gouvernance: { 1: 'G1' } });
});

test('les clés rendues suivent l’ordre de lecture, quel que soit celui du fichier', () => {
  const parsed = parseLibraryContent({ these: { 'phase-3': 'd', introduction: 'a', 'phase-1': 'b' }, gouvernance: { 4: 'z', 2: 'y' } });
  assert.deepEqual(Object.keys(parsed.these), ['introduction', 'phase-1', 'phase-3']);
  assert.deepEqual(Object.keys(parsed.gouvernance), ['2', '4']);
});

test('les vrais fichiers : quatre chapitres et quatre volets en français et en arabe', () => {
  for (const code of ['fr', 'ar']) {
    const parsed = parseLibraryContent(file(code));
    assert.deepEqual(Object.keys(parsed.these), THESIS_CHAPTERS.map((chapter) => chapter.id), code);
    assert.deepEqual(Object.keys(parsed.gouvernance), GOVERNANCE_PANELS.map((panel) => panel.id), code);
  }
});

test('le texte de la langue de l’interface, sinon le français, sinon rien', () => {
  const french = { these: { 'phase-1': 'FR' }, gouvernance: { 2: 'GFR' } };
  assert.deepEqual(pickText({ these: { 'phase-1': 'EN' }, gouvernance: {} }, french, 'these', 'phase-1'), { text: 'EN', french: false });
  assert.deepEqual(pickText(EMPTY, french, 'these', 'phase-1'), { text: 'FR', french: true });
  assert.deepEqual(pickText(EMPTY, french, 'gouvernance', '2'), { text: 'GFR', french: true });
  // interface en français : le texte français n'est pas un repli
  assert.deepEqual(pickText(null, french, 'these', 'phase-1'), { text: 'FR', french: false });
  assert.equal(pickText(null, EMPTY, 'these', 'phase-1'), null);
  assert.equal(pickText(EMPTY, EMPTY, 'gouvernance', '2'), null);
  assert.equal(pickText(EMPTY, null, 'these', 'phase-1'), null);
  // le fichier de la langue est là, mais pas le français : le texte de la langue s'affiche quand même
  assert.deepEqual(pickText({ these: { 'phase-1': 'EN' }, gouvernance: {} }, null, 'these', 'phase-1'), { text: 'EN', french: false });
  // une partie ou une clé inconnue ne rend rien
  assert.equal(pickText(french, french, 'ailleurs', 'phase-1'), null);
  assert.equal(pickText(french, french, 'these', 'toString'), null);
});

test('un contenu hostile reste du texte : aucun lien, aucun balisage interprété', () => {
  const hostile = 'Avant <script>alert(1)</script> [x](javascript:alert(1)) [y](data:text/html,x) <img src=x onerror=alert(1)>\n\n<div onclick="x">bloc</div>';
  const kinds = [];
  const texts = [];
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return undefined;
    if (node.type) kinds.push(node.type);
    if (typeof node.text === 'string') texts.push(node.text);
    return Object.values(node).forEach(walk);
  };
  walk(parseMarkdown(hostile));
  assert.ok(!kinds.includes('link'));
  const whole = texts.join('');
  assert.ok(whole.includes('<script>alert(1)</script>'));
  assert.ok(whole.includes('<div onclick="x">bloc</div>'));
});

test('la thèse française passe par le rendu sans rien perdre de son tableau', () => {
  const blocks = parseMarkdown(parseLibraryContent(file('fr')).these['phase-1']);
  assert.ok(blocks.some((block) => block.type === 'table'));
});
