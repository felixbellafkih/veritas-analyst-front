// Tests du serveur local et du faux serveur d'API (_dev/serveur.mjs).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startServer } from '../serveur.mjs';

const UNAUTHORIZED = { detail: 'Unauthorized: Valid API Key or Dev Password required' };
let server;
let base;
let verses;
let analysis;

before(async () => {
  server = await startServer({ port: 0, pingMs: 5 });
  base = `http://127.0.0.1:${server.port}`;
  verses = JSON.parse(await readFile(new URL('../fixtures/versets.json', import.meta.url), 'utf8'));
  analysis = await readFile(new URL('../fixtures/analyse-1-1.txt', import.meta.url), 'utf8');
});

after(async () => {
  await server.close();
});

const api = (path, options) => fetch(base + '/__api' + path, options);
const stripAscii = (text) => text.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');

// Lit un flux NDJSON jusqu'au bout, même si la connexion est coupée en route
async function readLines(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let broken = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
    }
  } catch {
    broken = true;
  }
  return { broken, lines: text.split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line)) };
}

function analyze(key, body = { verse_text: 'texte envoyé' }, extraHeaders = {}) {
  const headers = { 'Content-Type': 'application/json', ...extraHeaders };
  if (key) headers['X-API-Key'] = key;
  return api('/analyze/interpreter/stream', { method: 'POST', headers, body: JSON.stringify(body) });
}

test('statique : sert les fichiers du dépôt, sans cache', async () => {
  const cname = await fetch(base + '/CNAME');
  assert.equal(cname.status, 200);
  assert.equal((await cname.text()).trim(), 'veritas-analyst.org');
  assert.equal(cname.headers.get('cache-control'), 'no-store');
  const corpus = await fetch(base + '/corpus/');
  assert.equal(corpus.status, 200);
  assert.match(corpus.headers.get('content-type'), /^text\/html/);
});

test('statique : comme GitHub Pages, rien sous un nom qui commence par _ ou .', async () => {
  assert.equal((await fetch(base + '/_dev/serveur.mjs')).status, 404);
  assert.equal((await fetch(base + '/.gitattributes')).status, 404);
  assert.equal((await fetch(base + '/inconnu/fichier.txt')).status, 404);
});

test('statique : ne sort jamais du dossier du dépôt', async () => {
  assert.equal((await fetch(base + '/%2e%2e/%2e%2e/Windows/win.ini')).status, 404);
  assert.equal((await fetch(base + '/corpus/..%2f..%2f..%2fWindows%2fwin.ini')).status, 404);
});

test('stats', async () => {
  const response = await api('/content/manifesto/stats');
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(typeof data.total_roots, 'number');
  assert.equal(data.status, 'ONLINE');
});

test('racine : S-M-W connue, autre racine inconnue', async () => {
  const found = await api('/analyze/root/S-M-W');
  assert.equal(found.status, 200);
  assert.equal((await found.json()).root_data.root, 'S-M-W');
  const missing = await api('/analyze/root/X-X-X');
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { detail: 'Signal does not match any known physical root.' });
});

test('sourates : limites et noms', async () => {
  const data = await (await api('/verse/metadata')).json();
  assert.equal(data.sura_limits['1'], 7);
  assert.equal(data.sura_names['114'], 'An-Nas');
});

test('plage : versets joints par une espace, U+FEFF gardé', async () => {
  const response = await api('/verse/range?sura=1&start=1&end=2');
  assert.equal(response.status, 200);
  const { verse_text } = await response.json();
  assert.equal(verse_text, stripAscii(verses['1:1']) + ' ' + stripAscii(verses['1:2']));
  assert.equal(verse_text.charCodeAt(0), 0xfeff);
});

test('verset absent', async () => {
  const response = await api('/verse/range?sura=9&start=999&end=999');
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { detail: 'Verse 9:999 not found in local database.' });
});

test('Tarteel : fréquences de la fixture, zéro pour une racine inconnue', async () => {
  assert.deepEqual(await (await api('/tarteel/frequencies?primary=S-M-W')).json(),
    { primary_root: 'S-M-W', constraint: '', primary_frequency: 352, cluster_frequency: 352 });
  assert.equal((await (await api('/tarteel/frequencies?primary=S-M-W&constraint=A-R-D.')).json()).cluster_frequency, 224);
  assert.equal((await (await api('/tarteel/frequencies?primary=Z-Z-Z')).json()).primary_frequency, 0);
});

test('Tarteel : cluster découpé par limit et offset', async () => {
  const thirty = await (await api('/tarteel/cluster?primary=S-M-W&constraint=N-Z-L&limit=30')).json();
  assert.equal(thirty.cluster_list.length, 30);
  assert.match(thirty.cluster_list[0], /^\[\d+:\d+\] : /);
  const byDefault = await (await api('/tarteel/cluster?primary=S-M-W&constraint=N-Z-L')).json();
  assert.equal(byDefault.cluster_list.length, 10);
  const shifted = await (await api('/tarteel/cluster?primary=S-M-W&constraint=N-Z-L&limit=5&offset=30')).json();
  assert.equal(shifted.cluster_list[0], (await (await api('/tarteel/cluster?primary=S-M-W&constraint=N-Z-L&limit=57')).json()).cluster_list[30]);
  const missing = await api('/tarteel/cluster?primary=Z-Z-Z');
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { detail: 'No occurrences found' });
});

test('Tarteel : la racine MESSAGE a 5 occurrences, et son cluster est un message du Kernel', async () => {
  const frequencies = await (await api('/tarteel/frequencies?primary=MESSAGE')).json();
  assert.equal(frequencies.primary_frequency, 5);
  assert.equal(frequencies.cluster_frequency, 5);
  const cluster = await api('/tarteel/cluster?primary=MESSAGE&limit=30');
  assert.equal(cluster.status, 200);
  assert.deepEqual(await cluster.json(), { cluster_list: '[WARNING KERNEL] Triangulation impossible.' });
});

test('modèles : 401 sans clé, liste avec la clé', async () => {
  const refused = await api('/models');
  assert.equal(refused.status, 401);
  assert.deepEqual(await refused.json(), UNAUTHORIZED);
  const data = await (await api('/models', { headers: { 'X-API-Key': 'ok' } })).json();
  assert.equal(data.default, 'gemini-3.1-pro-preview');
  assert.equal(data.models[0], 'gemini-3.1-pro-preview');
  assert.equal(data.models.length, 3);
});

test('mode développeur : mot de passe factice', async () => {
  const post = (password) => api('/auth/dev-mode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
  const granted = await post('dev');
  assert.equal(granted.status, 200);
  assert.equal((await granted.json()).dev_mode, true);
  const refused = await post('x');
  assert.equal(refused.status, 401);
  assert.deepEqual(await refused.json(), { detail: 'Unauthorized Access' });
});

test('analyse : 401 sans clé ni mot de passe, 401 avec un mauvais mot de passe', async () => {
  const none = await analyze('');
  assert.equal(none.status, 401);
  assert.deepEqual(await none.json(), UNAUTHORIZED);
  const wrong = await analyze('', undefined, { 'X-Dev-Password': 'x' });
  assert.equal(wrong.status, 401);
  assert.deepEqual(await wrong.json(), { detail: 'Unauthorized: Invalid Dev Password' });
});

test('flux ok : des ping, puis le résultat', async () => {
  const response = await analyze('ok');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/x-ndjson');
  const { lines, broken } = await readLines(response);
  assert.equal(broken, false);
  assert.deepEqual(lines.slice(0, -1), [{ type: 'ping' }, { type: 'ping' }, { type: 'ping' }]);
  assert.deepEqual(lines.at(-1), { type: 'result', result: analysis });
  assert.ok(analysis.startsWith('**[TARGET:'));
});

test('flux dev : le mot de passe factice vaut la clé ok', async () => {
  const { lines } = await readLines(await analyze('', undefined, { 'X-Dev-Password': 'dev' }));
  assert.deepEqual(lines.at(-1), { type: 'result', result: analysis });
});

test('flux anglais : titres en anglais', async () => {
  const { lines } = await readLines(await analyze('anglais'));
  assert.equal(lines.at(-1).type, 'result');
  assert.ok(lines.at(-1).result.startsWith('**[TARGET:'));
  assert.notEqual(lines.at(-1).result, analysis);
});

test('flux lent : plus de ping, puis le résultat', async () => {
  const { lines } = await readLines(await analyze('lent'));
  assert.ok(lines.filter((line) => line.type === 'ping').length >= 20);
  assert.equal(lines.at(-1).type, 'result');
});

test('flux erreur : ligne error', async () => {
  const { lines } = await readLines(await analyze('erreur'));
  assert.deepEqual(lines.at(-1), { type: 'error', detail: '500 INTERNAL. Faux serveur.' });
});

test('flux echec : résultat sans en-tête', async () => {
  const { lines } = await readLines(await analyze('echec'));
  assert.deepEqual(lines.at(-1), { type: 'result', result: '⚠️ ERREUR RUNTIME : API key not valid. Please pass a valid API key.' });
});

test('flux coupure : deux ping, aucun résultat', async () => {
  const { lines } = await readLines(await analyze('coupure'));
  assert.deepEqual(lines, [{ type: 'ping' }, { type: 'ping' }]);
});

test('flux entete : en-tête de forme inconnue', async () => {
  const { lines } = await readLines(await analyze('entete'));
  assert.deepEqual(lines.at(-1), { type: 'result', result: '**[TARGET: m]** quelque chose\n\n### 1. T\nok' });
});

test('flux hostile : contenu hostile après un en-tête normal', async () => {
  const { lines } = await readLines(await analyze('hostile'));
  const { result } = lines.at(-1);
  assert.ok(result.startsWith('**[TARGET: gemini-3.1-pro-preview]**'));
  for (const hostile of ['<script>window.__xss=1</script>', '<img src=x onerror="window.__xss=1">', '[lien](javascript:window.__xss=1)']) {
    assert.ok(result.includes(hostile), hostile);
  }
});

test('suite de conversation : la réponse reprend le message envoyé', async () => {
  const body = { verse_text: 'Objection 1', history: [{ role: 'user', text: 'a' }, { role: 'model', text: 'b' }] };
  const { lines } = await readLines(await analyze('ok', body));
  const { result } = lines.at(-1);
  assert.ok(result.startsWith('**[TARGET:'));
  assert.ok(result.endsWith('Réponse à : Objection 1'));
});

test('suite de conversation avec une clé d’échec : l’échec l’emporte', async () => {
  const body = { verse_text: 'Objection', history: [{ role: 'user', text: 'a' }, { role: 'model', text: 'b' }] };
  assert.deepEqual((await readLines(await analyze('echec', body))).lines.at(-1),
    { type: 'result', result: '⚠️ ERREUR RUNTIME : API key not valid. Please pass a valid API key.' });
  assert.equal((await readLines(await analyze('erreur', body))).lines.at(-1).type, 'error');
  assert.equal((await readLines(await analyze('coupure', body))).lines.some((line) => line.type === 'result'), false);
  const slow = await readLines(await analyze('lent', body));
  assert.ok(slow.lines.filter((line) => line.type === 'ping').length >= 20);
  assert.ok(slow.lines.at(-1).result.endsWith('Réponse à : Objection'));
});

test('journal : compte les analyses, garde la dernière, jamais la clé', async () => {
  assert.equal((await api('/__demandes', { method: 'DELETE' })).status, 200);
  await readLines(await analyze('ok', { verse_text: 'premier texte' }));
  await readLines(await analyze('ok', { verse_text: 'second texte', language: 'Français' }));
  await analyze(''); // refusée : ne compte pas
  const journal = await (await api('/__demandes')).json();
  assert.equal(journal.count, 2);
  assert.deepEqual(journal.last.body, { verse_text: 'second texte', language: 'Français' });
  assert.deepEqual(journal.last.headers, { hasKey: true, hasDevPassword: false });
  assert.ok(!JSON.stringify(journal.last).includes('ok'));
});

test('panne : toutes les routes de l’API répondent 503, puis reviennent', async () => {
  assert.equal((await api('/__panne?on=1')).status, 200);
  assert.equal((await api('/content/manifesto/stats')).status, 503);
  assert.equal((await api('/analyze/root/S-M-W')).status, 503);
  assert.equal((await api('/__panne?on=0')).status, 200);
  assert.equal((await api('/content/manifesto/stats')).status, 200);
});
