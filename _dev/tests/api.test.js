// Appels à l'API (assets/js/api.js), éprouvés contre le faux serveur local.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../../assets/js/api.js';
import { ApiFailure } from '../../assets/js/lib/failures.js';
import { startServer } from '../serveur.mjs';

const BODY = { verse_text: 'texte envoyé', language: 'Français' };
let server;
let base;
let api;

before(async () => {
  server = await startServer({ port: 0, pingMs: 5 });
  base = `http://127.0.0.1:${server.port}/__api`;
  api = createApi({ base });
});

after(async () => {
  await server.close();
});

// La promesse doit être rejetée par un ApiFailure qui porte ces valeurs
async function fails(promise, expected) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof ApiFailure, `ApiFailure attendu, reçu : ${error}`);
    for (const [name, value] of Object.entries(expected)) {
      if (value instanceof RegExp) assert.match(error[name], value);
      else assert.equal(error[name], value, name);
    }
    return true;
  });
}

const journal = async () => (await fetch(`${base}/__demandes`)).json();

test('stats et racine', async () => {
  assert.equal(typeof (await api.stats()).total_roots, 'number');
  assert.equal((await api.root('S-M-W')).root, 'S-M-W');
  await fails(api.root('X-X-X'), { kind: 'http', status: 404, detail: 'Signal does not match any known physical root.' });
});

test('verseRange : le texte d’une plage', async () => {
  const text = await api.verseRange(1, 1, 2);
  assert.equal(typeof text, 'string');
  assert.ok(text.length > 20);
});

test('verseRange : verset absent', async () => {
  await fails(api.verseRange(9, 999, 999), { kind: 'http', status: 404, detail: 'Verse 9:999 not found in local database.' });
});

test('verseRange : demande abandonnée par la page', async () => {
  const controller = new AbortController();
  controller.abort();
  await fails(api.verseRange(1, 1, 1, { signal: controller.signal }), { kind: 'aborted' });
});

test('Tarteel : fréquences et cluster', async () => {
  assert.deepEqual(await api.frequencies('S-M-W', 'A-R-D.'), { primaryFrequency: 352, clusterFrequency: 224 });
  assert.deepEqual(await api.frequencies('S-M-W', ''), { primaryFrequency: 352, clusterFrequency: 352 });
  assert.equal((await api.cluster('S-M-W', 'N-Z-L', 30)).length, 30);
  await fails(api.cluster('Z-Z-Z', '', 30), { kind: 'http', status: 404 });
});

test('modèles : 401 sans clé, liste avec la clé', async () => {
  await fails(api.models({ key: '', devPassword: '' }), { kind: 'http', status: 401 });
  const { default: byDefault, models } = await api.models({ key: 'ok', devPassword: '' });
  assert.equal(byDefault, 'gemini-3.1-pro-preview');
  assert.equal(models.length, 3);
});

test('mode développeur', async () => {
  assert.equal(await api.devMode('dev'), true);
  await fails(api.devMode('x'), { kind: 'http', status: 401, detail: 'Unauthorized Access' });
});

test('analyse réussie : le texte du moteur, et les ping signalés', async () => {
  let pings = 0;
  const result = await api.analyze(BODY, { key: 'ok', devPassword: '' }, { onPing: () => { pings += 1; } });
  assert.ok(result.startsWith('**[TARGET:'));
  assert.ok(pings >= 1);
  assert.deepEqual((await journal()).last.body, BODY);
});

test('analyse : ligne error du flux', async () => {
  await fails(api.analyze(BODY, { key: 'erreur' }), { kind: 'stream', detail: /Faux serveur/ });
});

test('analyse : réponse du moteur sans en-tête', async () => {
  await fails(api.analyze(BODY, { key: 'echec' }), { kind: 'engine', detail: /^⚠️ ERREUR RUNTIME/ });
});

test('analyse : connexion coupée', async () => {
  await fails(api.analyze(BODY, { key: 'coupure' }), { kind: 'cut' });
});

test('analyse : sans clé ni mot de passe', async () => {
  await fails(api.analyze(BODY, { key: '', devPassword: '' }), { kind: 'http', status: 401, detail: 'Unauthorized: Valid API Key or Dev Password required' });
});

test('analyse : délai dépassé', async () => {
  await fails(api.analyze(BODY, { key: 'lent' }, { timeoutMs: 50 }), { kind: 'timeout' });
});

test('analyse : abandonnée par la page', async () => {
  const controller = new AbortController();
  const pending = api.analyze(BODY, { key: 'lent' }, { signal: controller.signal });
  setTimeout(() => controller.abort(), 30);
  await fails(pending, { kind: 'aborted' });
});

test('serveur arrêté : pas de réseau', async () => {
  const other = await startServer({ port: 0, pingMs: 5 });
  const { port } = other;
  await other.close();
  const offline = createApi({ base: `http://127.0.0.1:${port}/__api` });
  await fails(offline.stats(), { kind: 'network' });
  await fails(offline.analyze(BODY, { key: 'ok' }), { kind: 'network' });
});

test('un seul en-tête : le mot de passe développeur l’emporte sur la clé', async () => {
  await api.analyze(BODY, { key: 'ok', devPassword: 'dev' });
  assert.deepEqual((await journal()).last.headers, { hasKey: false, hasDevPassword: true });
});

test('clé que le navigateur ne peut pas transmettre : aucune demande ne part', async () => {
  const before = (await journal()).count;
  await fails(api.analyze(BODY, { key: 'clé-٣', devPassword: '' }), { kind: 'credential' });
  await fails(api.models({ key: 'a\nb', devPassword: '' }), { kind: 'credential' });
  assert.equal((await journal()).count, before);
});

test('réponse d’erreur qui n’est pas du JSON', async () => {
  const fake = createApi({ base: 'http://x', fetch: async () => ({ ok: false, status: 502, json: async () => { throw new Error('pas du JSON'); } }) });
  await fails(fake.stats(), { kind: 'http', status: 502, detail: '' });
});

test('navigateur sans lecture au fil de l’eau : la réponse entière, puis sa dernière ligne', async () => {
  const text = '{"type":"ping"}\n{"type":"result","result":"**[TARGET: m]** x\\n\\nok"}\n';
  const fake = createApi({ base: 'http://x', fetch: async () => ({ ok: true, status: 200, body: null, text: async () => text }) });
  assert.equal(await fake.analyze(BODY, { key: 'ok' }), '**[TARGET: m]** x\n\nok');
});

test('la demande part avec la clé dans son en-tête, et nulle part ailleurs', async () => {
  const seen = [];
  const fake = createApi({
    base: 'http://x',
    fetch: async (url, options) => {
      seen.push({ url, options });
      return { ok: true, status: 200, body: null, text: async () => '{"type":"result","result":"**[TARGET: m]** x\\n\\nok"}\n' };
    },
  });
  await fake.analyze(BODY, { key: 'CLE-SECRETE', devPassword: '' });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].url, 'http://x/analyze/interpreter/stream');
  assert.equal(seen[0].options.method, 'POST');
  assert.deepEqual(seen[0].options.headers, { 'Content-Type': 'application/json', 'X-API-Key': 'CLE-SECRETE' });
  assert.ok(!seen[0].url.includes('CLE-SECRETE'));
  assert.ok(!seen[0].options.body.includes('CLE-SECRETE'));
  assert.deepEqual(JSON.parse(seen[0].options.body), BODY);
});
