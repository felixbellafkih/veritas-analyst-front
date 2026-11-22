// Appels à l'API Veritas. Sans interface : Node teste ce module tel quel, contre le faux serveur.
// Chaque méthode rejette avec un ApiFailure (lib/failures.js), jamais avec une erreur brute.
// La clé du visiteur ne part que dans l'en-tête X-API-Key (ou le mot de passe développeur dans
// X-Dev-Password) : jamais dans une adresse, jamais dans le corps de la demande.
import { succeeded } from './lib/engine-output.js';
import { ApiFailure } from './lib/failures.js';
import { readOutcome } from './lib/ndjson.js';
import { credentialHeaders } from './lib/request.js';

// Un en-tête HTTP n'accepte que ces caractères : fetch refuse le reste en levant une erreur
const HEADER_VALUE = /^[\x20-\x7E\xA0-\xFF]*$/;

async function detailOf(response) {
  try {
    const data = await response.json();
    if (data && typeof data.detail === 'string') return data.detail;
    return JSON.stringify(data && data.detail !== undefined ? data.detail : data);
  } catch {
    return '';
  }
}

// La réponse lue au fil de l'eau ; si le navigateur ne le permet pas, lue d'un bloc à la fin
async function* streamChunks(response) {
  if (!response.body || typeof response.body.getReader !== 'function') {
    yield await response.text();
    return;
  }
  const reader = response.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

export function createApi({ base, fetch: fetchImpl = globalThis.fetch }) {
  async function send(path, { method = 'GET', headers = {}, body, signal } = {}) {
    for (const value of Object.values(headers)) {
      if (!HEADER_VALUE.test(value)) throw new ApiFailure('credential');
    }
    try {
      return await fetchImpl(base + path, { method, headers, body, signal });
    } catch (error) {
      const aborted = Boolean(error) && error.name === 'AbortError';
      throw new ApiFailure(aborted ? 'aborted' : 'network', { detail: String((error && error.message) || error) });
    }
  }

  async function json(path, options) {
    const response = await send(path, options);
    if (!response.ok) throw new ApiFailure('http', { status: response.status, detail: await detailOf(response) });
    try {
      return await response.json();
    } catch {
      throw new ApiFailure('http', { status: response.status, detail: 'Réponse illisible' });
    }
  }

  const query = (params) => new URLSearchParams(params).toString();
  const pair = (primary, constraint) => (constraint ? { primary, constraint } : { primary });

  // Corpus public : mode développeur seulement. Seul le mot de passe développeur accompagne la demande,
  // jamais la clé du visiteur ; sans lui, rien ne part.
  function corpus(path, method, body, credentials) {
    const devPassword = credentials && credentials.devPassword;
    if (!devPassword) return Promise.reject(new ApiFailure('http', { status: 401, detail: 'Unauthorized: Dev Password required' }));
    return json(path, { method, headers: { 'Content-Type': 'application/json', 'X-Dev-Password': devPassword }, body: JSON.stringify(body) });
  }

  return {
    stats: () => json('/content/manifesto/stats'),

    async root(code) {
      return (await json(`/analyze/root/${encodeURIComponent(code)}`)).root_data;
    },

    async verseRange(sura, start, end, { signal } = {}) {
      return (await json(`/verse/range?${query({ sura, start, end })}`, { signal })).verse_text;
    },

    async frequencies(primary, constraint, { signal } = {}) {
      const data = await json(`/tarteel/frequencies?${query(pair(primary, constraint))}`, { signal });
      return { primaryFrequency: data.primary_frequency, clusterFrequency: data.cluster_frequency };
    },

    // Rend la liste des versets ; si le Kernel répond par un message, c'est ce texte qui est rendu
    async cluster(primary, constraint, limit, { signal } = {}) {
      return (await json(`/tarteel/cluster?${query({ ...pair(primary, constraint), limit, offset: 0 })}`, { signal })).cluster_list;
    },

    models: (credentials) => json('/models', { headers: credentialHeaders(credentials) }),

    async devMode(password) {
      await json('/auth/dev-mode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      return true;
    },

    // Panneau « Valider / Corriger » (lib/corpus-panel.js). Le brouillon : {reference, kind, text}
    corpusDraft: (body, credentials) => corpus('/corpus/draft', 'POST', body, credentials),

    // Premier enregistrement : rend l'entrée, {id, reference, status, final_output, note}
    async corpusSave(body, credentials) {
      return (await corpus('/corpus/entries', 'POST', body, credentials)).entry;
    },

    // Mise à jour de la même entrée : rend {entry, changed}
    corpusUpdate: (id, body, credentials) => corpus(`/corpus/entries/${encodeURIComponent(id)}`, 'PUT', body, credentials),

    // Lance une analyse et rend le texte du moteur. Rejette : 'http', 'network', 'stream' (ligne error),
    // 'engine' (réponse sans en-tête [TARGET]), 'cut' (connexion coupée), 'timeout', 'aborted', 'credential'.
    // Un seul délai : timeoutMs. Aucune conclusion n'est tirée de l'absence de ligne pendant l'attente.
    async analyze(body, credentials, { onPing, signal, timeoutMs = 600000 } = {}) {
      const controller = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);
      const abandon = () => controller.abort();
      if (signal) {
        if (signal.aborted) abandon();
        else signal.addEventListener('abort', abandon, { once: true });
      }
      try {
        const response = await send('/analyze/interpreter/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...credentialHeaders(credentials) },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (!response.ok) throw new ApiFailure('http', { status: response.status, detail: await detailOf(response) });
        const outcome = await readOutcome(streamChunks(response), { onPing });
        if (outcome.type === 'result') {
          if (!succeeded(outcome.result)) throw new ApiFailure('engine', { detail: outcome.result });
          return outcome.result;
        }
        if (outcome.type === 'error') throw new ApiFailure('stream', { detail: outcome.detail });
        throw new ApiFailure(signal && signal.aborted ? 'aborted' : 'cut');
      } catch (failure) {
        // Le délai interrompt la demande comme un abandon : c'est lui qu'on annonce
        if (timedOut) throw new ApiFailure('timeout');
        throw failure;
      } finally {
        clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', abandon);
      }
    },
  };
}
