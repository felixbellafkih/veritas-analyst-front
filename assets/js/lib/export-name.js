// Nom du fichier exporté : 001_Al-Fatihah_1_VeritasAnalysis.txt, comme l'app actuelle.
import { splitOutput } from './engine-output.js';
import { SURAS } from './verses.js';

const DEFAULT_NAME = 'VeritasAnalysis.txt';
// Règle de l'app actuelle (app.py) : premier « nombre : nombre » ou « nombre - nombre » du texte
const REFERENCE = /\b(\d+)\s*[:\-]\s*(\d+)\b/;

function named(sura, verse) {
  const found = SURAS[sura - 1];
  return `${String(sura).padStart(3, '0')}_${found ? found.name : 'Unknown'}_${verse}_${DEFAULT_NAME}`;
}

// reference : {sura, start} quand le site connaît le passage (mode Verset), sinon null.
// À défaut, la règle actuelle s'applique au corps de la réponse, puis à la demande. L'en-tête technique est
// écarté : il cite des références du corpus, qui donneraient leur nom au fichier.
export function exportFileName({ reference = null, result = '', input = '' } = {}) {
  if (reference && Number.isInteger(reference.sura) && Number.isInteger(reference.start)) {
    return named(reference.sura, String(reference.start));
  }
  const match = REFERENCE.exec(splitOutput(result).text) || REFERENCE.exec(String(input ?? ''));
  return match ? named(Number(match[1]), match[2]) : DEFAULT_NAME;
}
