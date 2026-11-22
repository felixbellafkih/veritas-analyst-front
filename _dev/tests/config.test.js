import { test } from 'node:test';
import assert from 'node:assert/strict';
import { API_PROD, CLASSIC_URL, STORAGE, apiBase } from '../../assets/js/v1/lib/config.js';

test('constantes', () => {
  assert.equal(API_PROD, 'https://api.veritas-analyst.org');
  assert.equal(CLASSIC_URL, 'https://veritas-analyst.streamlit.app');
  assert.deepEqual(STORAGE, {
    theme: 'veritas.theme', lang: 'veritas.lang', key: 'veritas.cle', dev: 'veritas.dev',
    conversation: 'veritas.conversation', model: 'veritas.modele', form: 'veritas.formulaire',
  });
});

test('en ligne, l’adresse de l’API ne se remplace jamais par un paramètre', () => {
  const site = { hostname: 'veritas-analyst.org', origin: 'https://veritas-analyst.org' };
  assert.equal(apiBase({ ...site, search: '' }), API_PROD);
  assert.equal(apiBase({ ...site, search: '?api=reel' }), API_PROD);
  assert.equal(apiBase({ ...site, search: '?api=https://evil.example' }), API_PROD);
});

test('un hôte qui ressemble à localhost n’est pas localhost', () => {
  assert.equal(apiBase({ hostname: 'localhost.evil.example', origin: 'https://localhost.evil.example', search: '' }), API_PROD);
  assert.equal(apiBase({ hostname: 'evil-localhost', origin: 'https://evil-localhost', search: '' }), API_PROD);
});

test('en local, le faux serveur sert par défaut, la vraie API sur demande', () => {
  assert.equal(apiBase({ hostname: 'localhost', origin: 'http://localhost:8787', search: '' }), 'http://localhost:8787/__api');
  assert.equal(apiBase({ hostname: 'localhost', origin: 'http://localhost:8787', search: '?api=autre' }), 'http://localhost:8787/__api');
  assert.equal(apiBase({ hostname: 'localhost', origin: 'http://localhost:8787', search: '?s=1&api=reel' }), API_PROD);
  assert.equal(apiBase({ hostname: '127.0.0.1', origin: 'http://127.0.0.1:8787', search: '?api=reel' }), API_PROD);
});

test('sans page (Node), l’adresse est celle de production', () => {
  assert.equal(apiBase(undefined), API_PROD);
});
