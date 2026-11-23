// Destinations du site (lib/destinations.js) : le menu de l'ordinateur les porte toutes ; la barre d'onglets
// du téléphone n'a que quatre places pour les outils, le reste va sous « Plus ».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DESTINATIONS, menuDestinations, moreDestinations, tabDestinations } from '../../assets/js/v3/lib/destinations.js';

const ids = (list) => list.map((destination) => destination.id);

test('menu : Interpréteur, Tarteel, Séquenceur, Scanner, Corpus, dans cet ordre', () => {
  assert.deepEqual(ids(menuDestinations()), ['interpreteur', 'tarteel', 'sequenceur', 'scanner', 'corpus']);
});

test('barre d’onglets du téléphone : les quatre outils ; « Corpus » passe sous « Plus »', () => {
  assert.deepEqual(ids(tabDestinations()), ['interpreteur', 'tarteel', 'sequenceur', 'scanner']);
  assert.deepEqual(ids(moreDestinations()), ['corpus']);
});

test('une destination sans page n’apparaît nulle part', () => {
  const waiting = DESTINATIONS.filter((destination) => !destination.ready).map((destination) => destination.id);
  assert.deepEqual(waiting, ['bibliotheque']);
  for (const list of [menuDestinations(), tabDestinations(), moreDestinations()]) assert.ok(!ids(list).includes('bibliotheque'));
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
