// Bibliothèque : ses trois lectures (manifeste, thèse, gouvernance), l'adresse de chacune, la lecture des
// fichiers de contenu du site (assets/bibliotheque/<code>.json) et le choix du texte à afficher. Sans interface.
// - Le manifeste est écrit dans la page ; la thèse et les volets de gouvernance viennent des fichiers de contenu.
// - Tout ce qui revient de l'adresse ou d'un fichier est vérifié avant de servir : une valeur inconnue ouvre ce
//   qui existe, une clé inconnue est ignorée.
// - Les libellés sont ceux de l'app (app.py) ; le titre d'un volet y porte un emoji, laissé de côté ici.
import { tx } from './i18n.js';

export const LIBRARY_HOME = '/bibliotheque/';

export const LIBRARY_DOCS = ['manifeste', 'these', 'gouvernance'];

export const THESIS_CHAPTERS = [
  { id: 'introduction', label: tx('Introduction : Maqasid Al-Huruf') },
  { id: 'phase-1', label: tx('Phase 1 : Le Bootstrap') },
  { id: 'phase-2', label: tx('Phase 2 : La Syntaxe') },
  { id: 'phase-3', label: tx('Phase 3 : Le Requêtage') },
];

// label : le nom du groupe sur la carte de gouvernance (non traduit, comme la carte) ; title : le titre du volet
export const GOVERNANCE_PANELS = [
  { id: '1', label: '1. AXIOMES DE COHÉRENCE', title: tx("1. Philosophie du Noyau : Ghayr dhi 'iwaj") },
  { id: '2', label: '2. STANDARD VTS-v2', title: tx('2. Standard de Transcription VTS-v2 (Emphatiques)') },
  { id: '3', label: '3. ARCHITECTURE HARDWARE', title: tx('3. Architecture Hardware (Couches Logiques)') },
  { id: '4', label: "4. UNITÉS D'ANALYSE", title: tx("4. Modules Majeurs de l'Interface") },
];

const CHAPTER_IDS = THESIS_CHAPTERS.map((chapter) => chapter.id);
const PANEL_IDS = GOVERNANCE_PANELS.map((panel) => panel.id);
// Les deux parties d'un fichier de contenu, et les clés que chacune peut porter
const PARTS = { these: CHAPTER_IDS, gouvernance: PANEL_IDS };

const known = (list, value) => (list.includes(value) ? value : list[0]);
const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

// search : la requête de l'adresse (« ?doc=these&ch=phase-2 »). Rend toujours les trois réponses.
export function parseLibraryQuery(search) {
  const params = new URLSearchParams(typeof search === 'string' ? search : '');
  return {
    doc: known(LIBRARY_DOCS, params.get('doc')),
    chapter: known(CHAPTER_IDS, params.get('ch')),
    panel: known(PANEL_IDS, params.get('v')),
  };
}

// L'adresse d'une lecture. Seul endroit du site où s'écrit une adresse de la Bibliothèque avec sa requête.
export function libraryHref(target) {
  const { doc, chapter, panel } = isRecord(target) ? target : {};
  if (doc === 'these') return `${LIBRARY_HOME}?doc=these&ch=${known(CHAPTER_IDS, chapter)}`;
  if (doc === 'gouvernance') return `${LIBRARY_HOME}?doc=gouvernance&v=${known(PANEL_IDS, panel)}`;
  return LIBRARY_HOME;
}

export function chapterNeighbours(id) {
  const index = CHAPTER_IDS.indexOf(id);
  if (index < 0) return { previous: null, next: null };
  return { previous: CHAPTER_IDS[index - 1] ?? null, next: CHAPTER_IDS[index + 1] ?? null };
}

// Un fichier de contenu, tel que lu : seules les clés connues, seules les valeurs qui sont un texte non vide,
// dans l'ordre de lecture.
export function parseLibraryContent(data) {
  const content = { these: {}, gouvernance: {} };
  if (!isRecord(data)) return content;
  for (const [part, ids] of Object.entries(PARTS)) {
    const source = isRecord(data[part]) ? data[part] : {};
    for (const id of ids) {
      const text = Object.hasOwn(source, id) ? source[id] : null;
      if (typeof text === 'string' && text.trim()) content[part][id] = text;
    }
  }
  return content;
}

const textOf = (content, kind, id) => {
  if (!isRecord(content) || !Object.hasOwn(PARTS, kind) || !PARTS[kind].includes(id)) return null;
  const part = isRecord(content[kind]) ? content[kind] : {};
  const text = Object.hasOwn(part, id) ? part[id] : null;
  return typeof text === 'string' && text.trim() ? text : null;
};

// Le texte à afficher pour un chapitre (kind « these ») ou un volet (kind « gouvernance »).
// local : le contenu dans la langue de l'interface, ou null quand l'interface est en français.
// french : true quand le français remplace une traduction absente (la page le dit alors).
export function pickText(local, french, kind, id) {
  const translated = local === null ? null : textOf(local, kind, id);
  if (translated !== null) return { text: translated, french: false };
  const fallback = textOf(french, kind, id);
  return fallback === null ? null : { text: fallback, french: local !== null };
}
