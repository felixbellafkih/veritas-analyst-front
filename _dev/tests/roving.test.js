// Déplacement du curseur dans une longue liste (lib/roving.js) : la liste n'offre qu'un arrêt à la touche
// Tab, et les flèches passent d'une ligne à l'autre. Sans cela, une racine à 1 879 versets imposerait
// 1 879 tabulations avant d'atteindre le bouton « Analyser ».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasModifier, nextIndex } from '../../assets/js/v5/lib/roving.js';

test('flèches : la ligne suivante, la précédente, sans sortir de la liste', () => {
  assert.equal(nextIndex(0, 'ArrowDown', 5), 1);
  assert.equal(nextIndex(3, 'ArrowUp', 5), 2);
  assert.equal(nextIndex(4, 'ArrowDown', 5), 4);
  assert.equal(nextIndex(0, 'ArrowUp', 5), 0);
});

test('Début et Fin : la première et la dernière ligne', () => {
  assert.equal(nextIndex(3, 'Home', 5), 0);
  assert.equal(nextIndex(1, 'End', 5), 4);
});

test('une autre touche, ou une liste vide : pas de déplacement', () => {
  for (const key of ['Tab', 'Enter', ' ', 'a', 'ArrowLeft', 'ArrowRight', 'PageDown']) assert.equal(nextIndex(2, key, 5), null, key);
  assert.equal(nextIndex(0, 'ArrowDown', 0), null);
  assert.equal(nextIndex(0, 'End', 0), null);
});

test('un rang hors de la liste est ramené dans la liste', () => {
  assert.equal(nextIndex(-1, 'ArrowDown', 5), 0);
  assert.equal(nextIndex(9, 'ArrowUp', 5), 4);
  assert.equal(nextIndex(9, 'ArrowDown', 5), 4);
});

// Relecture de l'étape 3 : Alt+← (page précédente) était avalé par les listes à curseur unique
test('hasModifier : une touche tenue avec Alt, Ctrl, Cmd ou Maj n’est pas pour la liste', () => {
  for (const name of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey']) assert.equal(hasModifier({ key: 'ArrowLeft', [name]: true }), true, name);
  assert.equal(hasModifier({ key: 'ArrowLeft' }), false);
  assert.equal(hasModifier({ key: 'ArrowLeft', altKey: false, shiftKey: false }), false);
  assert.equal(hasModifier(null), false);
});
