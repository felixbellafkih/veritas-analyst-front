// Chiffres d'un cluster Tarteel, sans interface : répartition par sourate, rangs d'une sourate, texte à
// copier ; et l'adresse de la page Tarteel, qui porte les racines (jamais la sélection).
import { clusterVerse } from './tarteel.js';

const ROOT_MAX = 100; // même plafond que les champs de racine de l'Interpréteur

// La sourate d'un verset du cluster (« [2:22] : texte »), ou null s'il ne porte pas de référence
export function suraOf(verse) {
  const { reference } = clusterVerse(verse);
  return reference ? Number(reference.split(':')[0]) : null;
}

// [{sura, count}], du plus fourni au moins fourni, puis par numéro de sourate
export function suraDistribution(verses) {
  const counts = new Map();
  for (const verse of verses || []) {
    const sura = suraOf(verse);
    if (sura !== null) counts.set(sura, (counts.get(sura) || 0) + 1);
  }
  return [...counts].map(([sura, count]) => ({ sura, count })).sort((a, b) => b.count - a.count || a.sura - b.sura);
}

// Rangs, dans le cluster entier, des versets de cette sourate ; sura nul : tous les rangs.
// Ces rangs sont ceux que la sonde connaît : le filtre par sourate ne change jamais ce qui est coché.
export function indexesOfSura(verses, sura) {
  const indexes = [];
  (verses || []).forEach((verse, index) => {
    if (sura === null || sura === undefined || suraOf(verse) === sura) indexes.push(index);
  });
  return indexes;
}

// Le texte à copier : un verset par ligne, tel que l'API le donne
export const clusterCopyText = (verses) => (verses || []).join('\n');

const clean = (value) => String(value ?? '').trim().slice(0, ROOT_MAX);

// ?p=<racine primaire>[&c=<contrainte>] ; sans racine primaire, rien
export function tarteelQuery({ primary, constraint } = {}) {
  const root = clean(primary);
  const limit = clean(constraint);
  if (!root) return '';
  return `?p=${encodeURIComponent(root)}${limit ? `&c=${encodeURIComponent(limit)}` : ''}`;
}

export function parseTarteelQuery(search) {
  const params = new URLSearchParams(String(search ?? ''));
  return { primary: clean(params.get('p')), constraint: clean(params.get('c')) };
}
