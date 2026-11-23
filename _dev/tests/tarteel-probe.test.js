// Vérification d'une saisie du mode Tarteel (lib/tarteel-probe.js), avec une fausse API et une fausse minuterie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiFailure } from '../../assets/js/v3/lib/failures.js';
import { createTarteelProbe } from '../../assets/js/v3/lib/tarteel-probe.js';

const tick = () => new Promise((resolve) => setImmediate(resolve));

function fakeTimers() {
  let next = 1;
  const pending = new Map();
  return {
    set: (run, ms) => {
      const id = next;
      next += 1;
      pending.set(id, { run, ms });
      return id;
    },
    clear: (id) => pending.delete(id),
    count: () => pending.size,
    delays: () => [...pending.values()].map((entry) => entry.ms),
    fire: () => {
      const entries = [...pending.values()];
      pending.clear();
      for (const entry of entries) entry.run();
    },
  };
}

// Chaque appel reste en attente jusqu'à ce que le test le résolve ou le rejette
function fakeApi() {
  const calls = [];
  const record = (call) => new Promise((resolve, reject) => {
    calls.push({ ...call, resolve, reject });
  });
  return {
    calls,
    frequencies: (primary, constraint, { signal }) => record({ kind: 'frequencies', primary, constraint, signal }),
    cluster: (primary, constraint, limit, { signal }) => record({ kind: 'cluster', primary, constraint, limit, signal }),
  };
}

function setup() {
  const api = fakeApi();
  const timers = fakeTimers();
  const views = [];
  const probe = createTarteelProbe({ api, onChange: (view) => views.push(view), setTimer: timers.set, clearTimer: timers.clear });
  return { api, timers, views, probe };
}

const VERSES = ['[2:22] : a', '[2:164] : b', '[3:5] : c'];

// Mène une saisie jusqu'aux fréquences demandées
async function asked(context, primary, constraint = '') {
  context.probe.input(primary, constraint);
  context.timers.fire();
  await tick();
  return context.api.calls.at(-1);
}

// Mène une saisie jusqu'au cluster lu : les versets sont à l'écran, aucun n'est coché
async function ready(context, primary = 'S-M-W', constraint = 'N-Z-L', verses = VERSES) {
  (await asked(context, primary, constraint)).resolve({ primaryFrequency: 352, clusterFrequency: verses.length });
  await tick();
  context.api.calls.at(-1).resolve(verses);
  await tick();
}

test('pas de racine primaire : rien à vérifier, aucun appel', async () => {
  const { api, timers, views, probe } = setup();
  probe.input('   ', 'N-Z-L');
  assert.deepEqual(views.at(-1), { step: 'vide' });
  assert.equal(timers.count(), 0);
  assert.equal(api.calls.length, 0);
  assert.equal(probe.passage(), null);
});

test('saisie : la vérification attend 400 ms après la dernière frappe, puis demande les fréquences une fois', async () => {
  const { api, timers, views, probe } = setup();
  probe.input('S', '');
  probe.input('S-M', '');
  probe.input(' S-M-W ', ' N-Z-L ');
  assert.equal(views.at(-1).step, 'attente');
  assert.equal(api.calls.length, 0);
  assert.deepEqual(timers.delays(), [400]);
  timers.fire();
  await tick();
  assert.equal(api.calls.length, 1);
  assert.deepEqual([api.calls[0].kind, api.calls[0].primary, api.calls[0].constraint], ['frequencies', 'S-M-W', 'N-Z-L']);
});

test('aucune occurrence : le signal est annoncé, le cluster n’est pas lu', async () => {
  const context = setup();
  (await asked(context, 'X-X-X')).resolve({ primaryFrequency: 0, clusterFrequency: 0 });
  await tick();
  assert.deepEqual(context.views.at(-1), { step: 'signal', state: 'aucune', count: 0 });
  assert.equal(context.api.calls.length, 1);
  assert.equal(context.probe.passage(), null);
});

test('une racine très fréquente n’est plus refusée : tous ses versets sont demandés', async () => {
  const cases = [
    [['S-M-W', ''], { primaryFrequency: 352, clusterFrequency: 352 }, 352],
    [['S-M-W', 'A-R-D.'], { primaryFrequency: 352, clusterFrequency: 224 }, 224],
    [['S-M-W', 'N-Z-L'], { primaryFrequency: 352, clusterFrequency: 47 }, 47],
  ];
  for (const [roots, frequencies, count] of cases) {
    const context = setup();
    (await asked(context, ...roots)).resolve(frequencies);
    await tick();
    assert.deepEqual(context.views.at(-1), { step: 'lecture', count });
    const call = context.api.calls.at(-1);
    assert.deepEqual([call.kind, call.primary, call.constraint, call.limit], ['cluster', roots[0], roots[1], count]);
  }
});

test('cluster lu : les versets sont à l’écran, aucun n’est coché, rien ne peut partir', async () => {
  const context = setup();
  await ready(context);
  assert.deepEqual(context.views.at(-1), { step: 'pret', count: 3, verses: VERSES });
  assert.deepEqual(context.probe.selection(), { chosen: 0, total: 3 });
  assert.equal(context.probe.passage(), null);
});

test('les versets cochés partent seuls, dans l’ordre du cluster', async () => {
  const context = setup();
  await ready(context);
  context.probe.select(2, true);
  assert.deepEqual(context.probe.passage(), { primary: 'S-M-W', constraint: 'N-Z-L', verses: ['[3:5] : c'] });
  context.probe.select(0, true);
  assert.deepEqual(context.probe.passage().verses, ['[2:22] : a', '[3:5] : c']);
  assert.deepEqual(context.probe.selection(), { chosen: 2, total: 3 });
  assert.equal(context.probe.isSelected(0), true);
  assert.equal(context.probe.isSelected(1), false);
  context.probe.select(2, false);
  assert.deepEqual(context.probe.passage().verses, ['[2:22] : a']);
  context.probe.select(0, false);
  assert.equal(context.probe.passage(), null);
});

test('tout sélectionner, tout désélectionner', async () => {
  const context = setup();
  await ready(context);
  context.probe.selectAll(true);
  assert.deepEqual(context.probe.selection(), { chosen: 3, total: 3 });
  assert.deepEqual(context.probe.passage().verses, VERSES);
  context.probe.selectAll(false);
  assert.deepEqual(context.probe.selection(), { chosen: 0, total: 3 });
  assert.equal(context.probe.passage(), null);
});

test('cocher ne redemande rien au serveur et n’annonce rien', async () => {
  const context = setup();
  await ready(context);
  const calls = context.api.calls.length;
  const views = context.views.length;
  context.probe.select(1, true);
  context.probe.selectAll(true);
  assert.equal(context.api.calls.length, calls);
  assert.equal(context.views.length, views);
});

test('une case qui ne correspond à aucun verset, ou cochée avant la lecture du cluster, est sans effet', async () => {
  const context = setup();
  (await asked(context, 'S-M-W', 'N-Z-L')).resolve({ primaryFrequency: 352, clusterFrequency: 3 });
  await tick();
  context.probe.select(0, true); // le cluster n'est pas encore lu
  context.probe.selectAll(true);
  assert.deepEqual(context.probe.selection(), { chosen: 0, total: 0 });
  context.api.calls.at(-1).resolve(VERSES);
  await tick();
  assert.deepEqual(context.probe.selection(), { chosen: 0, total: 3 });
  context.probe.select(3, true);
  context.probe.select(-1, true);
  context.probe.select(1.5, true);
  assert.deepEqual(context.probe.selection(), { chosen: 0, total: 3 });
  assert.equal(context.probe.passage(), null);
});

test('une frappe vide la sélection : le cluster suivant arrive sans case cochée', async () => {
  const context = setup();
  await ready(context);
  context.probe.selectAll(true);
  context.probe.input('S-M-W', 'N-Z'); // une frappe : rien n'est encore vérifié pour cette saisie
  assert.deepEqual(context.probe.selection(), { chosen: 0, total: 0 });
  assert.equal(context.probe.passage(), null);
  context.timers.fire();
  await tick();
  context.api.calls.at(-1).resolve({ primaryFrequency: 352, clusterFrequency: 2 });
  await tick();
  context.api.calls.at(-1).resolve(['[7:1] : x', '[7:2] : y']);
  await tick();
  assert.deepEqual(context.probe.selection(), { chosen: 0, total: 2 });
  assert.equal(context.probe.passage(), null);
});

test('le Kernel répond par un texte au lieu d’une liste : c’est un message, rien ne peut partir', async () => {
  const context = setup();
  (await asked(context, 'MESSAGE')).resolve({ primaryFrequency: 5, clusterFrequency: 5 });
  await tick();
  context.api.calls.at(-1).resolve('[WARNING KERNEL] Triangulation impossible.');
  await tick();
  assert.deepEqual(context.views.at(-1), { step: 'message', count: 5, text: '[WARNING KERNEL] Triangulation impossible.' });
  context.probe.selectAll(true);
  assert.equal(context.probe.passage(), null);
});

test('cluster vide, illisible ou introuvable (404) : aucun verset', async () => {
  for (const answer of [[], null, { cluster_list: [] }, new ApiFailure('http', { status: 404, detail: 'No occurrences found' })]) {
    const context = setup();
    (await asked(context, 'Q-W-L')).resolve({ primaryFrequency: 9, clusterFrequency: 9 });
    await tick();
    const call = context.api.calls.at(-1);
    if (answer instanceof ApiFailure) call.reject(answer);
    else call.resolve(answer);
    await tick();
    assert.deepEqual(context.views.at(-1), { step: 'absent', count: 9 });
    assert.equal(context.probe.passage(), null);
  }
});

test('échec des fréquences, ou fréquences de forme inattendue', async () => {
  const failed = setup();
  const failure = new ApiFailure('network');
  (await asked(failed, 'S-M-W')).reject(failure);
  await tick();
  assert.deepEqual(failed.views.at(-1), { step: 'echec', stage: 'frequences', failure });

  const odd = setup();
  (await asked(odd, 'S-M-W')).resolve({ primaryFrequency: undefined, clusterFrequency: undefined });
  await tick();
  assert.equal(odd.views.at(-1).step, 'echec');
  assert.equal(odd.views.at(-1).stage, 'frequences');
  assert.equal(odd.api.calls.length, 1);
});

test('échec à la lecture du cluster : le signal reste connu', async () => {
  const context = setup();
  (await asked(context, 'Q-W-L')).resolve({ primaryFrequency: 9, clusterFrequency: 9 });
  await tick();
  const failure = new ApiFailure('http', { status: 500, detail: 'x' });
  context.api.calls.at(-1).reject(failure);
  await tick();
  assert.deepEqual(context.views.at(-1), { step: 'echec', stage: 'cluster', failure, count: 9 });
  assert.equal(context.probe.passage(), null);
});

test('la saisie change pendant une vérification : l’ancienne réponse n’est jamais annoncée', async () => {
  const context = setup();
  const first = await asked(context, 'S.-M-D');
  context.probe.input('S-M-W', 'N-Z-L'); // le visiteur tape autre chose avant la réponse
  assert.equal(first.signal.aborted, true);
  first.resolve({ primaryFrequency: 1, clusterFrequency: 1 });
  await tick();
  assert.deepEqual(context.views.at(-1), { step: 'attente' });
  assert.equal(context.api.calls.length, 1, 'le cluster de l’ancienne saisie n’est pas demandé');
  assert.equal(context.probe.passage(), null);
  context.timers.fire();
  await tick();
  const second = context.api.calls.at(-1);
  assert.deepEqual([second.primary, second.constraint], ['S-M-W', 'N-Z-L']);
  second.resolve({ primaryFrequency: 352, clusterFrequency: 3 });
  await tick();
  context.api.calls.at(-1).resolve(VERSES);
  await tick();
  context.probe.selectAll(true);
  assert.deepEqual(context.probe.passage(), { primary: 'S-M-W', constraint: 'N-Z-L', verses: VERSES });
});

test('la saisie change pendant la lecture du cluster : les anciens versets ne servent pas', async () => {
  const context = setup();
  (await asked(context, 'S.-M-D')).resolve({ primaryFrequency: 1, clusterFrequency: 1 });
  await tick();
  const reading = context.api.calls.at(-1);
  assert.equal(reading.kind, 'cluster');
  context.probe.input('S-M-W', '');
  reading.resolve(['[112:2] : x']);
  await tick();
  assert.deepEqual(context.views.at(-1), { step: 'attente' });
  context.probe.selectAll(true);
  assert.equal(context.probe.passage(), null);
});

test('un cluster prêt cesse de l’être dès la frappe suivante', async () => {
  const context = setup();
  await ready(context, 'S.-M-D', '', ['[112:2] : x']);
  context.probe.selectAll(true);
  assert.notEqual(context.probe.passage(), null);
  context.probe.input('S.-M-D', 'N'); // une frappe : rien n'est encore vérifié pour cette saisie
  assert.equal(context.probe.passage(), null);
  context.probe.input('', '');
  assert.deepEqual(context.views.at(-1), { step: 'vide' });
  assert.equal(context.probe.passage(), null);
});

test('une demande abandonnée ne s’affiche pas comme un échec', async () => {
  const context = setup();
  const first = await asked(context, 'S-M-W');
  context.probe.input('S-M-W', 'N');
  first.reject(new ApiFailure('aborted'));
  await tick();
  assert.deepEqual(context.views.at(-1), { step: 'attente' });
});

test('flush : la vérification en attente part tout de suite, une seule fois', async () => {
  const context = setup();
  context.probe.input('S-M-W', '');
  context.probe.flush();
  await tick();
  assert.equal(context.api.calls.length, 1);
  assert.equal(context.timers.count(), 0);
  context.probe.flush(); // plus rien en attente : sans effet
  context.timers.fire();
  await tick();
  assert.equal(context.api.calls.length, 1);
});

test('check : revérifie les racines en place (bouton « Réessayer »)', async () => {
  const context = setup();
  (await asked(context, 'S-M-W')).reject(new ApiFailure('network'));
  await tick();
  context.probe.check();
  await tick();
  assert.equal(context.api.calls.length, 2);
  assert.deepEqual([context.api.calls[1].primary, context.api.calls[1].constraint], ['S-M-W', '']);
  context.api.calls[1].resolve({ primaryFrequency: 352, clusterFrequency: 352 });
  await tick();
  assert.deepEqual(context.views.at(-1), { step: 'lecture', count: 352 });
});

// ------------------------------------------------------------------ sélection reportée (étape 2)

test('selectMany : coche plusieurs versets d’un coup, sans rien annoncer ni redemander', async () => {
  const context = setup();
  await ready(context);
  const views = context.views.length;
  context.probe.selectMany([0, 2, 9, -1, 1.5, 2]);
  assert.deepEqual(context.probe.selection(), { chosen: 2, total: 3 });
  assert.deepEqual(context.probe.passage().verses, ['[2:22] : a', '[3:5] : c']);
  assert.equal(context.views.length, views);
  context.probe.selectMany(null);
  context.probe.selectMany('x');
  assert.deepEqual(context.probe.selection(), { chosen: 2, total: 3 });
});

test('selectMany : sans cluster lu, sans effet', async () => {
  const context = setup();
  context.probe.selectMany([0, 1]);
  assert.deepEqual(context.probe.selection(), { chosen: 0, total: 0 });
  (await asked(context, 'S-M-W', 'N-Z-L')).resolve({ primaryFrequency: 352, clusterFrequency: 3 });
  await tick();
  context.probe.selectMany([0, 1]); // les versets ne sont pas encore lus
  context.api.calls.at(-1).resolve(VERSES);
  await tick();
  assert.deepEqual(context.probe.selection(), { chosen: 0, total: 3 });
});
