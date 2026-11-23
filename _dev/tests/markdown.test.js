import { test } from 'node:test';
import assert from 'node:assert/strict';
import { outline, parseInline, parseMarkdown, plainText, safeHref, splitRoots, splitTitle } from '../../assets/js/v6/lib/markdown.js';

const text = (value) => ({ type: 'text', text: value });
const para = (...inline) => ({ type: 'paragraph', inline });
const strong = (...inline) => ({ type: 'strong', inline });
const em = (...inline) => ({ type: 'em', inline });
const code = (value) => ({ type: 'code', text: value });
const BREAK = { type: 'break' };

const BLOCK_KEYS = {
  heading: ['type', 'level', 'id', 'inline'], paragraph: ['type', 'inline'], note: ['type', 'inline'],
  divider: ['type', 'label'], list: ['type', 'ordered', 'start', 'items'], table: ['type', 'header', 'rows'],
  quote: ['type', 'blocks'], code: ['type', 'text'],
};
const INLINE_KEYS = {
  text: ['type', 'text'], strong: ['type', 'inline'], em: ['type', 'inline'], code: ['type', 'text'],
  link: ['type', 'href', 'inline'], break: ['type'],
};

// Vérifie que l'arbre ne contient que les formes de nœuds prévues, et que du texte dans ses feuilles
function checkInline(nodes) {
  assert.ok(Array.isArray(nodes));
  for (const node of nodes) {
    assert.ok(Object.hasOwn(INLINE_KEYS, node.type), `nœud en ligne inconnu : ${node.type}`);
    for (const key of Object.keys(node)) assert.ok(INLINE_KEYS[node.type].includes(key), `${node.type}.${key}`);
    if ('text' in node) assert.equal(typeof node.text, 'string');
    if ('href' in node) assert.match(node.href, /^https?:\/\//);
    if ('inline' in node) checkInline(node.inline);
  }
}
function checkBlocks(blocks) {
  assert.ok(Array.isArray(blocks));
  for (const block of blocks) {
    assert.ok(Object.hasOwn(BLOCK_KEYS, block.type), `bloc inconnu : ${block.type}`);
    for (const key of Object.keys(block)) assert.ok(BLOCK_KEYS[block.type].includes(key), `${block.type}.${key}`);
    if (block.type === 'code') assert.equal(typeof block.text, 'string');
    if ('inline' in block) checkInline(block.inline);
    if ('blocks' in block) checkBlocks(block.blocks);
    if (block.type === 'list') block.items.forEach(checkBlocks);
    if (block.type === 'table') {
      block.header.forEach(checkInline);
      block.rows.forEach((row) => row.forEach(checkInline));
    }
  }
}
const SAMPLES = [];
function parse(source) {
  SAMPLES.push(source);
  return parseMarkdown(source);
}

test('titre de niveau 3 : il reçoit son repère de section', () => {
  assert.deepEqual(parse('### 1. RESTAURATION DU SENS'),
    [{ type: 'heading', level: 3, id: 'section-1', inline: [text('1. RESTAURATION DU SENS')] }]);
});

test('outline : les titres de niveau 3, dans l’ordre', () => {
  const blocks = parse('# A\n\n## B\n\n### 1. Premier\ntexte\n\n### 2. **Second**\n');
  assert.deepEqual(outline(blocks), [{ id: 'section-1', title: '1. Premier' }, { id: 'section-2', title: '2. Second' }]);
  assert.deepEqual(blocks.filter((block) => block.type === 'heading').map((block) => [block.level, block.id]),
    [[1, undefined], [2, undefined], [3, 'section-1'], [3, 'section-2']]);
  assert.deepEqual(outline(parse('texte seul')), []);
});

test('un dièse sans espace n’est pas un titre', () => {
  assert.deepEqual(parse('#mot'), [para(text('#mot'))]);
});

test('un titre peut être suivi de son texte sans ligne vide', () => {
  assert.deepEqual(parse('### 1. T\nL’amorce\n- a'), [
    { type: 'heading', level: 3, id: 'section-1', inline: [text('1. T')] },
    para(text('L’amorce')),
    { type: 'list', ordered: false, items: [[para(text('a'))]] },
  ]);
});

test('gras, italique, code', () => {
  assert.deepEqual(parseInline('**gras** et *italique* et `code`'),
    [strong(text('gras')), text(' et '), em(text('italique')), text(' et '), code('code')]);
  assert.deepEqual(parseInline('__gras__ et _italique_'), [strong(text('gras')), text(' et '), em(text('italique'))]);
});

test('italique dans du gras, comme dans les analyses', () => {
  assert.deepEqual(parseInline("**Ya'juj (préfixe *Ya-* — action active) :** la poussée"),
    [strong(text("Ya'juj (préfixe "), em(text('Ya-')), text(' — action active) :')), text(' la poussée')]);
  assert.deepEqual(parseInline('***gras italique***'), [em(strong(text('gras italique')))]);
  assert.deepEqual(parseInline('*« Ils déclarèrent »*'), [em(text('« Ils déclarèrent »'))]);
});

test('tiret bas dans un mot : jamais de l’italique', () => {
  const constant = 'GLOBAL_ADDRESS_SPACE // MULTI_DIMENSIONAL_STACK_LAYER';
  assert.deepEqual(parseInline(constant), [text(constant)]);
  assert.deepEqual(parseInline('snake_case_name et ROOT_AUTHORITY'), [text('snake_case_name et ROOT_AUTHORITY')]);
});

test('marques sans partenaire : du texte, tel quel', () => {
  for (const source of ['2 * 3 * 4', '**pas fermé', 'pas ouvert**', 'a * b', '_', '*', '`pas fermé']) {
    assert.deepEqual(parseInline(source), [text(source)], source);
  }
});

test('barre oblique inverse : la marque qui suit est du texte', () => {
  assert.deepEqual(parseInline('\\*pas italique\\*'), [text('*pas italique*')]);
  assert.deepEqual(parseInline('C:\\dossier'), [text('C:\\dossier')]);
});

test('code : rien n’y est interprété', () => {
  assert.deepEqual(parseInline('`**x** <b>`'), [code('**x** <b>')]);
  assert.deepEqual(parseInline('``a ` b``'), [code('a ` b')]);
  assert.deepEqual(parseInline('racine `R-H.-M` et `SYSTEM_SHIELD`'), [text('racine '), code('R-H.-M'), text(' et '), code('SYSTEM_SHIELD')]);
});

test('texte arabe : intact, avec ou sans mise en valeur', () => {
  assert.deepEqual(parseInline('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ'), [text('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ')]);
  assert.deepEqual(parseInline('**بِسْمِ** ٱللَّهِ'), [strong(text('بِسْمِ')), text(' ٱللَّهِ')]);
});

test('retour à la ligne dans un paragraphe : chaque ligne reste sur sa ligne', () => {
  assert.deepEqual(parse('[1] Premier\n[2] Second'), [para(text('[1] Premier'), BREAK, text('[2] Second'))]);
  assert.deepEqual(parse('a  \nb\\\nc'), [para(text('a'), BREAK, text('b'), BREAK, text('c'))]);
  assert.deepEqual(parse('a\n\nb'), [para(text('a')), para(text('b'))]);
});

test('listes : non ordonnée, ordonnée, imbriquée', () => {
  assert.deepEqual(parse('- a\n- b'), [{ type: 'list', ordered: false, items: [[para(text('a'))], [para(text('b'))]] }]);
  assert.deepEqual(parse('1. a\n2. b'), [{ type: 'list', ordered: true, start: 1, items: [[para(text('a'))], [para(text('b'))]] }]);
  assert.deepEqual(parse('- a\n  - b'),
    [{ type: 'list', ordered: false, items: [[para(text('a')), { type: 'list', ordered: false, items: [[para(text('b'))]] }]] }]);
  assert.deepEqual(parse('1. a\n   * b\n   * c\n2. d'), [{
    type: 'list', ordered: true, start: 1,
    items: [[para(text('a')), { type: 'list', ordered: false, items: [[para(text('b'))], [para(text('c'))]] }], [para(text('d'))]],
  }]);
});

test('liste ordonnée : son premier numéro est gardé', () => {
  assert.deepEqual(parse('3. c\n4. d'), [{ type: 'list', ordered: true, start: 3, items: [[para(text('c'))], [para(text('d'))]] }]);
});

test('liste : une ligne indentée appartient à l’élément, une ligne non indentée ouvre un paragraphe', () => {
  assert.deepEqual(parse('1. **Titre :**\n   Suite de l’élément.\n2. b'), [{
    type: 'list', ordered: true, start: 1,
    items: [[para(strong(text('Titre :')), BREAK, text('Suite de l’élément.'))], [para(text('b'))]],
  }]);
  assert.deepEqual(parse('- a\n- b\nL’action décrite.'),
    [{ type: 'list', ordered: false, items: [[para(text('a'))], [para(text('b'))]] }, para(text('L’action décrite.'))]);
});

test('liste : éléments séparés par une ligne vide, un seul et même ensemble', () => {
  assert.deepEqual(parse('- a\n\n- b'), [{ type: 'list', ordered: false, items: [[para(text('a'))], [para(text('b'))]] }]);
  assert.deepEqual(parse('- a\n\n    suite\n- b'),
    [{ type: 'list', ordered: false, items: [[para(text('a')), para(text('suite'))], [para(text('b'))]] }]);
});

test('une ligne indentée hors liste est un paragraphe, pas du code', () => {
  assert.deepEqual(parse('    texte indenté'), [para(text('texte indenté'))]);
});

const TABLE = [
  '| Mot Arabe | Racine | Équation Trilitère | Fonction Logique (Veritas) | Description (Veritas) |',
  '| :--- | :--- | :--- | :--- | :--- |',
  '| بِسْمِ | S-M-W | S (Signal/Flux) + M (Matrice) + W (Extension/Lien) | GLOBAL_ADDRESS_SPACE // MULTI_DIMENSIONAL_STACK_LAYER | Espace d’adressage global. |',
  '| ٱللَّهِ | A-L-H | A + L + H | ROOT_AUTHORITY // MASTER_NODE | Unique pointeur. |',
].join('\n');

test('tableau : en-tête, lignes, cellules', () => {
  const [table] = parse(TABLE);
  assert.equal(table.type, 'table');
  assert.equal(table.header.length, 5);
  assert.deepEqual(table.header[0], [text('Mot Arabe')]);
  assert.equal(table.rows.length, 2);
  assert.deepEqual(table.rows[0][0], [text('بِسْمِ')]);
  assert.deepEqual(table.rows[0][3], [text('GLOBAL_ADDRESS_SPACE // MULTI_DIMENSIONAL_STACK_LAYER')]);
  assert.deepEqual(table.rows[1].map((cell) => cell.length), [1, 1, 1, 1, 1]);
});

test('tableau : une ligne courte est complétée, une ligne longue ne perd aucun texte', () => {
  const [table] = parse('| a | b | c | d | e |\n|---|---|---|---|---|\n| 1 | 2 | 3 |\n| 1 | 2 | 3 | 4 | 5 | 6 | 7 |');
  assert.deepEqual(table.rows[0], [[text('1')], [text('2')], [text('3')], [], []]);
  assert.equal(table.rows[1].length, 5);
  const flat = plainText([table]);
  for (const cell of ['1', '2', '3', '4', '5', '6', '7']) assert.ok(flat.includes(cell), cell);
});

test('tableau : une barre échappée reste dans sa cellule', () => {
  const [table] = parse('| x | y |\n|---|---|\n| a \\| b | c |');
  assert.deepEqual(table.rows[0], [[text('a | b')], [text('c')]]);
});

test('une ligne avec des barres, sans ligne de séparation, reste du texte', () => {
  assert.deepEqual(parse('| a | b |'), [para(text('| a | b |'))]);
  assert.deepEqual(parse('texte | autre\n---'), [para(text('texte | autre')), { type: 'divider', label: null }]);
});

test('un tableau peut suivre un paragraphe sans ligne vide', () => {
  const blocks = parse('Voici :\n| a | b |\n|---|---|\n| 1 | 2 |\nfin');
  assert.deepEqual(blocks.map((block) => block.type), ['paragraph', 'table', 'paragraph']);
});

test('HTML brut : jamais interprété, toujours du texte', () => {
  for (const source of ['<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '<b>gras</b> et <i>italique</i>', '<a href="javascript:alert(1)">x</a>']) {
    assert.deepEqual(parse(source), [para(text(source))], source);
  }
});

test('safeHref : seulement http et https', () => {
  assert.equal(safeHref('https://ok.example/a?b=1'), 'https://ok.example/a?b=1');
  assert.match(safeHref('HTTP://OK.example'), /^http:\/\/ok\.example/);
  assert.match(safeHref('  https://ok.example  '), /^https:\/\/ok\.example/);
  for (const refused of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'java\nscript:alert(1)', 'data:text/html,x', 'vbscript:x', 'file:///c:/x', '/x', '//evil.example', 'x', '', null, undefined]) {
    assert.equal(safeHref(refused), null, String(refused));
  }
});

test('lien accepté : un nœud link ; lien refusé : le texte source, tel quel', () => {
  assert.deepEqual(parseInline('voir [le *site*](https://ok.example/a) ici'),
    [text('voir '), { type: 'link', href: 'https://ok.example/a', inline: [text('le '), em(text('site'))] }, text(' ici')]);
  for (const source of ['[x](javascript:alert(1))', '[lien](javascript:window.__xss=1)', '[x](/relatif)', '[x](data:text/html,y)', '[x]', '[x] (https://ok.example)']) {
    const nodes = parseInline(source);
    assert.deepEqual(nodes, [text(source)], source);
  }
});

test('note : le paragraphe qui s’ouvre sur le bouclier', () => {
  assert.deepEqual(parse('**🛡️ AVERTISSEMENT :** Veritas est un simple outil.'),
    [{ type: 'note', inline: [strong(text('🛡️ AVERTISSEMENT :')), text(' Veritas est un simple outil.')] }]);
  assert.equal(parse('🛡️ **AVERTISSEMENT SYSTÉMIQUE :** texte')[0].type, 'note');
  assert.equal(parse('**🛡️ WARNING:** Veritas is a tool.')[0].type, 'note');
  assert.equal(parse('Le symbole 🛡️ au milieu d’une phrase')[0].type, 'paragraph');
});

test('séparateurs, avec ou sans libellé', () => {
  assert.deepEqual(parse('--- DÉTAILS TECHNIQUES ---'), [{ type: 'divider', label: 'DÉTAILS TECHNIQUES' }]);
  assert.deepEqual(parse('--- SYSTEMIC WARNING ---'), [{ type: 'divider', label: 'SYSTEMIC WARNING' }]);
  for (const source of ['---', '***', '___', '- - -', '----------']) assert.deepEqual(parse(source), [{ type: 'divider', label: null }], source);
  assert.deepEqual(parse('texte\n\n---\n**🛡️ AVERTISSEMENT :** x').map((block) => block.type), ['paragraph', 'divider', 'note']);
});

test('citation', () => {
  assert.deepEqual(parse('> *« Ils déclarèrent »*\n> suite'),
    [{ type: 'quote', blocks: [para(em(text('« Ils déclarèrent »')), BREAK, text('suite'))] }]);
});

test('bloc de code : contenu gardé au caractère près', () => {
  assert.deepEqual(parse('```js\nconst a = "<script>";\n  **b**\n```\naprès'),
    [{ type: 'code', text: 'const a = "<script>";\n  **b**' }, para(text('après'))]);
  assert.deepEqual(parse('```\nnon fermé'), [{ type: 'code', text: 'non fermé' }]);
});

test('fins de ligne Windows : même résultat', () => {
  const source = '### 1. T\nL’amorce\n- a\n- b\n\n| x | y |\n|---|---|\n| 1 | 2 |\n\n--- FIN ---';
  assert.deepEqual(parse(source.replace(/\n/g, '\r\n')), parseMarkdown(source));
});

test('texte vide ou absent', () => {
  assert.deepEqual(parseMarkdown(''), []);
  assert.deepEqual(parseMarkdown(null), []);
  assert.deepEqual(parseMarkdown('\n\n  \n'), []);
  assert.deepEqual(parseInline(''), []);
});

test('plainText : tout le texte, dans l’ordre', () => {
  const flat = plainText(parse('### 1. T\nun **deux** `trois`\n- quatre\n\n' + TABLE + '\n\n--- CINQ ---\n> six'));
  const words = ['1. T', 'un', 'deux', 'trois', 'quatre', 'Mot Arabe', 'بِسْمِ', 'ٱللَّهِ', 'Unique pointeur.', 'CINQ', 'six'];
  let from = 0;
  for (const word of words) {
    const at = flat.indexOf(word, from);
    assert.ok(at >= from, word);
    from = at + word.length;
  }
});

test('splitTitle : la parenthèse finale d’un titre se détache, sans changer un caractère', () => {
  assert.deepEqual(splitTitle('1. RESTAURATION DU SENS LITTÉRAIRE (MÉCANIQUE PHYSIQUE ET BIOLOGIQUE)'),
    { main: '1. RESTAURATION DU SENS LITTÉRAIRE', tail: '(MÉCANIQUE PHYSIQUE ET BIOLOGIQUE)' });
  assert.deepEqual(splitTitle('4. SYSTEMIC DECOMPILATION (SOURCE CODE)'), { main: '4. SYSTEMIC DECOMPILATION', tail: '(SOURCE CODE)' });
  assert.deepEqual(splitTitle('3. CONCLUSION LOGIQUE ET TOPOLOGIQUE'), { main: '3. CONCLUSION LOGIQUE ET TOPOLOGIQUE', tail: '' });
  assert.deepEqual(splitTitle('(TOUT ENTRE PARENTHÈSES)'), { main: '(TOUT ENTRE PARENTHÈSES)', tail: '' });
  assert.deepEqual(splitTitle('A (b) c'), { main: 'A (b) c', tail: '' });
  assert.deepEqual(splitTitle(''), { main: '', tail: '' });
  for (const title of ['1. A (B)', '2. C', 'D (E (F))']) {
    const { main, tail } = splitTitle(title);
    assert.equal(tail ? `${main} ${tail}` : main, title);
  }
});

test('splitRoots : les codes de racines se repèrent, pour ne pas être coupés en fin de ligne', () => {
  const root = (text) => ({ text, root: true });
  const plain = (text) => ({ text, root: false });
  assert.deepEqual(splitRoots('issues de la même racine (R-H.-M, la matrice)'),
    [plain('issues de la même racine ('), root('R-H.-M'), plain(', la matrice)')]);
  assert.deepEqual(splitRoots('S-M-W et GH-D.-B puis A.-B-D'), [root('S-M-W'), plain(' et '), root('GH-D.-B'), plain(' puis '), root('A.-B-D')]);
  assert.deepEqual(splitRoots('DH-K-R'), [root('DH-K-R')]);
  assert.deepEqual(splitRoots('H.-S.-H.-S.'), [root('H.-S.-H.-S.')]);
  // Ce qui n'est pas une racine reste du texte ordinaire
  for (const text of ['Pay-As-You-Go', 'un mot-clé', 'CODE-SOURCE', 'ROOT_AUTHORITY // MASTER_NODE', 'verset 2:1-5', 'بِسْمِ ٱللَّهِ', '']) {
    assert.deepEqual(splitRoots(text), text ? [plain(text)] : [], text);
  }
  // Aucun caractère ne change
  for (const text of ['(R-H.-M / GH-D.-B) :', 'racine N-Y-R, puis S.-M-D.']) {
    assert.equal(splitRoots(text).map((part) => part.text).join(''), text);
  }
});

test('aucune autre forme de nœud que celles prévues', () => {
  assert.ok(SAMPLES.length > 40);
  for (const source of SAMPLES) checkBlocks(parseMarkdown(source));
  for (const source of ['**a** [b](https://ok.example) `c` *d*\ne', '<x>']) checkInline(parseInline(source));
});
