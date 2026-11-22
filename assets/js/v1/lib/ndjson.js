// Lecture du flux d'analyse de l'API : des lignes JSON, une par ligne.
//   {"type":"ping"}                    toutes les 10 secondes, pour garder la connexion ouverte
//   {"type":"result","result":"…"}     la réponse du moteur
//   {"type":"error","detail":"…"}      un échec
// chunks : itérable asynchrone de Uint8Array ou de textes.

export async function readOutcome(chunks, { onPing } = {}) {
  // Un seul décodeur, en mode flux : un caractère coupé entre deux morceaux est reconstitué
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let outcome = null;

  function take(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return; // ligne illisible : ignorée
    }
    if (!message || typeof message !== 'object') return;
    if (message.type === 'ping') {
      if (onPing) onPing();
    } else if (message.type === 'result' && typeof message.result === 'string') {
      outcome = { type: 'result', result: message.result };
    } else if (message.type === 'error') {
      outcome = { type: 'error', detail: String(message.detail ?? '') };
    }
  }

  try {
    for await (const chunk of chunks) {
      buffer += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
      let end = buffer.indexOf('\n');
      while (end >= 0) {
        take(buffer.slice(0, end));
        buffer = buffer.slice(end + 1);
        if (outcome) return outcome; // ce qui suit le résultat est ignoré
        end = buffer.indexOf('\n');
      }
    }
  } catch {
    return { type: 'cut' }; // la connexion est tombée en route
  }
  buffer += decoder.decode();
  if (buffer.trim()) take(buffer);
  return outcome || { type: 'cut' };
}
