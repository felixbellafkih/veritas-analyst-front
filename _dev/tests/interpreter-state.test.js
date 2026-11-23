import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLatest, initialState, reduce, snapshot } from '../../assets/js/v5/lib/interpreter-state.js';
import { followUpRequest } from '../../assets/js/v5/lib/request.js';

const H = '**[TARGET: m]** | 📊 **Tokens:** Input=1 | Output=1 | Thinking=0 | Total=2\n\n';
const R1 = H + 'Analyse 1';
const R2 = H + 'Analyse 2';
const P1 = { mode: 'verset', sura: 1, start: 1, end: 1, text: 'بِسْمِ ٱللَّهِ' };
const P2 = { mode: 'verset', sura: 2, start: 255, end: 255, text: 'ٱللَّهُ' };
const REQ1 = { verse_text: '  بِسْمِ ٱللَّهِ  ', language: 'Français', sura_num: 1, verse_start: 1, verse_end: 1 };
const REQ2 = { verse_text: 'ٱللَّهُ', language: 'Français', sura_num: 2, verse_start: 255, verse_end: 255 };
const O = { language: 'Français', model: null, defaultModel: 'm' };

const launch = (passage = P1, request = REQ1) => ({ type: 'launch', passage, request });
const success = (result) => ({ type: 'success', result });
const afterFirst = () => reduce(reduce(initialState(), launch()), success(R1));

test('état de départ', () => {
  assert.deepEqual(initialState(), {
    phase: 'vide', history: [], result: null, resultPassage: null, resultLanguage: null, corpusEntry: null, passage: null, request: null, requestKind: null, failure: null,
  });
});

test('lancement : l’attente commence, la demande est gardée', () => {
  const state = reduce(initialState(), launch());
  assert.equal(state.phase, 'attente');
  assert.equal(state.request, REQ1);
  assert.equal(state.passage, P1);
  assert.equal(state.requestKind, 'launch');
});

test('double clic : une seule demande part', () => {
  const waiting = reduce(initialState(), launch());
  assert.equal(reduce(waiting, launch()), waiting);
  assert.equal(reduce(waiting, launch(P2, REQ2)), waiting);
  assert.equal(reduce(waiting, { type: 'followup', request: { verse_text: 'x', language: 'Français' } }), waiting);
});

test('rien à envoyer : rien ne change', () => {
  const start = initialState();
  assert.equal(reduce(start, launch(P1, null)), start);
  const shown = afterFirst();
  assert.equal(reduce(shown, { type: 'followup', request: null }), shown);
});

test('réussite : l’analyse s’affiche et l’échange entre dans la conversation', () => {
  const state = afterFirst();
  assert.equal(state.phase, 'resultat');
  assert.equal(state.result, R1);
  assert.equal(state.resultPassage, P1);
  assert.equal(state.failure, null);
  assert.deepEqual(state.history, [{ role: 'user', text: 'بِسْمِ ٱللَّهِ' }, { role: 'model', text: R1 }]);
});

test('réponse sans en-tête : une erreur du moteur, hors de la conversation', () => {
  const state = reduce(reduce(initialState(), launch()), success('⚠️ ERREUR RUNTIME : boom'));
  assert.equal(state.phase, 'erreur');
  assert.equal(state.failure.kind, 'engine');
  assert.equal(state.failure.detail, '⚠️ ERREUR RUNTIME : boom');
  assert.deepEqual(state.history, []);
  assert.equal(state.result, null);
});

test('échec après une analyse : elle reste affichée, la conversation ne bouge pas', () => {
  const shown = afterFirst();
  const failure = { kind: 'cut', status: 0, detail: '' };
  const waiting = reduce(shown, { type: 'followup', request: followUpRequest('Objection', shown.history, O) });
  const state = reduce(waiting, { type: 'failure', failure });
  assert.equal(state.phase, 'erreur');
  assert.equal(state.failure, failure);
  assert.equal(state.result, R1);
  assert.equal(state.resultPassage, P1);
  assert.deepEqual(state.history, shown.history);
  assert.equal(state.requestKind, 'followup');
});

test('autre passage : l’analyse affichée et sa conversation restent jusqu’à l’arrivée de la suivante', () => {
  const shown = afterFirst();
  const waiting = reduce(shown, launch(P2, REQ2));
  assert.equal(waiting.phase, 'attente');
  assert.deepEqual(waiting.history, shown.history); // la conversation affichée ne bouge pas pendant l'attente
  assert.equal(waiting.result, R1);
  assert.equal(waiting.resultPassage, P1);
  assert.equal(waiting.passage, P2);
  const state = reduce(waiting, success(R2));
  assert.equal(state.result, R2);
  assert.equal(state.resultPassage, P2);
  // À l'arrivée de la nouvelle analyse, une nouvelle conversation commence : l'ancienne n'y figure pas
  assert.deepEqual(state.history, [{ role: 'user', text: 'ٱللَّهُ' }, { role: 'model', text: R2 }]);
});

// Défaut relevé à la relecture : la conversation était vidée dès le lancement. Après un lancement en échec,
// la zone de suite, restée sous l'ancienne analyse, envoyait alors une demande sans contexte (facturée),
// et la réponse était rangée sous le passage qui n'avait jamais été analysé.
test('lancement en échec, puis suite sous l’ancienne analyse : la conversation affichée continue', () => {
  const shown = afterFirst();
  const failed = reduce(reduce(shown, launch(P2, REQ2)), { type: 'failure', failure: { kind: 'cut' } });
  assert.equal(failed.phase, 'erreur');
  assert.equal(failed.result, R1);
  assert.deepEqual(failed.history, shown.history);
  const request = followUpRequest('Pourquoi cette racine ?', failed.history, O);
  assert.deepEqual(request.history, shown.history); // la demande porte le passage et l'analyse affichés
  const state = reduce(reduce(failed, { type: 'followup', request }), success(R2));
  assert.equal(state.resultPassage, P1); // la réponse reste rangée sous le passage affiché
  assert.equal(state.passage, P1);
  assert.equal(state.history.length, 4);
  assert.deepEqual(state.history[0], { role: 'user', text: 'بِسْمِ ٱللَّهِ' });
});

test('suite sans analyse affichée : rien ne part', () => {
  const start = initialState();
  const request = { verse_text: 'x', language: 'Français' };
  assert.equal(reduce(start, { type: 'followup', request }), start);
  const failed = reduce(reduce(start, launch()), { type: 'failure', failure: { kind: 'cut' } });
  assert.equal(reduce(failed, { type: 'followup', request }), failed);
});

test('suite de conversation : la demande porte l’historique, et le premier échange survit au plafond', () => {
  let state = afterFirst();
  for (let i = 2; i <= 7; i++) {
    const before = state.history;
    const request = followUpRequest(`Objection ${i}`, state.history, O);
    assert.deepEqual(request.history, before);
    state = reduce(state, { type: 'followup', request });
    assert.equal(state.phase, 'attente');
    assert.equal(state.history, before); // rien n'entre dans la conversation avant la réponse
    state = reduce(state, success(H + `Réponse ${i}`));
    assert.equal(state.result, H + `Réponse ${i}`);
    assert.equal(state.resultPassage, P1);
  }
  assert.equal(state.history.length, 10);
  assert.deepEqual(state.history[0], { role: 'user', text: 'بِسْمِ ٱللَّهِ' });
  assert.deepEqual(state.history.filter((turn) => turn.role === 'user').map((turn) => turn.text),
    ['بِسْمِ ٱللَّهِ', 'Objection 4', 'Objection 5', 'Objection 6', 'Objection 7']);
});

test('nouvelle conversation : retour à l’état de départ, sauf pendant une attente', () => {
  assert.deepEqual(reduce(afterFirst(), { type: 'new-conversation' }), initialState());
  const waiting = reduce(initialState(), launch());
  assert.equal(reduce(waiting, { type: 'new-conversation' }), waiting);
});

test('une réponse qui n’est pas attendue est ignorée', () => {
  const start = initialState();
  assert.equal(reduce(start, success(R1)), start);
  assert.equal(reduce(start, { type: 'failure', failure: { kind: 'cut' } }), start);
  const shown = afterFirst();
  assert.equal(reduce(shown, success(R2)), shown);
  assert.equal(reduce(shown, { type: 'inconnu' }), shown);
});

// « Réessayer » ne renvoie plus la demande gardée : il relance le formulaire tel qu'il est (voir
// interpreter-controller.test.js). Ici, seulement : après un échec, un lancement est de nouveau accepté.
test('après un échec, un nouveau lancement est accepté', () => {
  const failed = reduce(reduce(initialState(), launch()), { type: 'failure', failure: { kind: 'network' } });
  assert.equal(failed.requestKind, 'launch');
  const again = reduce(failed, launch(P2, REQ2));
  assert.equal(again.phase, 'attente');
  assert.equal(again.request, REQ2);
  assert.equal(again.passage, P2);
  assert.equal(again.failure, null);
});

test('snapshot et restore : l’analyse et la conversation reviennent après un rechargement', () => {
  const shown = reduce(reduce(afterFirst(), { type: 'followup', request: followUpRequest('Objection', afterFirst().history, O) }), success(R2));
  const saved = JSON.parse(JSON.stringify(snapshot(shown)));
  assert.deepEqual(Object.keys(saved).sort(), ['corpusEntry', 'history', 'passage', 'result', 'resultLanguage', 'resultPassage']);
  const restored = reduce(initialState(), { type: 'restore', saved });
  assert.equal(restored.phase, 'resultat');
  assert.equal(restored.result, R2);
  assert.deepEqual(restored.history, shown.history);
  assert.deepEqual(restored.resultPassage, P1);
  assert.equal(restored.request, null);
});

test('restore : un contenu douteux est ignoré', () => {
  for (const saved of [null, undefined, 'x', {}, { history: 'x', result: R1 }, { history: [], result: 'sans en-tête' },
    { history: [{ role: 'user' }], result: R1 }, { history: [{ role: 'x', text: 'a' }, { role: 'model', text: 'b' }], result: R1 }]) {
    assert.deepEqual(reduce(initialState(), { type: 'restore', saved }), initialState(), JSON.stringify(saved));
  }
  const shown = afterFirst();
  assert.equal(reduce(shown, { type: 'restore', saved: snapshot(shown) }), shown);
});

test('createLatest : seule la dernière demande compte', () => {
  const latest = createLatest();
  const a = latest.next();
  const b = latest.next();
  assert.equal(latest.isCurrent(a), false);
  assert.equal(latest.isCurrent(b), true);
  assert.notEqual(a, b);
});

// ------------------------------------------------------------------ corpus public : l'entrée enregistrée pour l'analyse affichée

const ENTRY = { id: 'a1b2c3d4e5f6', reference: '1:1', status: 'validated', final_output: 'Analyse 1', note: '' };
const corpusSaved = (result, entry = ENTRY) => ({ type: 'corpus-saved', result, entry });

test('une analyse reçue garde la langue de sa demande, et n’a pas encore d’entrée dans le corpus', () => {
  const shown = afterFirst();
  assert.equal(shown.resultLanguage, 'Français');
  assert.equal(shown.corpusEntry, null);
  const english = reduce(reduce(shown, { type: 'followup', request: { verse_text: 'Objection', language: 'English', history: shown.history } }), success(R2));
  assert.equal(english.resultLanguage, 'English');
});

test('corpus-saved : l’entrée est rattachée à l’analyse affichée, et à elle seule', () => {
  const shown = afterFirst();
  const saved = reduce(shown, corpusSaved(R1));
  assert.deepEqual(saved.corpusEntry, ENTRY);
  assert.equal(saved.phase, 'resultat');
  assert.equal(saved.result, R1);
  // une réponse arrivée pour une autre analyse, une entrée douteuse, ou aucune analyse : sans effet
  assert.equal(reduce(shown, corpusSaved(R2)), shown);
  assert.equal(reduce(shown, corpusSaved(R1, { id: '' })), shown);
  assert.equal(reduce(shown, corpusSaved(R1, null)), shown);
  assert.equal(reduce(initialState(), corpusSaved(R1)).corpusEntry, null);
});

test('corpus-saved pendant qu’une suite est en attente : l’analyse affichée garde son entrée', () => {
  const waiting = reduce(afterFirst(), { type: 'followup', request: followUpRequest('Objection', afterFirst().history, O) });
  const saved = reduce(waiting, corpusSaved(R1));
  assert.equal(saved.phase, 'attente');
  assert.deepEqual(saved.corpusEntry, ENTRY);
});

test('une nouvelle analyse, ou une suite, oublie l’entrée de la précédente', () => {
  const saved = reduce(afterFirst(), corpusSaved(R1));
  const next = reduce(reduce(saved, launch(P2, REQ2)), success(R2));
  assert.equal(next.corpusEntry, null);
  const followed = reduce(reduce(saved, { type: 'followup', request: followUpRequest('Objection', saved.history, O) }), success(R2));
  assert.equal(followed.corpusEntry, null);
  // un échec ne change rien : l'analyse affichée est toujours celle de l'entrée
  const failed = reduce(reduce(saved, launch(P2, REQ2)), { type: 'failure', failure: new Error('x') });
  assert.deepEqual(failed.corpusEntry, ENTRY);
});

test('snapshot et restore : l’entrée du corpus et la langue reviennent après un rechargement', () => {
  const saved = JSON.parse(JSON.stringify(snapshot(reduce(afterFirst(), corpusSaved(R1)))));
  const restored = reduce(initialState(), { type: 'restore', saved });
  assert.deepEqual(restored.corpusEntry, ENTRY);
  assert.equal(restored.resultLanguage, 'Français');
});

test('restore : une entrée douteuse est écartée, l’analyse revient quand même', () => {
  const saved = JSON.parse(JSON.stringify(snapshot(afterFirst())));
  for (const doubtful of ['x', 12, [], { id: 3 }, { id: 'a' }]) {
    const restored = reduce(initialState(), { type: 'restore', saved: { ...saved, corpusEntry: doubtful, resultLanguage: 42 } });
    assert.equal(restored.phase, 'resultat');
    assert.equal(restored.corpusEntry, null, JSON.stringify(doubtful));
    assert.equal(restored.resultLanguage, null);
  }
});
