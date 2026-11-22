// Mode Tarteel de l'Interpréteur.
// Décision de l'auteur du 22/11/2026 : plus de plafond d'occurrences ni de limite de versets envoyés.
// Tous les versets du cluster sont montrés, et le visiteur coche ceux qu'il veut faire analyser.

// État du signal, d'après les fréquences rendues par GET /tarteel/frequencies :
//   'vide'    pas de racine primaire, ou fréquences pas encore connues
//   'aucune'  aucune occurrence
//   'pur'     au moins une occurrence : les versets du cluster peuvent être lus
// count : occurrences de la racine primaire, ou du croisement quand une contrainte est saisie.
export function tarteelState({ primary, constraint, primaryFrequency, clusterFrequency } = {}) {
  const root = String(primary ?? '').trim();
  const limit = String(constraint ?? '').trim();
  if (!root || typeof primaryFrequency !== 'number') return { state: 'vide', count: 0 };
  const count = limit ? Number(clusterFrequency) || 0 : primaryFrequency;
  return { state: count > 0 ? 'pur' : 'aucune', count };
}

// Texte envoyé au moteur. Cette phrase est celle que le corpus reconnaît (engine/corpus_store.py,
// parse_reference) : ne pas la modifier. Les racines y figurent telles que le visiteur les a saisies.
// verses : les versets à analyser, tels que l'API les donne ; tous partent.
export function clusterText(primary, constraint, verses) {
  const root = String(primary ?? '').trim();
  const limit = String(constraint ?? '').trim();
  return `Analyse ce cluster de versets interconnectés (Triangulation : ${root}${limit ? ` ∩ ${limit}` : ''}) :\n\n${(verses || []).join('\n\n')}`;
}

// Au-delà de ce que l'app a toujours envoyé (30 versets), le formulaire prévient : l'analyse est plus longue
// et plus coûteuse, et chaque message de suite renvoie ces versets. Rien n'est bloqué.
export const LARGE_SELECTION = 30;
export const largeSelection = (count) => count > LARGE_SELECTION;

// Les versets cochés, dans l'ordre du cluster. chosen : les rangs cochés (à partir de 0).
export function pickVerses(verses, chosen) {
  const picked = new Set(chosen || []);
  return (verses || []).filter((_, index) => picked.has(index));
}

// Un verset du cluster, tel que l'API le donne : « [2:22] : texte ». L'affichage sépare la référence du
// texte ; le texte envoyé au moteur reste l'élément tel quel (clusterText). Les espaces de bord, et le
// caractère invisible U+FEFF que l'API place parfois en tête d'un verset, ne s'affichent pas.
export function clusterVerse(item) {
  const raw = String(item ?? '');
  const match = /^\s*\[(\d{1,3}:\d{1,3})\]\s*:\s*([\s\S]*)$/.exec(raw);
  return match ? { reference: match[1], text: match[2].trim() } : { reference: '', text: raw.trim() };
}
