// Conversation d'un visiteur avec le décompilateur. Portage de engine/conversation.py du Kernel.
// Le moteur ne garde rien d'une demande à l'autre : c'est le site qui garde la conversation et l'envoie
// avec chaque demande, sous la forme [{role: 'user' | 'model', text}, …].
import { succeeded } from './engine-output.js';

export const MAX_EXCHANGES = 5; // comme le moteur, qui rejoue au plus 10 messages

// Nouvelle liste avec l'échange ajouté. Une réponse en échec ou une demande vide n'entre pas dans la
// conversation. Au-delà de MAX_EXCHANGES, le premier échange (le passage analysé) reste, et les plus
// anciens des suivants partent : le lexer et les références du corpus s'ancrent sur le premier message.
export function addExchange(history, userText, answer) {
  let next = [...(history || [])];
  const text = String(userText ?? '').trim();
  if (!text || !succeeded(answer)) return next;
  next.push({ role: 'user', text }, { role: 'model', text: answer });
  const limit = MAX_EXCHANGES * 2;
  if (next.length > limit) next = [...next.slice(0, 2), ...next.slice(-(limit - 2))];
  return next;
}

// Paires [demande, réponse] de la conversation, sans l'échange dont la réponse est affichée
export function previousExchanges(history, shownAnswer) {
  const turns = [...(history || [])];
  const pairs = [];
  for (let i = 0; i < turns.length - 1; i += 2) pairs.push([turns[i].text, turns[i + 1].text]);
  if (pairs.length && pairs[pairs.length - 1][1] === shownAnswer) pairs.pop();
  return pairs;
}
