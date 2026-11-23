// Lecture d'une réponse du Séquenceur (POST /analyze/sequencer). Sans interface.
// L'API rend {nodes, edges, transcript, logs} : un élément par morceau de mot, dans l'ordre du texte, chacun
// relié au suivant. Tout est vérifié avant de servir : un champ absent ou d'une autre forme donne un texte
// vide ou une liste vide, et chaque élément reçu garde sa carte (aucun mot ne disparaît).
// La couleur que l'API joint à chaque élément n'est pas lue : les thèmes du site décident des couleurs.

export const SEQUENCE_TEXT_MAX = 5000; // caractères d'un texte libre à séquencer

const text = (value) => (typeof value === 'string' ? value : '');
const texts =(value) => (Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []);
const LINKS = ['solid', 'dashed'];

// 'operator' : mot-outil, sans racine ; 'variable' : mot porteur d'une racine du LEXICON ; 'unknown' : mot
// sans racine connue ; 'other' : un type que le site ne connaît pas encore
function kindOf(node) {
  if (node.type === 'OPERATOR') return 'operator';
  if (node.type === 'VARIABLE') return text(node.root).trim() ? 'variable' : 'unknown';
  if (node.type === 'UNMAPPED') return 'unknown';
  return 'other';
}

function element(node) {
  const kind = kindOf(node);
  return {
    kind,
    arabic: text(node.arabic),
    // L'étiquette d'un opérateur ; pour un type inconnu du site, ce type tel qu'il est reçu
    label: kind === 'operator' ? text(node.tag) : kind === 'other' ? text(node.type) : '',
    root: kind === 'variable' ? text(node.root).trim() : '',
    state: text(node.logic_mod),      // l'état (Tasreef)
    func: text(node.base_func),       // la fonction de la racine
    inputs: texts(node.buses),        // connecteurs d'entrée
    outputs: texts(node.pointers),    // pointeurs de sortie
    quantifiers: texts(node.quantifiers),
    link: null,                       // le trait qui arrive à cet élément : posé par parseSequence
  };
}

// Le trait qui arrive à chaque élément à partir du deuxième. Ceux de l'API ('solid' vers une variable,
// 'dashed' vers un opérateur) s'ils relient bien chaque élément au suivant, dans l'ordre ; sinon un trait
// simple partout : les éléments restent affichés dans l'ordre reçu.
function linkTypes(received, kept, edges) {
  const plain = kept.slice(1).map(() => 'plain');
  if (kept.length !== received.length || !Array.isArray(edges) || edges.length !== kept.length - 1) return plain;
  const types = [];
  for (let index = 0; index < edges.length; index++) {
    const edge = edges[index];
    const from = kept[index].id;
    const to = kept[index + 1].id;
    const straight = Boolean(edge) && typeof edge === 'object' && typeof from === 'string' && edge.from === from && edge.to === to;
    if (!straight || !LINKS.includes(edge.type)) return plain;
    types.push(edge.type);
  }
  return types;
}

// Rend {elements, transcript, logs}. Élément : {kind, arabic, label, root, state, func, inputs, outputs,
// quantifiers, link} — link vaut null pour le premier, puis 'solid', 'dashed' ou 'plain'.
export function parseSequence(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || !Array.isArray(data.nodes)) return { elements: [], transcript: '', logs: [] };
  const kept = data.nodes.filter((node) => Boolean(node) && typeof node === 'object' && !Array.isArray(node));
  const elements = kept.map(element);
  const types = linkTypes(data.nodes, kept, data.edges);
  for (let index = 1; index < elements.length; index++) elements[index].link = types[index - 1];
  return { elements, transcript: text(data.transcript), logs: texts(data.logs) };
}

// Un type inconnu du site compte dans le total seulement
export function sequenceCounts(elements) {
  const count = (kind) => elements.filter((item) => item.kind === kind).length;
  return { total: elements.length, variables: count('variable'), operators: count('operator'), unknown: count('unknown') };
}

// Le texte copié par « Copier » : la transcription de chaque bloc séquencé, sous sa référence quand il en a
// une. blocks : les blocs de lib/sequence-run.js ({reference, sequence}) ; un bloc en attente ou en échec
// n'a pas de séquence et n'y figure pas.
export function transcriptCopy(blocks) {
  if (!Array.isArray(blocks)) return '';
  const parts = [];
  for (const block of blocks) {
    const transcript = block && block.sequence ? text(block.sequence.transcript).trim() : '';
    if (transcript) parts.push(block.reference ? `${block.reference}\n${transcript}` : transcript);
  }
  return parts.join('\n\n');
}
