// Fiche d'une racine pour le Scanner, sans interface : la réponse de GET /analyze/root/{saisie} mise en
// forme pour l'affichage. Rien n'est réécrit : chaque texte est celui que l'API rend, à afficher comme du texte.
import { rootTiles } from './root-card.js';

const text = (value) => (typeof value === 'string' ? value : '');
// L'API écrit parfois « None » ou « N/A » là où une racine n'a pas d'opposée
const NO_PAIR = new Set(['', 'NONE', 'N/A']);

// « Bascule binaire » : la ou les racines opposées, séparées par « / »
function opposites(pair) {
  // « N/A » contient lui-même le séparateur : la valeur entière est regardée d'abord
  if (typeof pair !== 'string' || NO_PAIR.has(pair.trim().toUpperCase())) return [];
  return pair.split('/').map((code) => code.trim()).filter((code) => !NO_PAIR.has(code.toUpperCase()));
}

// Dérivations (Tasreef) : le mot, son type, sa définition
function instances(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((item) => item && typeof item === 'object' && text(item.word).trim())
    .map((item) => ({ word: item.word.trim(), type: text(item.type).trim(), definition: text(item.definition).trim() }));
}

// Libellés techniques d'une liste de la décompilation ([INSTRUMENTAL_BIND]…), tels que l'API les rend
const labels = (list) => (Array.isArray(list) ? list : []).map((item) => (item ? text(item.logic_mod).trim() : '')).filter(Boolean);

// Mot complexe ramené à sa racine : l'état (Tasreef), la connectique (entrées, sorties), les quantificateurs.
// Sans état connu, c'est l'état de base, comme dans l'app actuelle.
function decompiled(answer) {
  const data = answer.decompilation_data;
  if (answer.is_decompiled !== true || !data || typeof data !== 'object') return null;
  const tasreef = data.tasreef && typeof data.tasreef === 'object' ? data.tasreef : null;
  return {
    signal: text(data.original_signal),
    state: {
      label: (tasreef && text(tasreef.logic_mod).trim()) || '[BASE_VARIABLE]',
      tag: tasreef ? text(tasreef.tag).trim() : '',
      note: tasreef ? text(tasreef.desc).trim() : '',
    },
    inputs: labels(data.buses),
    outputs: labels(data.pointers),
    quantifiers: labels(data.quantifiers),
  };
}

// answer : {root_data, is_decompiled, decompilation_data}. Rend null quand la réponse ne porte pas de racine.
// tiles : une tuile par lettre quand l'équation en a la forme (lib/root-card.js), sinon null.
export function rootSheet(answer) {
  const root = answer && typeof answer === 'object' ? answer.root_data : null;
  const code = root && typeof root === 'object' ? text(root.root).trim() : '';
  if (!code) return null;
  const arabic = text(root.arabic).trim();
  const equation = text(root.physical_equation).trim();
  return {
    code,
    arabic,
    logic: text(root.logic_function).trim(),
    // La description sans sa note interne : l'API la donne déjà ainsi ; sinon elle est coupée ici
    description: text(root.description_clean).trim() || text(root.description).split('🚨')[0].trim(),
    equation,
    tiles: rootTiles(arabic, equation),
    opposites: opposites(root.binary_pair),
    instances: instances(root.instances),
    decompiled: decompiled(answer),
  };
}
