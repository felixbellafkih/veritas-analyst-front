import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHeader, publishedHref, referenceHref, splitOutput, succeeded } from '../../assets/js/v3/lib/engine-output.js';

const H = '**[TARGET: gemini-3.1-pro-preview]** | 📊 **Tokens:** Input=41,250 | Output=1,830 | Thinking=2,410 | Total=45,490 | Cost=$0.1234 | 📚 **Références :** 1:1-7, 18:96 (verset)';
const FAILED = [
  "⏳ **QUOTA ÉPUISÉ (429) :** Limite de l'API atteinte. Attends 60 secondes.",
  '⚠️ ERREUR RUNTIME : boom',
  "❌ ERREUR CRITIQUE : L'API n'est pas configurée correctement.",
  '',
  null,
];

test('splitOutput : sépare l’en-tête technique du texte de l’analyse', () => {
  assert.deepEqual(splitOutput(H + '\n\n### 1. T\nok'), { model: 'gemini-3.1-pro-preview', headerLine: H, text: '### 1. T\nok' });
});

test('splitOutput : sans en-tête, tout est du texte', () => {
  assert.deepEqual(splitOutput('⚠️ ERREUR RUNTIME : boom'), { model: '', headerLine: '', text: '⚠️ ERREUR RUNTIME : boom' });
  assert.deepEqual(splitOutput(null), { model: '', headerLine: '', text: '' });
  assert.deepEqual(splitOutput(undefined), { model: '', headerLine: '', text: '' });
});

test('splitOutput : espaces avant l’en-tête et fins de ligne Windows', () => {
  assert.deepEqual(splitOutput('\n ' + H + '\r\n\r\ncorps\r\nsuite\r\n'), { model: 'gemini-3.1-pro-preview', headerLine: H, text: 'corps\nsuite' });
});

test('splitOutput : un en-tête seul, sans retour à la ligne, n’est pas une analyse', () => {
  assert.equal(splitOutput(H).model, '');
});

test('succeeded : vrai seulement pour une réponse qui porte l’en-tête [TARGET]', () => {
  assert.equal(succeeded(H + '\n\nx'), true);
  for (const failed of FAILED) assert.equal(succeeded(failed), false, String(failed));
});

test('parseHeader : modèle, jetons et coût, références', () => {
  assert.deepEqual(parseHeader(H), {
    model: 'gemini-3.1-pro-preview',
    usage: 'Input=41,250 | Output=1,830 | Thinking=2,410 | Total=45,490 | Cost=$0.1234',
    references: ['1:1-7', '18:96 (verset)'],
  });
});

test('parseHeader : sans coût ni référence', () => {
  assert.deepEqual(parseHeader('**[TARGET: m]** | 📊 **Tokens:** Input=1 | Output=1 | Thinking=0 | Total=2'),
    { model: 'm', usage: 'Input=1 | Output=1 | Thinking=0 | Total=2', references: [] });
});

test('parseHeader : jetons non disponibles', () => {
  assert.equal(parseHeader('**[TARGET: m]** | 📊 **Tokens:** Non disponible').usage, 'Non disponible');
  assert.deepEqual(parseHeader('**[TARGET: m]** | 📊 **Tokens:** Non disponible | 📚 **Références :** 2:255'),
    { model: 'm', usage: 'Non disponible', references: ['2:255'] });
});

test('parseHeader : forme inconnue, rien n’est inventé', () => {
  assert.deepEqual(parseHeader('**[TARGET: m]** quelque chose'), { model: 'm', usage: null, references: [] });
  assert.deepEqual(parseHeader(''), { model: '', usage: null, references: [] });
  assert.deepEqual(parseHeader(null), { model: '', usage: null, references: [] });
});

test('referenceHref : page du corpus d’une référence de verset', () => {
  assert.equal(referenceHref('1:1-7'), '/corpus/1/1-7/');
  assert.equal(referenceHref('18:96 (verset)'), '/corpus/18/96/');
  assert.equal(referenceHref(' 002:255 '), '/corpus/2/255/');
});

test('referenceHref : pas de lien pour un cluster, une référence impossible ou rien', () => {
  assert.equal(referenceHref('tarteel:S-R-Q ∩ Q-T-A.'), null);
  assert.equal(referenceHref('115:1'), null);
  assert.equal(referenceHref('0:1'), null);
  assert.equal(referenceHref(''), null);
  assert.equal(referenceHref(null), null);
});

// Défaut relevé à la relecture : un libellé du moteur contient des virgules (« racines : S-D-D, R-D-M »)
test('parseHeader : une virgule entre parenthèses ne coupe pas une référence', () => {
  const header = '**[TARGET: m]** | 📊 **Tokens:** Input=1 | Output=1 | Thinking=0 | Total=2 | 📚 **Références :** 1:1-7, 18:96-97 (racines : S-D-D, R-D-M), 2:255 (verset)';
  assert.deepEqual(parseHeader(header).references, ['1:1-7', '18:96-97 (racines : S-D-D, R-D-M)', '2:255 (verset)']);
});

test('parseHeader : parenthèse jamais refermée, le texte reste entier', () => {
  const header = '**[TARGET: m]** | 📊 **Tokens:** Non disponible | 📚 **Références :** 1:1 (racines : A, B';
  assert.deepEqual(parseHeader(header).references, ['1:1 (racines : A, B']);
});

// Défaut relevé à la relecture : l'adresse était devinée sur les nombres du libellé, même quand aucune
// page n'est publiée à cette adresse (analyse rangée sous /corpus/autres/…)
test('publishedHref : un lien seulement vers une page publiée du corpus', () => {
  const published = new Set(['/corpus/1/1-7/', '/corpus/18/96-97/']);
  assert.equal(publishedHref('1:1-7', published), '/corpus/1/1-7/');
  assert.equal(publishedHref('18:96-97 (racines : S-D-D, R-D-M)', published), '/corpus/18/96-97/');
  assert.equal(publishedHref('7:204 (racines : X-Y-Z)', published), null);
  assert.equal(publishedHref('tarteel:S-M-W ∩ N-Z-L (verset)', published), null);
});

test('publishedHref : tant que la liste publiée n’est pas connue, aucun lien', () => {
  assert.equal(publishedHref('1:1-7', null), null);
  assert.equal(publishedHref('1:1-7', undefined), null);
  assert.equal(publishedHref('1:1-7', new Map([['/corpus/1/1-7/', 'extrait']])), '/corpus/1/1-7/');
});
