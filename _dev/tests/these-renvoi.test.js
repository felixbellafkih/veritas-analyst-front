// /thesis/ : la vieille copie de la thèse (fichiers Markdown d'avril 2026) est remplacée, à l'étape 5, par quatre
// pages qui renvoient au chapitre correspondant de la Bibliothèque. Une adresse ancienne mène encore au bon chapitre.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { libraryHref } from '../../assets/js/v6/lib/library.js';

const DIR = fileURLToPath(new URL('../../thesis/', import.meta.url));
const CHAPTERS = { INTRODUCTION: 'introduction', PHASE_1: 'phase-1', PHASE_2: 'phase-2', PHASE_3: 'phase-3' };
const CSP = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'self\'; style-src \'self\'; img-src \'self\' data:; font-src \'self\'; connect-src \'self\' https://api.veritas-analyst.org; base-uri \'none\'; form-action \'none\'">';

test('plus aucun fichier Markdown sous /thesis/ : quatre pages de renvoi, et rien d’autre', () => {
  assert.deepEqual(readdirSync(DIR).sort(), Object.keys(CHAPTERS).map((name) => `${name}.html`).sort());
});

for (const [name, chapter] of Object.entries(CHAPTERS)) {
  test(`${name} renvoie à son chapitre de la Bibliothèque`, () => {
    const html = readFileSync(`${DIR}${name}.html`, 'utf8');
    const target = libraryHref({ doc: 'these', chapter });
    const escaped = target.replace(/&/g, '&amp;');
    assert.ok(html.includes(`<meta http-equiv="refresh" content="0; url=${escaped}">`), 'renvoi immédiat');
    assert.ok(html.includes(`<link rel="canonical" href="https://veritas-analyst.org${escaped}">`), 'adresse de référence');
    assert.ok(html.includes(`<a href="${escaped}">`), 'lien pour qui n’est pas renvoyé');
    assert.ok(html.includes('<meta name="robots" content="noindex">'));
    assert.ok(html.includes(CSP), 'politique de sécurité');
    assert.doesNotMatch(html, /<script|\sstyle\s*=|<style/i);
  });
}
