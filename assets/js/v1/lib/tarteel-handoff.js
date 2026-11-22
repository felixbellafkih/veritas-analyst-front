// Sélection reportée de la page Tarteel à l'Interpréteur, sans interface.
// Le report ne porte que les racines et les références des versets cochés (« 2:22 »), jamais leur texte.
// Dans l'Interpréteur, le cluster est relu sur le serveur ; ne se cochent que les références retrouvées
// dans ce cluster, et seulement si les racines en place sont celles du report. Rien ne part pour autant :
// c'est le visiteur qui lance l'analyse.
import { clusterVerse } from './tarteel.js';

const clean = (value) => String(value ?? '').trim();

// chosen : les rangs cochés (tableau ou ensemble). Les références sont rendues dans l'ordre du cluster ;
// un verset sans référence n'est pas reporté.
export function makeHandoff(primary, constraint, verses, chosen) {
  const picked = new Set(chosen || []);
  const references = [];
  (verses || []).forEach((verse, index) => {
    const { reference } = clusterVerse(verse);
    if (picked.has(index) && reference) references.push(reference);
  });
  return { primary: clean(primary), constraint: clean(constraint), references };
}

// Rangs à cocher dans le cluster relu ; [] si le report est absent, douteux, ou fait pour d'autres racines
export function applyHandoff(handoff, primary, constraint, verses) {
  if (!handoff || typeof handoff !== 'object' || !Array.isArray(handoff.references)) return [];
  if (typeof handoff.primary !== 'string' || typeof handoff.constraint !== 'string') return [];
  if (handoff.primary !== clean(primary) || handoff.constraint !== clean(constraint)) return [];
  const wanted = new Set(handoff.references.filter((reference) => typeof reference === 'string'));
  const indexes = [];
  (verses || []).forEach((verse, index) => {
    const { reference } = clusterVerse(verse);
    if (reference && wanted.has(reference)) indexes.push(index);
  });
  return indexes;
}
