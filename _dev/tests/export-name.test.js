import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportFileName } from '../../assets/js/v1/lib/export-name.js';

// En-tête technique qui cite une référence du corpus (1:1-7) : elle ne doit pas donner son nom au fichier
const H = '**[TARGET: gemini-3.1-pro-preview]** | 📊 **Tokens:** Input=41,250 | Output=1,830 | Thinking=2,410 | Total=45,490 | Cost=$0.1234 | 📚 **Références :** 1:1-7, 18:96 (verset)';

test('référence connue : elle nomme le fichier', () => {
  assert.equal(exportFileName({ reference: { sura: 2, start: 255 }, result: H + '\n\nx', input: '' }), '002_Al-Baqarah_255_VeritasAnalysis.txt');
  assert.equal(exportFileName({ reference: { sura: 1, start: 1 }, result: H + '\n\nvoir 18:96', input: '' }), '001_Al-Fatihah_1_VeritasAnalysis.txt');
  assert.equal(exportFileName({ reference: { sura: 114, start: 6 }, result: '', input: '' }), '114_An-Nas_6_VeritasAnalysis.txt');
});

test('sans référence connue : la règle actuelle, sur le corps de la réponse (l’en-tête est ignoré)', () => {
  assert.equal(exportFileName({ reference: null, result: H + '\n\nTexte 18:96 …', input: '' }), '018_Al-Kahf_96_VeritasAnalysis.txt');
  assert.equal(exportFileName({ reference: null, result: H + '\n\nVersets 2 - 255 et suite', input: '' }), '002_Al-Baqarah_255_VeritasAnalysis.txt');
});

test('sans référence dans la réponse : la demande', () => {
  assert.equal(exportFileName({ reference: null, result: 'sans nombre', input: 'voir 112:1-2' }), '112_Al-Ikhlas_1_VeritasAnalysis.txt');
});

test('aucun nombre nulle part', () => {
  assert.equal(exportFileName({ reference: null, result: 'sans nombre', input: '' }), 'VeritasAnalysis.txt');
  assert.equal(exportFileName({ reference: null, result: H + '\n\nsans nombre' }), 'VeritasAnalysis.txt');
  assert.equal(exportFileName({}), 'VeritasAnalysis.txt');
  assert.equal(exportFileName(), 'VeritasAnalysis.txt');
});

test('sourate hors liste : Unknown, comme aujourd’hui', () => {
  assert.equal(exportFileName({ reference: null, result: '200:3', input: '' }), '200_Unknown_3_VeritasAnalysis.txt');
});

test('référence incomplète : la règle actuelle s’applique', () => {
  assert.equal(exportFileName({ reference: { sura: 2 }, result: 'voir 18:96', input: '' }), '018_Al-Kahf_96_VeritasAnalysis.txt');
});
