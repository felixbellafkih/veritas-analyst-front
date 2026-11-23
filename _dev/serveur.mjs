// Serveur local du nouveau site : il sert les fichiers du dépôt comme GitHub Pages, et un faux
// serveur d'API sous /__api qui rejoue des réponses enregistrées (_dev/fixtures), sans aucune clé réelle.
// Usage : node _dev/serveur.mjs   →   http://localhost:8787
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = join(ROOT, '_dev', 'fixtures');
const HEADER = '**[TARGET: gemini-3.1-pro-preview]** | 📊 **Tokens:** Input=41,250 | Output=1,830 | Thinking=2,410 | Total=45,490 | Cost=$0.1234 | 📚 **Références :** 1:1-7';
// Références avec des virgules entre parenthèses, et une analyse sans page publiée à l'adresse de ses versets
const HEADER_REFERENCES = HEADER.replace(/📚.*$/u, '📚 **Références :** 1:1-7, 18:96-97 (racines : S-D-D, R-D-M), 7:204 (racines : X-Y-Z)');
const MODELS = ['gemini-3.1-pro-preview', 'gemini-2.5-flash', 'gemini-2.5-pro'];
const DEV_PASSWORD = 'dev';
const SLOW_PINGS = 27; // 8 secondes environ, à un ping toutes les 300 ms
// Racine factice : 5 occurrences, et un cluster qui est un message du Kernel au lieu d'une liste de versets
const MESSAGE_ROOT = 'MESSAGE';
const KERNEL_MESSAGE = '[WARNING KERNEL] Triangulation impossible.';
const HOSTILE = '### 1. TEXTE HOSTILE\n\n<script>window.__xss=1</script>\n\n<img src=x onerror="window.__xss=1">\n\n[lien](javascript:window.__xss=1)\n';
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.jsonl': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.md': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// Pas de trim() : JavaScript retirerait U+FEFF, que l'API réelle (Python) garde
const stripAscii = (text) => text.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');

async function loadFixtures() {
  const json = async (name) => JSON.parse(await readFile(join(FIXTURES, name), 'utf8'));
  const text = (name) => readFile(join(FIXTURES, name), 'utf8');
  return {
    stats: await json('stats.json'), metadata: await json('metadata.json'), root: await json('racine-S-M-W.json'),
    roots: await json('racines.json'), // fiches du Scanner : { saisie: réponse entière de l'API }
    verses: await json('versets.json'), tarteel: await json('tarteel.json'),
    sequences: await json('sequences.json'), // Séquenceur : { texte envoyé: réponse entière de l'API }
    analysis: await text('analyse-1-1.txt'), analysisEn: await text('analyse-1-1-en.txt'),
  };
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  }
}

// Même ordre que l'API réelle : le mot de passe développeur est vérifié d'abord
function authorize(req, res) {
  const key = String(req.headers['x-api-key'] || '').trim();
  const dev = String(req.headers['x-dev-password'] || '');
  if (dev) {
    if (dev === DEV_PASSWORD) return { scenario: 'ok', hasKey: Boolean(key), hasDevPassword: true };
    sendJson(res, 401, { detail: 'Unauthorized: Invalid Dev Password' });
    return null;
  }
  if (key) return { scenario: key, hasKey: true, hasDevPassword: false };
  sendJson(res, 401, { detail: 'Unauthorized: Valid API Key or Dev Password required' });
  return null;
}

function analysisScript(scenario, body, fixtures) {
  // Suite de conversation : la réponse reprend le message reçu. Les clés d'échec gardent leur effet.
  const followUp = Array.isArray(body.history) && body.history.length > 0;
  const reply = { type: 'result', result: `${HEADER}\n\nRéponse à : ${body.verse_text}` };
  switch (scenario) {
    case 'erreur': return { pings: 1, last: { type: 'error', detail: '500 INTERNAL. Faux serveur.' } };
    case 'echec': return { pings: 1, last: { type: 'result', result: '⚠️ ERREUR RUNTIME : API key not valid. Please pass a valid API key.' } };
    case 'coupure': return { pings: 2, last: null };
    case 'lent': return { pings: SLOW_PINGS, last: followUp ? reply : { type: 'result', result: fixtures.analysis } };
    default:
  }
  if (followUp) return { pings: 1, last: reply };
  switch (scenario) {
    case 'anglais': return { pings: 1, last: { type: 'result', result: fixtures.analysisEn } };
    case 'entete': return { pings: 1, last: { type: 'result', result: '**[TARGET: m]** quelque chose\n\n### 1. T\nok' } };
    case 'hostile': return { pings: 1, last: { type: 'result', result: `${HEADER}\n\n${HOSTILE}` } };
    case 'references': return { pings: 1, last: { type: 'result', result: `${HEADER_REFERENCES}\n\n### 1. RÉFÉRENCES\n\nTexte d’essai.` } };
    default: return { pings: 3, last: { type: 'result', result: fixtures.analysis } };
  }
}

async function streamAnalysis(res, script, pingMs) {
  res.writeHead(200, { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no' });
  for (let i = 0; i < script.pings; i++) {
    await wait(pingMs);
    if (res.destroyed) return;
    // On attend que la ligne soit partie : sinon une coupure juste après pourrait l'emporter
    await new Promise((resolve) => res.write(JSON.stringify({ type: 'ping' }) + '\n', resolve));
  }
  if (!script.last) {
    res.destroy(); // coupure : la connexion tombe sans résultat
    return;
  }
  res.end(JSON.stringify(script.last) + '\n');
}

function verseRange(query, fixtures) {
  const sura = Number(query.get('sura'));
  const start = Number(query.get('start'));
  const end = Number(query.get('end'));
  const texts = [];
  for (let verse = start; verse <= end; verse++) {
    const text = fixtures.verses[`${sura}:${verse}`];
    if (text === undefined) return { status: 404, data: { detail: `Verse ${sura}:${verse} not found in local database.` } };
    texts.push(stripAscii(text));
  }
  if (!texts.length) return { status: 404, data: { detail: 'No verses found for the given range.' } };
  return { status: 200, data: { verse_text: texts.join(' ') } };
}

// Séquenceur : la réponse capturée si le texte l'a été ; sinon un élément inconnu par mot, ce que rend la
// vraie API pour des mots qu'aucune racine du LEXICON ne couvre. Lecture publique : aucune clé n'est demandée.
function sequence(text, fixtures) {
  if (!stripAscii(text)) return { status: 400, data: { detail: 'Sequence empty' } };
  for (const sent of [text, stripAscii(text)]) {
    if (Object.hasOwn(fixtures.sequences, sent)) return { status: 200, data: fixtures.sequences[sent] };
  }
  const words = text.split(/\s+/).filter(Boolean);
  return {
    status: 200,
    data: {
      nodes: words.map((word, index) => ({ id: `node_${index}`, type: 'UNMAPPED', arabic: word, logic_mod: '[BASE_VARIABLE]', color: '#ff0000' })),
      edges: words.slice(1).map((_, index) => ({ from: `node_${index}`, to: `node_${index + 1}`, type: 'solid' })),
      transcript: words.map((word) => `*[UNMAPPED_${word}]*`).join(' ⛓️ '),
      logs: words.map((word) => `[WARNING] Unmapped Variable: ${word}`),
    },
  };
}

function frequencies(query, fixtures) {
  const primary = query.get('primary') || '';
  const constraint = query.get('constraint') || '';
  if (primary === MESSAGE_ROOT) return { primary_root: primary, constraint, primary_frequency: 5, cluster_frequency: 5 };
  const table = fixtures.tarteel.frequencies;
  const alone = table[`${primary}|`];
  const pair = table[`${primary}|${constraint}`];
  const primaryFrequency = alone ? alone.primary_frequency : 0;
  const clusterFrequency = pair ? pair.cluster_frequency : (constraint ? 0 : primaryFrequency);
  return { primary_root: primary, constraint, primary_frequency: primaryFrequency, cluster_frequency: clusterFrequency };
}

// ---- Corpus public : les règles du vrai serveur (api.py, section 8, et engine/corpus_store.py), sans
// Google Sheet ni publication. Les entrées vivent en mémoire, le temps du serveur local.
const CORPUS_EDITABLE = ['reference', 'status', 'final_output', 'note'];
const CORPUS_CELL_LIMIT = 50000; // plafond d'une cellule du tableur : au-delà, le vrai serveur refuse l'entrée
// Les colonnes de texte, dans l'ordre du tableur
const CORPUS_TEXT_COLUMNS = ['reference', 'verse_input', 'raw_output', 'final_output', 'note'];

function tooLongCells(entry) {
  const names = CORPUS_TEXT_COLUMNS.filter((name) => String(entry[name] ?? '').length > CORPUS_CELL_LIMIT);
  return names.length ? { status: 500, data: { detail: `Texte trop long pour une cellule (${CORPUS_CELL_LIMIT} caractères max) : ${names.join(', ')}.` } } : null;
}
const normalize = (text) => String(text || '').replace(/\r\n/g, '\n').trim();
// Deux textes qui ne diffèrent que par des blancs : ce n'est pas une correction
const sameContent = (a, b) => String(a || '').replace(/\s+/g, '') === String(b || '').replace(/\s+/g, '');
const corpusFields = (entry) => ({ id: entry.id, reference: entry.reference, status: entry.status, final_output: entry.final_output, note: entry.note });

// Sépare l'en-tête technique (modèle, jetons, coût) du texte de l'analyse
function splitOutput(result) {
  const text = String(result || '');
  const match = /^\s*\*\*\[TARGET:\s*([^\]]+)\]\*\*[^\n]*\n+/.exec(text);
  return match ? normalize(text.slice(match[0].length)) : normalize(text);
}

function validReference(match) {
  const [sura, start, end] = [Number(match[1]), Number(match[2]), match[3]];
  if (sura < 1 || sura > 114 || start < 1) return '';
  return end && Number(end) > start ? `${sura}:${start}-${Number(end)}` : `${sura}:${start}`;
}

// Rend [type, référence] : verse, range, cluster ou free
function parseReference(verseInput, output) {
  const input = String(verseInput || '');
  const reference = /(\d{1,3})\s*:\s*(\d{1,3})(?:\s*-\s*(\d{1,3}))?/;
  if (input.startsWith('Analyse ce cluster')) {
    const match = /Triangulation\s*:\s*([^)]+)\)/.exec(input);
    return ['cluster', match ? `tarteel:${match[1].trim()}` : ''];
  }
  if (input.startsWith('Analyse le verset') || input.startsWith('Analyse les versets')) {
    const match = reference.exec(input.split('\n', 1)[0]);
    if (match) {
      const found = validReference(match);
      return [found.includes('-') ? 'range' : 'verse', found];
    }
  }
  const match = reference.exec(normalize(output).slice(0, 200));
  return ['free', match ? validReference(match) : ''];
}

function corpusDraft(body) {
  const text = splitOutput(body.result);
  let [kind, reference] = parseReference(body.verse_input, text);
  if (body.reference) [kind, reference] = [body.kind || kind, body.reference];
  return { status: 200, data: { reference, kind, text } };
}

function corpusSave(body, entries) {
  const refuse = (detail) => ({ status: 400, data: { detail } });
  if (body.action !== 'validate' && body.action !== 'correct') return refuse('Action inconnue.');
  const raw = splitOutput(body.result);
  const changed = !sameContent(body.final_text, raw);
  if (body.action === 'validate' && changed) return refuse('Le texte a été modifié : utilise « Enregistrer la correction ».');
  if (body.action === 'correct' && !changed) return refuse('Aucune modification : utilise « Valider tel quel ».');
  if (!String(body.reference || '').trim()) return refuse('Indique la référence du verset (ex. 2:255).');
  const finalText = changed ? normalize(body.final_text) : raw;
  const entry = {
    id: Array.from({ length: 12 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
    reference: String(body.reference).trim(),
    status: finalText === raw ? 'validated' : 'corrected',
    verse_input: normalize(body.verse_input),
    raw_output: raw,
    final_output: finalText,
    note: String(body.note || '').trim(),
  };
  const refused = tooLongCells(entry);
  if (refused) return refused;
  entries.set(entry.id, entry);
  return { status: 200, data: { entry: corpusFields(entry) } };
}

function corpusUpdate(id, body, entries) {
  const current = entries.get(id);
  if (!current) return { status: 404, data: { detail: `Entrée ${id} introuvable dans le corpus.` } };
  const finalText = sameContent(body.final_text, current.raw_output) ? current.raw_output : normalize(body.final_text);
  const revised = {
    ...current,
    reference: String(body.reference || '').trim(),
    final_output: finalText,
    note: String(body.note || '').trim(),
    status: finalText === current.raw_output ? 'validated' : 'corrected',
  };
  if (!revised.reference) return { status: 400, data: { detail: 'Indique la référence du verset (ex. 2:255).' } };
  if (CORPUS_EDITABLE.every((name) => revised[name] === current[name])) return { status: 200, data: { entry: corpusFields(current), changed: false } };
  const refused = tooLongCells(revised);
  if (refused) return refused;
  const expected = body.expected || {};
  if (CORPUS_EDITABLE.some((name) => normalize(current[name]) !== normalize(String(expected[name] ?? '')))) {
    return { status: 500, data: { detail: 'Cette entrée a été modifiée ailleurs depuis son chargement (Google Sheet ou autre écran) : recharge le corpus avant de la mettre à jour.' } };
  }
  entries.set(id, revised);
  return { status: 200, data: { entry: corpusFields(revised), changed: true } };
}

async function serveStatic(pathname, res) {
  const notFound = () => {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end('404');
  };
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return notFound();
  }
  const segments = decoded.split(/[\\/]/).filter(Boolean);
  // Comme GitHub Pages (Jekyll) : rien sous un nom qui commence par _ ou . — ce qui écarte aussi « .. »
  if (segments.some((segment) => segment.startsWith('_') || segment.startsWith('.'))) return notFound();
  let file = join(ROOT, ...segments);
  try {
    if ((await stat(file)).isDirectory()) {
      if (!pathname.endsWith('/')) {
        res.writeHead(301, { Location: pathname + '/', 'Cache-Control': 'no-store' });
        return res.end();
      }
      file = join(file, 'index.html');
    }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  } catch {
    notFound();
  }
}

export async function startServer({ port = 8787, pingMs = 300 } = {}) {
  const fixtures = await loadFixtures();
  const state = { count: 0, last: null, outage: false, corpus: new Map() };

  // Corpus public : le mot de passe développeur seul ouvre ces routes, une clé ne suffit pas
  async function handleCorpus(req, res, path) {
    if (String(req.headers['x-dev-password'] || '') !== DEV_PASSWORD) return sendJson(res, 401, { detail: 'Unauthorized: Dev Password required' });
    const body = await readBody(req);
    if (!body) return sendJson(res, 422, { detail: 'Corps de demande invalide.' });
    let answer = null;
    if (req.method === 'POST' && path === '/corpus/draft') answer = corpusDraft(body);
    else if (req.method === 'POST' && path === '/corpus/entries') answer = corpusSave(body, state.corpus);
    else if (req.method === 'PUT' && path.startsWith('/corpus/entries/')) answer = corpusUpdate(decodeURIComponent(path.slice('/corpus/entries/'.length)), body, state.corpus);
    return answer ? sendJson(res, answer.status, answer.data) : sendJson(res, 404, { detail: 'Not Found' });
  }

  async function handleApi(req, res, path, query) {
    if (path === '/__demandes') {
      if (req.method === 'DELETE') {
        state.count = 0;
        state.last = null;
      }
      return sendJson(res, 200, { count: state.count, last: state.last });
    }
    if (path === '/__panne') {
      state.outage = query.get('on') === '1';
      return sendJson(res, 200, { panne: state.outage });
    }
    if (state.outage) return sendJson(res, 503, { detail: 'Service indisponible (panne simulée).' });
    if (path.startsWith('/corpus/')) return handleCorpus(req, res, path);

    if (req.method === 'GET') {
      if (path === '/content/manifesto/stats') return sendJson(res, 200, fixtures.stats);
      if (path === '/verse/metadata') return sendJson(res, 200, fixtures.metadata);
      if (path === '/verse/range') {
        const { status, data } = verseRange(query, fixtures);
        return sendJson(res, status, data);
      }
      if (path.startsWith('/analyze/root/')) {
        const root = decodeURIComponent(path.slice('/analyze/root/'.length));
        if (root === 'S-M-W') return sendJson(res, 200, fixtures.root);
        if (Object.hasOwn(fixtures.roots, root)) return sendJson(res, 200, fixtures.roots[root]);
        return sendJson(res, 404, { detail: 'Signal does not match any known physical root.' });
      }
      if (path === '/tarteel/frequencies') return sendJson(res, 200, frequencies(query, fixtures));
      if (path === '/tarteel/cluster') {
        if (query.get('primary') === MESSAGE_ROOT) return sendJson(res, 200, { cluster_list: KERNEL_MESSAGE });
        const list = fixtures.tarteel.clusters[`${query.get('primary') || ''}|${query.get('constraint') || ''}`];
        if (!list) return sendJson(res, 404, { detail: 'No occurrences found' });
        const offset = Number(query.get('offset') || 0);
        const limit = Number(query.get('limit') || 10);
        return sendJson(res, 200, { cluster_list: list.slice(offset, offset + limit) });
      }
      if (path === '/models') {
        if (!authorize(req, res)) return undefined;
        return sendJson(res, 200, { default: MODELS[0], models: MODELS });
      }
    }
    if (req.method === 'POST') {
      if (path === '/analyze/sequencer') {
        const body = await readBody(req);
        if (!body || typeof body.input_seq !== 'string') return sendJson(res, 422, { detail: 'Corps de demande invalide.' });
        const { status, data } = sequence(body.input_seq, fixtures);
        return sendJson(res, status, data);
      }
      if (path === '/auth/dev-mode') {
        const body = await readBody(req);
        if (body && body.password === DEV_PASSWORD) {
          return sendJson(res, 200, { status: 'success', message: 'Admin Access Granted', dev_mode: true });
        }
        return sendJson(res, 401, { detail: 'Unauthorized Access' });
      }
      if (path === '/analyze/interpreter/stream') {
        const access = authorize(req, res);
        if (!access) return undefined;
        const body = await readBody(req);
        if (!body || typeof body.verse_text !== 'string') return sendJson(res, 422, { detail: 'Corps de demande invalide.' });
        state.count += 1;
        // Jamais la valeur d'une clé dans le journal : seulement sa présence
        state.last = { body, headers: { hasKey: access.hasKey, hasDevPassword: access.hasDevPassword } };
        return streamAnalysis(res, analysisScript(access.scenario, body, fixtures), pingMs);
      }
    }
    return sendJson(res, 404, { detail: 'Not Found' });
  }

  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const done = url.pathname.startsWith('/__api/')
      ? handleApi(req, res, url.pathname.slice('/__api'.length), url.searchParams)
      : serveStatic(url.pathname, res);
    Promise.resolve(done).catch((error) => {
      if (!res.headersSent) sendJson(res, 500, { detail: String(error) });
      else res.destroy();
    });
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return {
    port: server.address().port,
    close: () => new Promise((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    }),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { port } = await startServer();
    console.log(`Nouveau site Veritas, serveur local : http://localhost:${port}/accueil/, http://localhost:${port}/interpreteur/ et http://localhost:${port}/sequenceur/`);
    console.log('Par défaut, un faux serveur d’API répond (clés factices : ok, anglais, lent, erreur, echec, coupure, entete, hostile, references ; mot de passe développeur : dev).');
    console.log(`Essai avec la vraie API : http://localhost:${port}/interpreteur/?api=reel`);
    console.log('Pour arrêter le serveur : Ctrl+C.');
  } catch (error) {
    // Le port est déjà pris : le serveur tourne déjà (par exemple lancé depuis une autre fenêtre)
    if (!error || error.code !== 'EADDRINUSE') throw error;
    console.log('Le serveur local tourne déjà sur ce PC : ouvrez http://localhost:8787/interpreteur/ dans votre navigateur.');
  }
}
