// Destinations du site (lib/destinations.js) : le menu de l'ordinateur les porte toutes ; la barre d'onglets
// du téléphone n'a que quatre places pour les outils, le reste va sous « Plus ».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DESTINATIONS, menuDestinations, moreDestinations, tabDestinations } from '../../assets/js/v4/lib/destinations.js';

const ids = (list) => list.map((destination) => destination.id);

test('menu : Interpréteur, Tarteel, Séquenceur, Scanner, Corpus, Bibliothèque, dans cet ordre', () => {
  assert.deepEqual(ids(menuDestinations()), ['interpreteur', 'tarteel', 'sequenceur', 'scanner', 'corpus', 'bibliotheque']);
});

test('barre d’onglets du téléphone : les quatre outils ; « Corpus » et « Bibliothèque » sont sous « Plus »', () => {
  assert.deepEqual(ids(tabDestinations()), ['interpreteur', 'tarteel', 'sequenceur', 'scanner']);
  assert.deepEqual(ids(moreDestinations()), ['corpus', 'bibliotheque']);
});

test('plus aucune destination en attente : chacune a sa page', () => {
  assert.deepEqual(DESTINATIONS.filter((destination) => !destination.ready), []);
  assert.equal(DESTINATIONS.find((destination) => destination.id === 'bibliotheque').href, '/bibliotheque/');
});

test('une destination sans page n’apparaîtrait nulle part', () => {
  const ready = (destination) => destination.ready;
  assert.deepEqual(ids(menuDestinations()), ids(DESTINATIONS.filter(ready)));
  assert.deepEqual([...ids(tabDestinations()), ...ids(moreDestinations())].sort(), ids(menuDestinations()).sort());
});

test('chaque destination a son adresse, son icône et son nom', () => {
  for (const destination of DESTINATIONS) {
    assert.match(destination.href, /^\/[a-z]+\/$/, destination.id);
    assert.equal(typeof destination.icon, 'string');
    assert.ok(destination.label);
  }
  assert.equal(DESTINATIONS.find((destination) => destination.id === 'sequenceur').href, '/sequenceur/');
  assert.equal(DESTINATIONS.find((destination) => destination.id === 'corpus').hrefOther, '/en/corpus/');
});
