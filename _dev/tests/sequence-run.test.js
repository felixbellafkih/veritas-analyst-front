// Déroulement d'un passage à séquencer (lib/sequence-run.js) : un bloc par verset, deux versets en cours au
// plus, l'ordre gardé, les réponses tardives ignorées, un échec qui ne touche que son bloc.
// La fausse API ne répond que lorsque le test le décide : chaque appel reste en main.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiFailure } from '../../assets/js/v2/lib/failures.js';
import { SEQUENCE_TEXT_MAX } from '../../assets/js/v2/lib/sequence.js';
import { createSequenceRun } from '../../assets/js/v2/lib/sequence-run.js';

const tick = () => new Promise((resolve) => setImmediate(resolve));
const ANSWER = { nodes: [{ id: 'node_0', type: 'OPERATOR', arabic: 'ب', tag: 'TOOL_WITH' }], edges: [], transcript: '*TOOL_WITH*', logs: ['[LEXER] Operator: ب -> TOOL_WITH'] };

function setup(options = {}) {
  const calls = [];
  const changes = [];
  const hold = (kind, args) => new Promise((resolve, reject) => {
    calls.push({ kind, args, signal: args[args.length - 1] && args[args.length - 1].signal, resolve, reject, settled: false });
  });
  const api = {
    verseRange: (...args) => hold('verse', args),
    sequence: (...args) => hold('sequence', args),
  };
  const run = createSequenceRun({ api, onChange: (view) => changes.push(view), ...options });
  const settle = async (call, how, value) => {
    call.settled = true;
    call[how](value);
    await tick();
  };
  return {
    run, calls, changes,
    open: () => calls.filter((call) => !call.settled),
    answer: (call, value) => settle(call, 'resolve', value),
    fail: (call, failure) => settle(call, 'reject', failure),
    steps: () => run.view().blocks.map((block) => block.step),
  };
}

// Mène un verset à son terme : son texte, puis sa séquence
async function finish(context, reference, data = ANSWER) {
  const [sura, verse] = reference.split(':').map(Number);
  const text = context.calls.find((call) => call.kind === 'verse' && !call.settled && call.args[0] === sura && call.args[1] === verse);
  await context.answer(text, `texte ${reference}`);
  const sequence = context.calls.find((call) => call.kind === 'sequence' && !call.settled && call.args[0] === `texte ${reference}`);
  await context.answer(sequence, data);
}

test('au départ : un bloc par verset, dans l’ordre, tous en attente', () => {
  const { run, changes } = setup();
  assert.deepEqual(run.view(), { mode: null, passage: null, blocks: [], pending: 0 });
  assert.equal(run.startPassage({ sura: 1, start: 1, end: 3 }), true);
  const view = run.view();
  assert.equal(view.mode, 'verset');
  assert.deepEqual(view.passage, { sura: 1, start: 1, end: 3 });
  assert.deepEqual(view.blocks, [1, 2, 3].map((verse) => ({ reference: `1:${verse}`, text: '', step: 'attente', sequence: null, failure: null })));
  assert.equal(view.pending, 3);
  assert.deepEqual(changes.at(-1), view);
});

test('chaque verset : son texte seul, puis sa séquence, sans rien d’autre que le texte et le signal', async () => {
  const context = setup();
  context.run.startPassage({ sura: 2, start: 255, end: 255 });
  assert.equal(context.calls.length, 1);
  assert.deepEqual(context.calls[0].args.slice(0, 3), [2, 255, 255]);
  await context.answer(context.calls[0], '﻿نص الآية');
  // Le texte est à l'écran avant la séquence, sans son caractère invisible ; il part tel qu'il a été reçu
  assert.deepEqual(context.run.view().blocks[0], { reference: '2:255', text: 'نص الآية', step: 'attente', sequence: null, failure: null });
  const sent = context.calls[1];
  assert.equal(sent.kind, 'sequence');
  assert.equal(sent.args.length, 2);
  assert.equal(sent.args[0], '﻿نص الآية');
  assert.deepEqual(Object.keys(sent.args[1]), ['signal']);
  await context.answer(sent, ANSWER);
  const block = context.run.view().blocks[0];
  assert.equal(block.step, 'pret');
  assert.equal(block.sequence.elements[0].label, 'TOOL_WITH');
  assert.equal(block.sequence.transcript, '*TOOL_WITH*');
  assert.equal(context.run.view().pending, 0);
});

test('les blocs gardent l’ordre des versets quand les réponses arrivent à l’envers', async () => {
  const context = setup();
  context.run.startPassage({ sura: 1, start: 1, end: 3 });
  await finish(context, '1:2');
  assert.deepEqual(context.steps(), ['attente', 'pret', 'attente']);
  await finish(context, '1:3');
  await finish(context, '1:1');
  assert.deepEqual(context.steps(), ['pret', 'pret', 'pret']);
  assert.deepEqual(context.run.view().blocks.map((block) => block.reference), ['1:1', '1:2', '1:3']);
  assert.deepEqual(context.run.view().blocks.map((block) => block.text), ['texte 1:1', 'texte 1:2', 'texte 1:3']);
});

test('dix versets : jamais plus de deux en cours, lancés dans l’ordre', async () => {
  const context = setup();
  assert.equal(context.run.startPassage({ sura: 2, start: 250, end: 290 }), true);
  assert.deepEqual(context.run.view().passage, { sura: 2, start: 250, end: 259 });
  assert.equal(context.run.view().blocks.length, 10);
  const inFlight = () => context.calls.filter((call) => call.kind === 'verse').length - context.steps().filter((step) => step !== 'attente').length;
  assert.equal(inFlight(), 2);
  let guard = 0;
  while (context.open().length) {
    const call = context.open()[0];
    await context.answer(call, call.kind === 'verse' ? `texte ${call.args[0]}:${call.args[1]}` : ANSWER);
    assert.ok(inFlight() <= 2, `${inFlight()} versets en cours`);
    assert.ok(context.open().length <= 2);
    guard += 1;
    assert.ok(guard < 50);
  }
  assert.deepEqual(context.steps(), Array(10).fill('pret'));
  assert.deepEqual(context.calls.filter((call) => call.kind === 'verse').map((call) => call.args[1]), [250, 251, 252, 253, 254, 255, 256, 257, 258, 259]);
});

test('un nouveau passage interrompt l’ancien, dont les réponses tardives ne changent rien', async () => {
  const context = setup();
  context.run.startPassage({ sura: 1, start: 1, end: 2 });
  const old = [...context.calls];
  await context.answer(old[0], 'texte 1:1');
  const oldSequence = context.calls.find((call) => call.kind === 'sequence');
  context.run.startPassage({ sura: 112, start: 1, end: 1 });
  assert.ok(old.every((call) => call.signal.aborted));
  assert.ok(oldSequence.signal.aborted);
  const before = context.changes.length;
  await context.answer(oldSequence, ANSWER);
  await context.answer(old[1], 'texte 1:2');
  assert.equal(context.changes.length, before);
  assert.deepEqual(context.run.view().blocks, [{ reference: '112:1', text: '', step: 'attente', sequence: null, failure: null }]);
  // L'ancien passage ne relance rien non plus : seul le verset du nouveau passage est en cours
  assert.equal(context.open().length, 1);
  assert.deepEqual(context.open()[0].args.slice(0, 3), [112, 1, 1]);
  await finish(context, '112:1');
  assert.deepEqual(context.steps(), ['pret']);
});

test('un verset en échec ne touche que son bloc ; « Réessayer » ne relance que lui', async () => {
  const context = setup();
  context.run.startPassage({ sura: 1, start: 1, end: 3 });
  const first = context.calls[0];
  await context.fail(first, new ApiFailure('http', { status: 404, detail: 'Verse 1:1 not found in local database.' }));
  assert.equal(context.run.view().blocks[0].step, 'echec');
  assert.equal(context.run.view().blocks[0].failure.status, 404);
  await finish(context, '1:2');
  await finish(context, '1:3');
  assert.deepEqual(context.steps(), ['echec', 'pret', 'pret']);
  assert.equal(context.open().length, 0);

  const before = context.calls.length;
  assert.equal(context.run.retry(1), false); // un bloc prêt ne se relance pas
  assert.equal(context.run.retry(9), false);
  assert.equal(context.calls.length, before);

  assert.equal(context.run.retry(0), true);
  assert.deepEqual(context.steps(), ['attente', 'pret', 'pret']);
  assert.equal(context.run.view().blocks[0].failure, null);
  assert.equal(context.calls.length, before + 1);
  assert.deepEqual(context.calls.at(-1).args.slice(0, 3), [1, 1, 1]);
  await finish(context, '1:1');
  assert.deepEqual(context.steps(), ['pret', 'pret', 'pret']);
});

test('échec à la séquence : le texte du verset reste, et « Réessayer » ne le relit pas', async () => {
  const context = setup();
  context.run.startPassage({ sura: 1, start: 1, end: 1 });
  await context.answer(context.calls[0], 'texte 1:1');
  await context.fail(context.calls[1], new ApiFailure('network', { detail: 'fetch failed' }));
  const block = context.run.view().blocks[0];
  assert.deepEqual([block.step, block.text, block.failure.kind], ['echec', 'texte 1:1', 'network']);
  context.run.retry(0);
  assert.equal(context.calls.length, 3);
  assert.equal(context.calls[2].kind, 'sequence');
  assert.equal(context.calls[2].args[0], 'texte 1:1');
  await context.answer(context.calls[2], ANSWER);
  assert.deepEqual(context.steps(), ['pret']);
});

test('texte libre : un seul bloc sans référence ; vide, rien ne part ; trop long, il est coupé', async () => {
  const context = setup();
  assert.equal(context.run.startText('   \n '), false);
  assert.equal(context.run.startText(null), false);
  assert.equal(context.calls.length, 0);
  assert.equal(context.changes.length, 0);

  assert.equal(context.run.startText('  بِسْمِ ٱللَّهِ  '), true);
  assert.deepEqual(context.run.view(), { mode: 'texte', passage: null, pending: 1, blocks: [{ reference: null, text: 'بِسْمِ ٱللَّهِ', step: 'attente', sequence: null, failure: null }] });
  assert.equal(context.calls.length, 1);
  assert.equal(context.calls[0].kind, 'sequence');
  assert.equal(context.calls[0].args[0], 'بِسْمِ ٱللَّهِ');
  await context.answer(context.calls[0], ANSWER);
  assert.deepEqual(context.steps(), ['pret']);

  context.run.startText('ب'.repeat(SEQUENCE_TEXT_MAX + 1000));
  assert.equal(SEQUENCE_TEXT_MAX, 5000);
  assert.equal(context.calls.at(-1).args[0].length, 5000);
});

test('passage impossible : rien ne part', () => {
  const context = setup();
  for (const doubtful of [null, undefined, {}, { sura: 115, start: 1, end: 1 }, { sura: 'x' }]) assert.equal(context.run.startPassage(doubtful), false);
  assert.equal(context.calls.length, 0);
  assert.equal(context.changes.length, 0);
});

test('une séquence sans élément : un bloc prêt, aux listes vides', async () => {
  const context = setup();
  context.run.startText('123');
  await context.answer(context.calls[0], { nodes: [], edges: [], transcript: '', logs: [] });
  assert.deepEqual(context.run.view().blocks[0].sequence, { elements: [], transcript: '', logs: [] });
  assert.equal(context.run.view().blocks[0].step, 'pret');
});

test('cancel : les demandes en cours sont interrompues, la vue se vide', async () => {
  const context = setup();
  context.run.startPassage({ sura: 1, start: 1, end: 2 });
  context.run.cancel();
  assert.ok(context.calls.every((call) => call.signal.aborted));
  assert.deepEqual(context.run.view(), { mode: null, passage: null, blocks: [], pending: 0 });
  const before = context.changes.length;
  await context.answer(context.calls[0], 'texte 1:1');
  assert.equal(context.changes.length, before);
  assert.equal(context.calls.length, 2);
});

test('la vue rendue est une copie : la modifier ne change pas le déroulement', async () => {
  const context = setup();
  context.run.startPassage({ sura: 1, start: 1, end: 1 });
  context.run.view().blocks[0].step = 'pret';
  context.run.view().blocks.length = 0;
  assert.deepEqual(context.steps(), ['attente']);
});
