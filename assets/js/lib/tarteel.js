// Mode Tarteel de l'Interpréteur : mêmes règles que l'app actuelle (app.py, section VERSE INTERPRETER).

export const CEILING = 57;    // au-delà, la racine primaire demande une contrainte
export const SENT_LIMIT = 30; // versets d'un cluster envoyés au moteur, comme l'app actuelle

// État du signal, d'après les fréquences rendues par GET /tarteel/frequencies :
//   'vide'        pas de racine primaire, ou fréquences pas encore connues
//   'surcharge'   racine au-dessus du plafond, sans contrainte
//   'insuffisant' le cluster dépasse encore le plafond
//   'aucune'      aucune occurrence
//   'pur'         de 1 à 57 occurrences : le cluster peut être analysé
export function tarteelState({ primary, constraint, primaryFrequency, clusterFrequency } = {}) {
  const root = String(primary ?? '').trim();
  const limit = String(constraint ?? '').trim();
  if (!root || typeof primaryFrequency !== 'number') return { state: 'vide', count: 0, constraintRequired: false };
  const constraintRequired = primaryFrequency > CEILING;
  const count = limit ? Number(clusterFrequency) || 0 : primaryFrequency;
  if (constraintRequired && !limit) return { state: 'surcharge', count: primaryFrequency, constraintRequired };
  if (count > CEILING) return { state: 'insuffisant', count, constraintRequired };
  if (count === 0) return { state: 'aucune', count, constraintRequired };
  return { state: 'pur', count, constraintRequired };
}

// Texte envoyé au moteur. Cette phrase est celle que le corpus reconnaît (engine/corpus_store.py,
// parse_reference) : ne pas la modifier. Les racines y figurent telles que le visiteur les a saisies.
export function clusterText(primary, constraint, verses) {
  const root = String(primary ?? '').trim();
  const limit = String(constraint ?? '').trim();
  const sent = (verses || []).slice(0, SENT_LIMIT);
  return `Analyse ce cluster de versets interconnectés (Triangulation : ${root}${limit ? ` ∩ ${limit}` : ''}) :\n\n${sent.join('\n\n')}`;
}

// Un verset du cluster, tel que l'API le donne : « [2:22] : texte ». L'affichage sépare la référence du
// texte ; le texte envoyé au moteur reste l'élément tel quel (clusterText). Les espaces de bord, et le
// caractère invisible U+FEFF que l'API place parfois en tête d'un verset, ne s'affichent pas.
export function clusterVerse(item) {
  const raw = String(item ?? '');
  const match = /^\s*\[(\d{1,3}:\d{1,3})\]\s*:\s*([\s\S]*)$/.exec(raw);
  return match ? { reference: match[1], text: match[2].trim() } : { reference: '', text: raw.trim() };
}
