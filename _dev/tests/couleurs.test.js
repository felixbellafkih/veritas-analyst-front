// Couleurs des deux thèmes (assets/css/base.css) : valeurs de la conception, et contraste d'au moins 4,5 pour 1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../assets/css/base.css', import.meta.url), 'utf8');

function variables(theme) {
  const block = new RegExp(`:root\\[data-theme="${theme}"\\]\\s*\\{([^}]*)\\}`).exec(css);
  assert.ok(block, `bloc du thème ${theme}`);
  return Object.fromEntries([...block[1].matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9A-Fa-f]{6})\s*;/g)].map((match) => [match[1], match[2].toUpperCase()]));
}

function luminance(hex) {
  const channel = (offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(first, second) {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

// Tableau de la conception (§6.5)
const SPEC = {
  nuit: {
    '--fond': '#0D1B2A', '--surface': '#13243A', '--bord': '#23384F', '--bord-fort': '#2A425C', '--bord-doux': '#1F3247',
    '--titre': '#E8EEF4', '--texte': '#D5DEE8', '--secondaire': '#9DB2C7', '--discret': '#8FA5BB', '--accent': '#4DD0E1',
    '--bouton-fond': '#4DD0E1', '--bouton-texte': '#062430', '--arabe': '#F3EFE4',
  },
  jour: {
    '--fond': '#F5F7FA', '--surface': '#FFFFFF', '--bord': '#DDE4EC', '--bord-fort': '#C5D0DC', '--bord-doux': '#D3DCE6',
    '--titre': '#0D1B2A', '--texte': '#22303D', '--secondaire': '#44586C', '--discret': '#5A6D80', '--accent': '#0B7285',
    '--bouton-fond': '#0D1B2A', '--bouton-texte': '#FFFFFF', '--arabe': '#0D1B2A',
  },
};

// Couples texte / fond employés par l'interface
const PAIRS = [
  ['--titre', '--fond'], ['--titre', '--surface'], ['--texte', '--fond'], ['--texte', '--surface'],
  ['--secondaire', '--fond'], ['--secondaire', '--surface'], ['--secondaire', '--barre'],
  ['--discret', '--fond'], ['--discret', '--surface'],
  ['--accent', '--fond'], ['--accent', '--surface'], ['--accent', '--barre'],
  ['--bouton-texte', '--bouton-fond'], ['--bouton-texte', '--bouton-survol'],
  ['--arabe', '--surface'], ['--arabe', '--fond'],
  ['--fort', '--fond'], ['--fort', '--surface-2'], ['--fort', '--surface-3'], ['--texte', '--surface-2'],
  ['--erreur', '--fond'], ['--erreur', '--surface'], ['--reussite', '--fond'], ['--reussite', '--surface'],
  ['--attention', '--fond'], ['--attention', '--surface'],
];

for (const theme of ['nuit', 'jour']) {
  test(`thème ${theme} : les couleurs de la conception`, () => {
    const found = variables(theme);
    for (const [name, value] of Object.entries(SPEC[theme])) assert.equal(found[name], value, name);
  });

  test(`thème ${theme} : contraste d’au moins 4,5 pour 1 sur chaque couple texte / fond`, () => {
    const found = variables(theme);
    for (const [text, background] of PAIRS) {
      assert.ok(found[text], `${text} absent`);
      assert.ok(found[background], `${background} absent`);
      const ratio = contrast(found[text], found[background]);
      assert.ok(ratio >= 4.5, `${text} sur ${background} : ${ratio.toFixed(2)}`);
    }
  });
}

test('ni vert « Matrix », ni or, ni violet de l’app actuelle', () => {
  for (const old of ['#00ff41', '#ffd700', '#deff9a']) assert.ok(!css.toLowerCase().includes(old), old);
});
