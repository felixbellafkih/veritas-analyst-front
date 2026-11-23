// Portage de tests/test_conversation.py (classe TestConversation) du Kernel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_EXCHANGES, addExchange, previousExchanges } from '../../assets/js/v6/lib/conversation.js';

const H = '**[TARGET: gemini-3.1-pro-preview]** | 📊 **Tokens:** Input=1 | Output=1 | Thinking=0 | Total=2 | Cost=$0.0000 | 📚 **Références :** 18:96 (verset)\n\n';
const A = H + '### 1. TABLEAU\nok';
const FAILED = [
  "⏳ **QUOTA ÉPUISÉ (429) :** Limite de l'API atteinte. Attends 60 secondes.",
  '⚠️ ERREUR RUNTIME : boom',
  "❌ ERREUR CRITIQUE : L'API n'est pas configurée correctement.",
  '',
  null,
];

function after(count) {
  let history = [];
  for (let i = 1; i <= count; i++) history = addExchange(history, `Demande ${i}`, H + `Réponse ${i}`);
  return history;
}

test('MAX_EXCHANGES vaut 5, comme dans le moteur', () => {
  assert.equal(MAX_EXCHANGES, 5);
});

test('un échange est ajouté, sans modifier la liste reçue', () => {
  const before = [];
  const history = addExchange(before, '  Analyse le verset 18:96  ', A);
  assert.deepEqual(history, [{ role: 'user', text: 'Analyse le verset 18:96' }, { role: 'model', text: A }]);
  assert.deepEqual(before, []);
});

test('une réponse en échec n’entre pas dans la conversation', () => {
  const history = after(1);
  for (const failed of FAILED) assert.deepEqual(addExchange(history, 'Objection', failed), history, String(failed));
});

test('une demande vide n’entre pas dans la conversation', () => {
  assert.deepEqual(addExchange([], '   ', A), []);
  assert.deepEqual(addExchange(null, null, A), []);
});

test('le premier échange survit au plafond', () => {
  const history = after(7);
  assert.equal(history.length, MAX_EXCHANGES * 2);
  assert.deepEqual(history.filter((turn) => turn.role === 'user').map((turn) => turn.text),
    ['Demande 1', 'Demande 4', 'Demande 5', 'Demande 6', 'Demande 7']);
  assert.deepEqual(history[1], { role: 'model', text: H + 'Réponse 1' });
  assert.deepEqual(history.map((turn) => turn.role), Array.from({ length: MAX_EXCHANGES }, () => ['user', 'model']).flat());
});

test('échanges précédents : tous, sauf celui dont la réponse est affichée', () => {
  const history = after(3);
  assert.deepEqual(previousExchanges(history, H + 'Réponse 3'),
    [['Demande 1', H + 'Réponse 1'], ['Demande 2', H + 'Réponse 2']]);
  // Une erreur affichée n'est pas dans la conversation : tous les échanges sont « précédents »
  assert.equal(previousExchanges(history, '⚠️ ERREUR RUNTIME : boom').length, 3);
  assert.deepEqual(previousExchanges([], A), []);
  assert.deepEqual(previousExchanges(null, null), []);
});
