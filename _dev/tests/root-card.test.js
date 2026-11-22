import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rootTiles } from '../../assets/js/v2/lib/root-card.js';

const EQUATION = "S (Signal/Flux) + M (Matrice) + W (Extension/Lien) = Extension du flux matriciel vers l'espace d'adressage global multi-dimensionnel.";

test('équation de la forme X (…) + Y (…) + Z (…) = … : une tuile par lettre', () => {
  assert.deepEqual(rootTiles('س م و', EQUATION), [
    { letter: 'س', code: 'S', charge: 'Signal/Flux' },
    { letter: 'م', code: 'M', charge: 'Matrice' },
    { letter: 'و', code: 'W', charge: 'Extension/Lien' },
  ]);
});

test('codes à point ou à deux lettres, espaces en trop, parenthèses dans une charge', () => {
  assert.deepEqual(rootTiles(' ض  ر ب ', 'D. (Pression (onde))  +  R (Flux) + B (Interface) = Impact.'), [
    { letter: 'ض', code: 'D.', charge: 'Pression (onde)' },
    { letter: 'ر', code: 'R', charge: 'Flux' },
    { letter: 'ب', code: 'B', charge: 'Interface' },
  ]);
  assert.equal(rootTiles('ش ك ر', 'SH (Diffusion) + K (Cadre) + R (Flux) = Retour.')[0].code, 'SH');
});

test('équation traduite : la forme suffit, quelle que soit la langue', () => {
  assert.deepEqual(rootTiles('س م و', 'S (Signal/Flow) + M (Matrix) + W (Extension/Link) = Extension of the matrix flow.').map((tile) => tile.charge),
    ['Signal/Flow', 'Matrix', 'Extension/Link']);
});

test('autre forme : pas de tuiles', () => {
  for (const equation of ['', null, undefined, 42, 'Signal + Matrice + Lien = x', 'S (a) + M (b) + W (c)', 'S (a) + M (b) = x', 'S + M (b) + W (c) = x', 'S (a) + M (b) + W () = x', 'S (a) + M (b) + W (c) + X (d) = x']) {
    assert.equal(rootTiles('س م و', equation), null, String(equation));
  }
});

test('lettres absentes ou en nombre différent des termes : pas de tuiles', () => {
  assert.equal(rootTiles('', EQUATION), null);
  assert.equal(rootTiles(null, EQUATION), null);
  assert.equal(rootTiles('س م', EQUATION), null);
  assert.equal(rootTiles('سمو', EQUATION), null);
});
