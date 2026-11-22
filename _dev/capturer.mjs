// Capture, une fois, des réponses réelles de l'API pour le faux serveur local (_dev/serveur.mjs).
// Lectures publiques seulement : aucune clé, aucune analyse. Usage : node _dev/capturer.mjs
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://api.veritas-analyst.org';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, '_dev', 'fixtures');
// Tailles cherchées pour les clusters d'essai : un petit croisement (31 à 57 versets), une racine rare
const SMALL = 57;
const HEADER = '**[TARGET: gemini-3.1-pro-preview]** | 📊 **Tokens:** Input=41,250 | Output=1,830 | Thinking=2,410 | Total=45,490 | Cost=$0.1234 | 📚 **Références :** 1:1-7';

// Candidats essayés dans l'ordre, pour couvrir chaque état du mode Tarteel
const PAIR_CONSTRAINTS = ['B-N-Y', 'F-T-R', 'R-F-A.', 'Q-M-R', 'K-W-K-B', 'N-Z-L', 'SH-M-S', 'T.-Y-R', 'M-T.-R'];
const SOLO_ROOTS = ['S.-M-D', 'K-W-K-B', 'F-T-R', 'B-N-Y'];

async function get(path) {
  const response = await fetch(API + path);
  if (!response.ok) throw new Error(`${path} → ${response.status}`);
  return response.json();
}

const query = (params) => new URLSearchParams(params).toString();
const pairKey = (primary, constraint) => `${primary}|${constraint}`;

async function frequency(primary, constraint = '') {
  const params = constraint ? { primary, constraint } : { primary };
  const { primary_frequency, cluster_frequency } = await get('/tarteel/frequencies?' + query(params));
  return { primary_frequency, cluster_frequency };
}

// Le cluster entier : le site montre tous les versets, et le visiteur coche ceux qu'il fait analyser
async function cluster(primary, constraint, limit) {
  const params = constraint ? { primary, constraint, limit, offset: 0 } : { primary, limit, offset: 0 };
  return (await get('/tarteel/cluster?' + query(params))).cluster_list;
}

async function writeJson(name, data) {
  await writeFile(join(OUT, name), JSON.stringify(data, null, 1) + '\n', 'utf8');
  console.log('écrit :', name);
}

await mkdir(OUT, { recursive: true });

await writeJson('stats.json', await get('/content/manifesto/stats'));
await writeJson('metadata.json', await get('/verse/metadata'));
await writeJson('racine-S-M-W.json', await get('/analyze/root/S-M-W'));

// Fiches du Scanner : des racines (dont une sans racine opposée) et deux mots complexes, que l'API décompile
const roots = {};
for (const query of ['S-M-W', 'A-R-D.', 'D.-R-B', 'بِسْمِ', 'يَضْرِبُونَ']) {
  roots[query] = await get('/analyze/root/' + encodeURIComponent(query));
}
await writeJson('racines.json', roots);

const verses = {};
for (const [sura, count] of [[1, 7], [112, 4]]) {
  for (let verse = 1; verse <= count; verse++) {
    // Texte gardé tel que l'API le donne, caractère U+FEFF compris
    verses[`${sura}:${verse}`] = (await get('/verse/range?' + query({ sura, start: verse, end: verse }))).verse_text;
  }
}
await writeJson('versets.json', verses);

const frequencies = {};
const clusters = {};
// Deux grands clusters, lus en entier : une racine fréquente seule, puis croisée
frequencies[pairKey('S-M-W', '')] = await frequency('S-M-W');
clusters[pairKey('S-M-W', '')] = await cluster('S-M-W', '', frequencies[pairKey('S-M-W', '')].primary_frequency);
frequencies[pairKey('S-M-W', 'A-R-D.')] = await frequency('S-M-W', 'A-R-D.');
clusters[pairKey('S-M-W', 'A-R-D.')] = await cluster('S-M-W', 'A-R-D.', frequencies[pairKey('S-M-W', 'A-R-D.')].cluster_frequency);
frequencies[pairKey('X-X-X', '')] = await frequency('X-X-X');

let pair = null;
for (const constraint of PAIR_CONSTRAINTS) {
  const found = await frequency('S-M-W', constraint);
  if (found.cluster_frequency > 30 && found.cluster_frequency <= SMALL) {
    pair = constraint;
    frequencies[pairKey('S-M-W', constraint)] = found;
    clusters[pairKey('S-M-W', constraint)] = await cluster('S-M-W', constraint, found.cluster_frequency);
    break;
  }
  console.log(`  candidat S-M-W ∩ ${constraint} écarté : ${found.cluster_frequency}`);
}
let solo = null;
for (const root of SOLO_ROOTS) {
  const found = await frequency(root);
  if (found.primary_frequency >= 1 && found.primary_frequency <= SMALL) {
    solo = root;
    frequencies[pairKey(root, '')] = found;
    clusters[pairKey(root, '')] = await cluster(root, '', found.primary_frequency);
    break;
  }
  console.log(`  candidat ${root} écarté : ${found.primary_frequency}`);
}
if (!pair || !solo) {
  console.error(`Aucun candidat ne convient (paire entre 31 et ${SMALL} : ${pair} ; racine seule entre 1 et ${SMALL} : ${solo}). Compléter les listes de candidats.`);
  process.exit(1);
}
await writeJson('tarteel.json', { frequencies, clusters });
console.log('Tarteel :');
for (const [key, value] of Object.entries(frequencies)) {
  console.log(`  ${key} → primaire ${value.primary_frequency}, cluster ${value.cluster_frequency}` + (clusters[key] ? ` (${clusters[key].length} versets capturés)` : ''));
}

const corpus = (await readFile(join(ROOT, 'corpus', 'data', 'veritas_corpus.jsonl'), 'utf8'))
  .split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line));
const entry = corpus.find((item) => item.reference === '1:1');
if (!entry || !entry.analysis || !entry.analysis_en) {
  console.error('Entrée 1:1 introuvable ou sans traduction anglaise dans corpus/data/veritas_corpus.jsonl.');
  process.exit(1);
}
await writeFile(join(OUT, 'analyse-1-1.txt'), HEADER + '\n\n' + entry.analysis, 'utf8');
console.log('écrit : analyse-1-1.txt');
await writeFile(join(OUT, 'analyse-1-1-en.txt'), HEADER + '\n\n' + entry.analysis_en, 'utf8');
console.log('écrit : analyse-1-1-en.txt');
