// Conduite de l'Interpréteur (lib/interpreter-controller.js) : ce qui part, quand, et ce qui s'affiche.
// Le formulaire, la vue, l'API et le stockage sont remplacés par des faux : aucune page, aucun réseau.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiFailure } from '../../assets/js/v5/lib/failures.js';
import { createInterpreter } from '../../assets/js/v5/lib/interpreter-controller.js';

const H = '**[TARGET: m]** | 📊 **Tokens:** Input=1 | Output=1 | Thinking=0 | Total=2\n\n';
const R1 = H + 'Analyse 1';
const R2 = H + 'Analyse 2';
const P1 = { mode: 'verset', sura: 1, start: 1, end: 1, text: 'بِسْمِ ٱللَّهِ' };
const P2 = { mode: 'verset', sura: 112, start: 1, end: 1, text: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ' };
const A1 = [{ role: 'user', text: 'بِسْمِ ٱللَّهِ' }, { role: 'model', text: R1 }];

const tick = () => new Promise((resolve) => setImmediate(resolve));

function setup({ key = 'ok', saved = null } = {}) {
  const calls = []; // demandes parties
  const log = [];   // ce que la vue a montré, dans l'ordre
  const stored = { conversation: saved, key };
  const effects = { waiting: [], keyDialogs: 0, reveals: [], questions: 0, answer: true };
  let interpreter = null;

  const api = {
    analyze: (body, credentials, { onPing }) => new Promise((resolve, reject) => {
      calls.push({ body, credentials, resolve, reject, onPing });
    }),
  };
  const store = {
    credentials: () => ({ key: stored.key, devPassword: '' }),
    loadConversation: () => stored.conversation,
    saveConversation: (value) => {
      stored.conversation = JSON.parse(JSON.stringify(value));
    },
    clearConversation: () => {
      stored.conversation = null;
    },
  };
  // Le formulaire et la zone de suite, tels que le visiteur les a sous les yeux
  const form = {
    passage: P1,
    language: 'Français',
    model: null,
    options() {
      return { language: this.language, model: this.model, defaultModel: 'm' };
    },
    submit() {
      return interpreter.launch(this.passage);
    },
  };
  const view = {
    draft: '',
    formatterFails: false,
    showEmpty: () => log.push(['vide']),
    showWaiting: () => log.push(['attente']),
    showResult(shown) {
      if (this.formatterFails) throw new Error('mise en forme impossible');
      log.push(['resultat', shown]);
    },
    showPlainResult: (shown) => log.push(['brut', shown]),
    showFailure: (failure, options) => log.push(['erreur', failure, options]),
    notePing: () => log.push(['signal']),
    submitFollowUp() {
      return interpreter.followUp(this.draft);
    },
  };
  interpreter = createInterpreter({
    api,
    store,
    form,
    view,
    onWaiting: (waiting) => effects.waiting.push(waiting),
    openKey: () => {
      effects.keyDialogs += 1;
    },
    reveal: (what) => effects.reveals.push(what),
    confirmNewConversation: async () => {
      effects.questions += 1;
      return effects.answer;
    },
  });
  return { interpreter, calls, log, stored, form, view, effects };
}

// Mène une première analyse de P1 jusqu'à son affichage
async function analysed(context) {
  context.interpreter.launch(P1);
  context.calls.at(-1).resolve(R1);
  await tick();
  return context;
}

test('au chargement, sans rien de gardé : l’état vide', () => {
  const { interpreter, log, effects } = setup();
  interpreter.restore();
  assert.deepEqual(log, [['vide']]);
  assert.deepEqual(effects.waiting, [false]);
});

test('au chargement : l’analyse et la conversation gardées pour l’onglet reviennent', () => {
  const saved = { history: A1, result: R1, resultPassage: P1, passage: P1 };
  const { interpreter, log, calls } = setup({ saved });
  interpreter.restore();
  assert.equal(log.at(-1)[0], 'resultat');
  assert.equal(log.at(-1)[1].result, R1);
  assert.deepEqual(log.at(-1)[1].passage, P1);
  assert.equal(calls.length, 0);
});

test('sans clé : la fenêtre de la clé s’ouvre, rien ne part', async () => {
  const context = setup({ key: '' });
  assert.equal(context.interpreter.launch(P1), false);
  assert.equal(context.effects.keyDialogs, 1);
  assert.equal(context.calls.length, 0);
  context.stored.key = 'ok';
  await analysed(context);
  context.stored.key = '';
  assert.equal(context.interpreter.followUp('Objection'), false);
  assert.equal(context.effects.keyDialogs, 2);
  assert.equal(context.calls.length, 1);
});

test('lancement : une demande part, l’attente s’affiche, puis l’analyse est gardée et montrée', async () => {
  const { interpreter, calls, log, stored, effects } = setup();
  assert.equal(interpreter.launch(P1), true);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].body, { verse_text: 'بِسْمِ ٱللَّهِ', sura_num: 1, verse_start: 1, verse_end: 1, language: 'Français' });
  assert.deepEqual(calls[0].credentials, { key: 'ok', devPassword: '' });
  assert.equal(log.at(-1)[0], 'attente');
  assert.equal(effects.waiting.at(-1), true);
  assert.deepEqual(effects.reveals, ['launch']);
  calls[0].onPing();
  assert.equal(log.at(-1)[0], 'signal');
  calls[0].resolve(R1);
  await tick();
  assert.equal(log.at(-1)[0], 'resultat');
  assert.deepEqual(log.at(-1)[1], {
    result: R1, passage: P1, input: 'بِسْمِ ٱللَّهِ', previous: [], lastInput: 'بِسْمِ ٱللَّهِ', first: true, language: 'Français', corpusEntry: null,
  });
  assert.equal(effects.waiting.at(-1), false);
  assert.equal(stored.conversation.result, R1);
  assert.deepEqual(stored.conversation.history, A1);
});

test('pendant l’attente, rien d’autre ne part : ni second lancement, ni suite, ni « Réessayer »', async () => {
  const context = await analysed(setup());
  context.interpreter.launch(P2);
  assert.equal(context.calls.length, 2);
  assert.equal(context.interpreter.launch(P1), false);
  assert.equal(context.interpreter.followUp('Objection'), false);
  context.interpreter.retry();
  assert.equal(context.calls.length, 2);
});

test('rien à envoyer : rien ne part', async () => {
  const context = setup();
  assert.equal(context.interpreter.launch(null), false);
  assert.equal(context.interpreter.launch({ mode: 'libre', text: '   ' }), false);
  assert.equal(context.interpreter.followUp('Objection'), false); // aucune analyse à poursuivre
  await analysed(context);
  assert.equal(context.interpreter.followUp('   '), false);
  assert.equal(context.calls.length, 1);
});

test('échec : le message s’affiche, l’analyse précédente reste, rien n’est effacé', async () => {
  const context = await analysed(setup());
  context.interpreter.launch(P2);
  const failure = new ApiFailure('cut');
  context.calls.at(-1).reject(failure);
  await tick();
  assert.deepEqual(context.log.at(-1), ['erreur', failure, { keepResult: true }]);
  assert.equal(context.effects.waiting.at(-1), false);
  assert.equal(context.stored.conversation.result, R1);
  assert.equal(context.effects.keyDialogs, 0);
});

test('clé refusée par le serveur (401) : la fenêtre de la clé s’ouvre', async () => {
  const context = setup();
  context.interpreter.launch(P1);
  context.calls[0].reject(new ApiFailure('http', { status: 401, detail: 'Unauthorized' }));
  await tick();
  assert.equal(context.log.at(-1)[0], 'erreur');
  assert.deepEqual(context.log.at(-1)[2], { keepResult: false });
  assert.equal(context.effects.keyDialogs, 1);
});

test('réponse sans en-tête : erreur du moteur, rien n’est gardé', async () => {
  const context = setup();
  context.interpreter.launch(P1);
  context.calls[0].resolve('⚠️ ERREUR RUNTIME : boom');
  await tick();
  assert.equal(context.log.at(-1)[0], 'erreur');
  assert.equal(context.log.at(-1)[1].kind, 'engine');
  assert.equal(context.stored.conversation, null);
});

// Le défaut critique de la relecture, vu de la page
test('lancement en échec, puis suite sous l’ancienne analyse : la demande porte la conversation affichée', async () => {
  const context = await analysed(setup());
  context.interpreter.launch(P2);
  context.calls.at(-1).reject(new ApiFailure('timeout'));
  await tick();
  assert.equal(context.interpreter.followUp('Pourquoi cette racine ?'), true);
  const sent = context.calls.at(-1).body;
  assert.deepEqual(sent, { verse_text: 'Pourquoi cette racine ?', history: A1, language: 'Français' });
  context.calls.at(-1).resolve(R2);
  await tick();
  const shown = context.log.at(-1)[1];
  assert.deepEqual(shown.passage, P1); // le titre reste celui du passage analysé
  assert.equal(shown.result, R2);
  assert.deepEqual(shown.previous, [['بِسْمِ ٱللَّهِ', R1]]);
  assert.deepEqual(context.stored.conversation.resultPassage, P1);
  assert.equal(context.stored.conversation.history.length, 4);
});

test('suite de conversation : le message part avec la conversation, sans champ de sourate', async () => {
  const context = await analysed(setup());
  assert.equal(context.interpreter.followUp('Objection 1'), true);
  assert.deepEqual(context.calls.at(-1).body, { verse_text: 'Objection 1', history: A1, language: 'Français' });
  assert.deepEqual(context.effects.reveals, ['launch', 'followup']);
  context.calls.at(-1).resolve(R2);
  await tick();
  assert.deepEqual(context.log.at(-1)[1].passage, P1);
  assert.equal(context.stored.conversation.history.length, 4);
});

// « Réessayer » ne renvoie pas une demande gardée : il relance ce que le visiteur a sous les yeux
test('réessayer un lancement : le formulaire repart tel qu’il est, avec le modèle choisi entre-temps', async () => {
  const context = setup();
  context.interpreter.launch(P1);
  context.calls[0].reject(new ApiFailure('stream', { detail: '429 quota' }));
  await tick();
  context.form.model = 'gemini-2.5-flash';
  context.form.language = 'English';
  context.interpreter.retry();
  assert.equal(context.calls.length, 2);
  assert.equal(context.calls[1].body.model, 'gemini-2.5-flash');
  assert.equal(context.calls[1].body.language, 'English');
  assert.equal(context.calls[1].body.verse_text, 'بِسْمِ ٱللَّهِ');
});

test('réessayer un lancement après avoir changé de passage : c’est le passage affiché qui part', async () => {
  const context = setup();
  context.interpreter.launch(P1);
  context.calls[0].reject(new ApiFailure('cut'));
  await tick();
  context.form.passage = P2;
  context.interpreter.retry();
  assert.equal(context.calls[1].body.sura_num, 112);
  context.calls[1].resolve(R2);
  await tick();
  assert.deepEqual(context.log.at(-1)[1].passage, P2);
});

test('réessayer une suite : la zone de suite repart telle qu’elle est', async () => {
  const context = await analysed(setup());
  context.view.draft = 'Objection';
  context.interpreter.followUp(context.view.draft);
  context.calls.at(-1).reject(new ApiFailure('cut'));
  await tick();
  context.view.draft = 'Objection reformulée';
  context.form.language = 'English';
  context.interpreter.retry();
  assert.deepEqual(context.calls.at(-1).body, { verse_text: 'Objection reformulée', history: A1, language: 'English' });
});

test('réessayer hors d’un échec : sans effet', async () => {
  const context = setup();
  context.interpreter.restore();
  context.interpreter.retry();
  await analysed(context);
  context.interpreter.retry();
  assert.equal(context.calls.length, 1);
});

test('nouvelle conversation : une confirmation est demandée ; refusée, rien ne change', async () => {
  const context = await analysed(setup());
  context.effects.answer = false;
  assert.equal(await context.interpreter.newConversation(), false);
  assert.equal(context.effects.questions, 1);
  assert.equal(context.log.at(-1)[0], 'resultat');
  assert.equal(context.stored.conversation.result, R1);
  context.effects.answer = true;
  assert.equal(await context.interpreter.newConversation(), true);
  assert.equal(context.log.at(-1)[0], 'vide');
  assert.equal(context.stored.conversation, null);
});

test('nouvelle conversation pendant une attente, ou sans analyse : pas de question, rien ne change', async () => {
  const context = setup();
  context.interpreter.restore();
  assert.equal(await context.interpreter.newConversation(), false);
  context.interpreter.launch(P1);
  assert.equal(await context.interpreter.newConversation(), false);
  assert.equal(context.effects.questions, 0);
  assert.equal(context.log.at(-1)[0], 'attente');
});

// Une analyse est payée : elle est gardée avant d'être mise en forme, et s'affiche même si la mise en forme échoue
test('la mise en forme échoue : l’analyse est déjà gardée, et le texte reçu s’affiche tel quel', async () => {
  const context = setup();
  context.view.formatterFails = true;
  context.interpreter.launch(P1);
  context.calls[0].resolve(R1);
  await tick();
  assert.equal(context.stored.conversation.result, R1);
  assert.equal(context.log.at(-1)[0], 'brut');
  assert.equal(context.log.at(-1)[1].result, R1);
  assert.equal(context.log.some((entry) => entry[0] === 'erreur'), false);
  assert.equal(context.effects.waiting.at(-1), false);
});

// ------------------------------------------------------------------ corpus public (mode développeur)

const ENTRY = { id: 'a1b2c3d4e5f6', reference: '1:1', status: 'validated', final_output: 'Analyse 1', note: '' };

test('la vue reçoit ce que le panneau du corpus demande : dernière saisie, première analyse ou suite, langue', async () => {
  const context = await analysed(setup());
  const first = context.log.at(-1)[1];
  assert.equal(first.lastInput, 'بِسْمِ ٱللَّهِ');
  assert.equal(first.first, true);
  assert.equal(first.language, 'Français');
  assert.equal(first.corpusEntry, null);

  context.view.draft = 'Objection';
  context.form.language = 'English';
  context.interpreter.followUp('Objection');
  context.calls.at(-1).resolve(R2);
  await tick();
  const second = context.log.at(-1)[1];
  assert.equal(second.result, R2);
  assert.equal(second.lastInput, 'Objection');
  assert.equal(second.first, false);
  assert.equal(second.language, 'English');
});

test('corpusSaved : l’entrée est gardée pour l’onglet sans réafficher l’analyse', async () => {
  const context = await analysed(setup());
  const shown = context.log.length;
  assert.equal(context.interpreter.corpusSaved(R1, ENTRY), true);
  assert.equal(context.log.length, shown, 'rien n’est réaffiché : le panneau garde ce que l’auteur y a saisi');
  assert.deepEqual(context.stored.conversation.corpusEntry, ENTRY);
  // une réponse pour une autre analyse que celle affichée est ignorée
  assert.equal(context.interpreter.corpusSaved(R2, { ...ENTRY, id: 'ffffffffffff' }), false);
  assert.deepEqual(context.stored.conversation.corpusEntry, ENTRY);
});

test('au chargement : l’entrée du corpus revient avec l’analyse', async () => {
  const before = await analysed(setup());
  before.interpreter.corpusSaved(R1, ENTRY);
  const after = setup({ saved: before.stored.conversation });
  after.interpreter.restore();
  assert.deepEqual(after.log.at(-1)[1].corpusEntry, ENTRY);
  assert.equal(after.log.at(-1)[1].language, 'Français');
});

test('analyse gardée avant que sa langue soit notée : le panneau du corpus reçoit la langue du formulaire', () => {
  // Un onglet resté ouvert pendant une mise à jour du site : ce qu'il a gardé ne porte pas la langue de l'analyse
  const context = setup({ saved: { history: A1, result: R1, resultPassage: P1, passage: P1 } });
  context.form.language = 'English';
  context.interpreter.restore();
  assert.equal(context.log.at(-1)[1].language, 'English');
});
