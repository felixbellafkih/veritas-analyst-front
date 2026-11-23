// Lecture d'une séquence (lib/sequence.js), sur les réponses capturées de la vraie API (_dev/fixtures).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseSequence, sequenceCounts, transcriptCopy } from '../../assets/js/v3/lib/sequence.js';

const fixture = (name) => JSON.parse(readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), 'utf8'));
const SEQ = fixture('sequences.json');
// Le texte de chaque verset tel qu'il part au serveur (et tel que le faux serveur le rend)
const stripAscii = (text) => text.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');
const V = Object.fromEntries(Object.entries(fixture('versets.json')).map(([reference, text]) => [reference, stripAscii(text)]));
const pick = (object, names) => Object.fromEntries(names.map((name) => [name, object[name]]));
const kinds = (sequence) => sequence.elements.map((element) => element.kind);
const links = (sequence) => sequence.elements.map((element) => element.link);

const node = (id, extra) => ({ id, type: 'VARIABLE', arabic: 'كلمة', root: 'K-L-M', logic_mod: '[BASE_VARIABLE]', base_func: 'F', ...extra });
const chain = (count, type = 'solid') => Array.from({ length: count - 1 }, (_, index) => ({ from: `n${index}`, to: `n${index + 1}`, type }));

test('basmala : un opérateur puis quatre variables, reliés d’un trait plein', () => {
  const basmala = parseSequence(SEQ[V['1:1']]);
  assert.deepEqual(kinds(basmala), ['operator', 'variable', 'variable', 'variable', 'variable']);
  assert.deepEqual(links(basmala), [null, 'solid', 'solid', 'solid', 'solid']);
  assert.equal(basmala.elements[0].label, 'TOOL_WITH');
  assert.equal(basmala.elements[0].arabic, 'ب');
  assert.deepEqual(pick(basmala.elements[1], ['arabic', 'root', 'state', 'func']),
    { arabic: 'سم', root: 'S-M-W', state: '[SYSTEM_POINTER]', func: 'GLOBAL_ADDRESS_SPACE' });
  assert.deepEqual(pick(basmala.elements[1], ['inputs', 'outputs', 'quantifiers']), { inputs: [], outputs: [], quantifiers: [] });
  assert.match(basmala.transcript, /^\*TOOL_WITH\* ⛓️ /u);
  assert.equal(basmala.logs.length, 5);
  assert.equal(basmala.logs[0], '[LEXER] Operator: ب -> TOOL_WITH');
});

test('le trait qui mène à un opérateur est en pointillé ; quantificateurs et pointeurs sont lus', () => {
  const second = parseSequence(SEQ[V['1:2']]);
  assert.ok(second.elements.some((element) => element.link === 'dashed' && element.kind === 'operator'));
  assert.ok(second.elements.some((element) => element.quantifiers.includes('[DUAL_STATE]')));
  assert.ok(parseSequence(SEQ[V['1:4']]).elements.some((element) => element.outputs.includes('[USER_NODE]')));
});

test('mots sans racine connue, et texte hostile gardé tel quel', () => {
  const latin = parseSequence(SEQ['hello world']);
  assert.deepEqual(kinds(latin), ['unknown', 'unknown']);
  assert.deepEqual(pick(latin.elements[0], ['arabic', 'root', 'state', 'func']), { arabic: 'hello', root: '', state: '[BASE_VARIABLE]', func: '' });
  assert.equal(parseSequence(SEQ['<b>بِسْمِ</b>']).elements[0].arabic, '<b>بسم</b>');
  assert.deepEqual(kinds(parseSequence(SEQ['كمبيوتر'])), ['operator', 'unknown']);
});

test('une saisie sans mot : aucune carte, et rien ne casse', () => {
  assert.deepEqual(parseSequence(SEQ['123']), { elements: [], transcript: '', logs: [] });
});

test('comptes d’une séquence', () => {
  assert.deepEqual(sequenceCounts(parseSequence(SEQ[V['1:1']]).elements), { total: 5, variables: 4, operators: 1, unknown: 0 });
  assert.deepEqual(sequenceCounts(parseSequence(SEQ['كمبيوتر']).elements), { total: 2, variables: 0, operators: 1, unknown: 1 });
  assert.deepEqual(sequenceCounts(parseSequence(SEQ[V['2:255']]).elements), { total: 70, variables: 27, operators: 43, unknown: 0 });
  assert.deepEqual(sequenceCounts([]), { total: 0, variables: 0, operators: 0, unknown: 0 });
  // un type que le site ne connaît pas compte dans le total seulement
  assert.deepEqual(sequenceCounts(parseSequence({ nodes: [{ id: 'a', type: 'FUTUR', arabic: 'x' }] }).elements), { total: 1, variables: 0, operators: 0, unknown: 0 });
});

// L'hypothèse de la conception : séquencer verset par verset donne les mêmes éléments que séquencer le
// passage d'un bloc. Vérifiée ici sur ce que la vraie API a rendu.
for (const [sura, count] of [[1, 7], [112, 4]]) {
  test(`sourate ${sura} : verset par verset, les mêmes éléments que d’un bloc`, () => {
    const texts = Array.from({ length: count }, (_, index) => V[`${sura}:${index + 1}`]);
    const whole = parseSequence(SEQ[texts.join(' ')]).elements;
    const starts = new Set();
    const apart = [];
    for (const text of texts) {
      starts.add(apart.length);
      apart.push(...parseSequence(SEQ[text]).elements);
    }
    assert.ok(whole.length > count);
    // Seul le trait qui arrive au premier élément d'un verset diffère : il n'existe pas verset par verset
    assert.deepEqual(apart, whole.map((element, index) => (starts.has(index) ? { ...element, link: null } : element)));
  });
}

test('réponses douteuses : des listes vides, jamais une erreur', () => {
  for (const doubtful of [null, undefined, 'x', 12, [], {}, { nodes: 'x' }, { nodes: null }]) {
    assert.deepEqual(parseSequence(doubtful), { elements: [], transcript: '', logs: [] });
  }
  const mixed = parseSequence({ nodes: [null, 'x', node('n0'), 3], edges: [], transcript: 12, logs: ['a', 5, null, 'b'] });
  assert.equal(mixed.elements.length, 1);
  assert.equal(mixed.transcript, '');
  assert.deepEqual(mixed.logs, ['a', 'b']);
});

test('liens : ceux de l’API quand ils forment une chaîne droite, un trait simple sinon', () => {
  const nodes = [node('n0'), node('n1'), node('n2')];
  assert.deepEqual(links(parseSequence({ nodes, edges: chain(3, 'dashed') })), [null, 'dashed', 'dashed']);
  const plain = [null, 'plain', 'plain'];
  assert.deepEqual(links(parseSequence({ nodes })), plain);
  assert.deepEqual(links(parseSequence({ nodes, edges: chain(2) })), plain);
  assert.deepEqual(links(parseSequence({ nodes, edges: [...chain(3)].reverse() })), plain);
  assert.deepEqual(links(parseSequence({ nodes, edges: chain(3, 'courbe') })), plain);
  assert.deepEqual(links(parseSequence({ nodes, edges: [{ from: 'n0', to: 'n2', type: 'solid' }, { from: 'n1', to: 'n2', type: 'solid' }] })), plain);
  assert.deepEqual(links(parseSequence({ nodes, edges: [null, 'x'] })), plain);
  // un élément écarté rompt la correspondance des liens : trait simple partout
  assert.deepEqual(links(parseSequence({ nodes: [node('n0'), null, node('n2')], edges: chain(3) })), [null, 'plain']);
  assert.deepEqual(links(parseSequence({ nodes: [node('n0')], edges: [] })), [null]);
});

test('types et champs inattendus : chaque élément garde une carte', () => {
  const sequence = parseSequence({ nodes: [
    { id: 'n0', type: 'FUTUR', arabic: 'x' },
    { id: 'n1', type: 'VARIABLE', arabic: 'y', logic_mod: '[S]' },
    { id: 'n2', type: 'VARIABLE', arabic: 'z', root: '   ' },
    { id: 'n3', type: 'OPERATOR' },
    { id: 'n4', type: 'VARIABLE', arabic: 12, root: 'A-R-D.', logic_mod: null, base_func: 7, buses: [{}, 'A', 3], pointers: 'x', quantifiers: ['Q', null] },
    { id: 'n5' },
  ] });
  assert.deepEqual(kinds(sequence), ['other', 'unknown', 'unknown', 'operator', 'variable', 'other']);
  assert.equal(sequence.elements[0].label, 'FUTUR');
  assert.equal(sequence.elements[1].state, '[S]');
  assert.deepEqual(pick(sequence.elements[3], ['arabic', 'label']), { arabic: '', label: '' });
  assert.deepEqual(pick(sequence.elements[4], ['arabic', 'root', 'state', 'func', 'inputs', 'outputs', 'quantifiers']),
    { arabic: '', root: 'A-R-D.', state: '', func: '', inputs: ['A'], outputs: [], quantifiers: ['Q'] });
  assert.equal(sequence.elements[5].label, '');
});

test('transcriptCopy : chaque transcription sous sa référence, les blocs sans séquence écartés', () => {
  const blocks = [
    { reference: '1:1', sequence: { transcript: 'A ⛓️ B' } },
    { reference: '1:2', sequence: null },
    { reference: '1:3', sequence: { transcript: '' } },
    { reference: '1:4', sequence: { transcript: 'C' } },
  ];
  assert.equal(transcriptCopy(blocks), '1:1\nA ⛓️ B\n\n1:4\nC');
  assert.equal(transcriptCopy([{ reference: null, sequence: { transcript: 'A' } }]), 'A');
  assert.equal(transcriptCopy([]), '');
  assert.equal(transcriptCopy(null), '');
});
