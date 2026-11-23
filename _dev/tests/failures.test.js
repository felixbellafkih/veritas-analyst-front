import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiFailure, BILLED_NOTICE, describeFailure, maybeBilled } from '../../assets/js/v6/lib/failures.js';

const DETAIL = 'DETAIL-TECHNIQUE-42';
const failure = (kind, status) => new ApiFailure(kind, { status, detail: DETAIL });

test('ApiFailure : une erreur qui porte son genre, son code et son détail', () => {
  const error = new ApiFailure('http', { status: 404, detail: 'Verse 9:999 not found in local database.' });
  assert.ok(error instanceof Error);
  assert.equal(error.kind, 'http');
  assert.equal(error.status, 404);
  assert.equal(error.detail, 'Verse 9:999 not found in local database.');
  const bare = new ApiFailure('network');
  assert.equal(bare.status, 0);
  assert.equal(bare.detail, '');
});

test('réseau : on peut réessayer, la clé n’est pas en cause', () => {
  const { retry, askKey } = describeFailure(failure('network'));
  assert.equal(retry, true);
  assert.equal(askKey, false);
});

test('401 : la clé est à revoir', () => {
  const { retry, askKey } = describeFailure(failure('http', 401));
  assert.equal(askKey, true);
  assert.equal(retry, false);
});

test('403 : adresse bloquée, ne pas réessayer', () => {
  const { retry, askKey } = describeFailure(failure('http', 403));
  assert.equal(retry, false);
  assert.equal(askKey, false);
});

test('404, 503 et 500 : trois messages différents', () => {
  const texts = [404, 503, 500].map((status) => describeFailure(failure('http', status)).text);
  assert.equal(new Set(texts).size, 3);
  assert.equal(describeFailure(failure('http', 502)).text, describeFailure(failure('http', 500)).text);
});

test('flux, moteur, coupure, délai : on peut réessayer', () => {
  for (const kind of ['stream', 'engine', 'cut', 'timeout']) {
    const { retry, askKey } = describeFailure(failure(kind));
    assert.equal(retry, true, kind);
    assert.equal(askKey, false, kind);
  }
});

test('clé ou mot de passe intransmissible : ne pas réessayer tel quel', () => {
  assert.equal(describeFailure(failure('credential')).retry, false);
});

test('chaque message est écrit, distinct par genre, et ne contient jamais le détail technique', () => {
  const kinds = [['network'], ['http', 401], ['http', 403], ['http', 404], ['http', 503], ['http', 500], ['stream'], ['engine'], ['cut'], ['timeout'], ['credential']];
  const texts = kinds.map(([kind, status]) => describeFailure(failure(kind, status)).text);
  for (const text of texts) {
    assert.ok(text && text.length > 10, text);
    assert.ok(!text.includes(DETAIL));
  }
  assert.equal(new Set(texts).size, kinds.length);
});

test('genre inconnu ou valeur inattendue : un message général, sans plantage', () => {
  assert.ok(describeFailure(failure('inconnu')).text.length > 10);
  assert.ok(describeFailure(new Error('boom')).text.length > 10);
  assert.ok(describeFailure(null).text.length > 10);
});

// Après une coupure ou un délai dépassé, le serveur a pu finir l'analyse : le visiteur doit le savoir avant de réessayer
test('coupure et délai dépassé : la demande est peut-être déjà facturée', () => {
  assert.equal(maybeBilled(new ApiFailure('cut')), true);
  assert.equal(maybeBilled(new ApiFailure('timeout')), true);
  for (const failure of [new ApiFailure('network'), new ApiFailure('http', { status: 500 }), new ApiFailure('http', { status: 401 }),
    new ApiFailure('stream'), new ApiFailure('engine'), new ApiFailure('credential'), new ApiFailure('aborted'), null, undefined, {}]) {
    assert.equal(maybeBilled(failure), false, JSON.stringify(failure));
  }
  assert.equal(typeof BILLED_NOTICE, 'string');
  assert.ok(BILLED_NOTICE.length > 20);
});

// Lectures publiques du Scanner et de la page Tarteel : ni analyse, ni clé
test('describeReadFailure : le réseau, un blocage, ou une erreur du serveur', async () => {
  const { describeReadFailure } = await import('../../assets/js/v6/lib/failures.js');
  assert.equal(describeReadFailure(new ApiFailure('network')), 'Connexion impossible. Vérifiez votre réseau, puis réessayez.');
  assert.equal(describeReadFailure(new ApiFailure('http', { status: 403 })), 'Accès bloqué par le serveur après trop d’essais. Réessayez plus tard.');
  for (const failure of [new ApiFailure('http', { status: 500 }), new ApiFailure('http', { status: 503 }), new ApiFailure('http', { status: 401 }), null, undefined, new ApiFailure('timeout')]) {
    assert.equal(describeReadFailure(failure), 'Le serveur a rencontré une erreur.', JSON.stringify(failure));
  }
});
