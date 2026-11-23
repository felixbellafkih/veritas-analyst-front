import { test } from 'node:test';
import assert from 'node:assert/strict';
import { API_PROD, CLASSIC_URL, STORAGE, apiBase, apiChoice } from '../../assets/js/v5/lib/config.js';

test('constantes', () => {
  assert.equal(API_PROD, 'https://api.veritas-analyst.org');
  assert.equal(CLASSIC_URL, 'https://veritas-analyst.streamlit.app');
  assert.deepEqual(STORAGE, {
    theme: 'veritas.theme', lang: 'veritas.lang', key: 'veritas.cle', dev: 'veritas.dev',
    conversation: 'veritas.conversation', model: 'veritas.modele', form: 'veritas.formulaire', api: 'veritas.api', handoff: 'veritas.tarteel',
    sequence: 'veritas.sequence',
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

// Défaut relevé à la relecture : chaque lien interne perdait ?api=reel, et l'essai retombait sans bruit sur
// le faux serveur, dont les analyses sont des textes enregistrés
test('en local, le choix de la vraie API tient pour l’onglet', () => {
  const local = { hostname: 'localhost', origin: 'http://localhost:8787' };
  assert.equal(apiChoice({ ...local, search: '?api=reel' }, null), 'reel');
  assert.equal(apiChoice({ ...local, search: '' }, 'reel'), 'reel');
  assert.equal(apiChoice({ ...local, search: '?s=1&de=1&a=7' }, 'reel'), 'reel');
  assert.equal(apiChoice({ ...local, search: '?api=faux' }, 'reel'), 'faux');
  assert.equal(apiChoice({ ...local, search: '' }, null), 'faux');
  assert.equal(apiChoice({ ...local, search: '' }, 'autre'), 'faux');
  assert.equal(apiBase({ ...local, search: '' }, 'reel'), API_PROD);
  assert.equal(apiBase({ ...local, search: '?api=faux' }, 'reel'), 'http://localhost:8787/__api');
  assert.equal(apiBase({ ...local, search: '' }, 'faux'), 'http://localhost:8787/__api');
});

test('en ligne, ni le paramètre ni un choix gardé ne comptent', () => {
  const site = { hostname: 'veritas-analyst.org', origin: 'https://veritas-analyst.org' };
  assert.equal(apiChoice({ ...site, search: '?api=reel' }, 'reel'), null);
  assert.equal(apiChoice(undefined, 'reel'), null);
  assert.equal(apiBase({ ...site, search: '' }, 'reel'), API_PROD);
  assert.equal(apiBase({ ...site, search: '?api=faux' }, 'faux'), API_PROD);
});
