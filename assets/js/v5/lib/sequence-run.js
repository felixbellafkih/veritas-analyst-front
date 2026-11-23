// Déroulement d'un passage à séquencer. Sans interface.
// Un passage est séquencé verset par verset : l'API ne dit pas où un verset finit, et verset par verset elle
// rend les mêmes éléments que d'un bloc (vérifié sur les captures, _dev/tests/sequence.test.js). Chaque verset
// a donc son bloc : son texte (GET /verse/range), puis sa séquence (POST /analyze/sequencer).
// Lectures publiques seulement : ce module ne connaît ni clé ni mot de passe.
import { SEQUENCE_TEXT_MAX, parseSequence } from './sequence.js';
import { clampRange, cleanVerseText } from './verses.js';

const waiting = (reference, text) => ({ reference, text, step: 'attente', sequence: null, failure: null });

// api : {verseRange(sura, début, fin, {signal}), sequence(texte, {signal})} ; onChange(vue) : appelé à chaque
// changement d'un bloc ; concurrency : nombre de versets en cours au plus.
export function createSequenceRun({ api, onChange, concurrency = 2 }) {
  let generation = 0;      // un nouveau départ périme les réponses encore attendues de l'ancien
  let controller = null;   // interrompt les demandes du départ en cours
  let mode = null;
  let passage = null;
  let blocks = [];
  let sources = [];        // par bloc : {sura, verse, raw} — raw : le texte tel qu'il part, null tant qu'il n'est pas lu
  let queue = [];          // rangs des blocs qui attendent leur tour
  let active = 0;

  // Vue : {mode: 'verset' | 'texte' | null, passage, blocks, pending}. Bloc : {reference, text, step:
  // 'attente' | 'pret' | 'echec', sequence: {elements, transcript, logs} | null, failure}. Une copie à chaque fois.
  const view = () => ({
    mode,
    passage: passage ? { ...passage } : null,
    blocks: blocks.map((block) => ({ ...block })),
    pending: blocks.filter((block) => block.step === 'attente').length,
  });
  const changed = () => {
    if (onChange) onChange(view());
  };

  async function runBlock(index, token, signal) {
    const block = blocks[index];
    const source = sources[index];
    let failure = null;
    if (source.raw === null) {
      try {
        source.raw = await api.verseRange(source.sura, source.verse, source.verse, { signal });
      } catch (error) {
        failure = error;
      }
      if (token !== generation) return;
      if (!failure) {
        // Le texte du verset s'affiche dès qu'il arrive, avant sa séquence
        block.text = cleanVerseText(source.raw);
        changed();
      }
    }
    let data = null;
    if (!failure) {
      try {
        // Le texte part tel qu'il a été reçu
        data = await api.sequence(source.raw, { signal });
      } catch (error) {
        failure = error;
      }
      if (token !== generation) return;
    }
    if (failure) {
      block.step = 'echec';
      block.failure = failure;
    } else {
      block.sequence = parseSequence(data);
      block.step = 'pret';
    }
    changed();
  }

  // Lance les blocs qui attendent, dans l'ordre, sans dépasser le nombre permis
  function pump(token) {
    while (token === generation && active < concurrency && queue.length) {
      const index = queue.shift();
      active += 1;
      runBlock(index, token, controller.signal).finally(() => {
        if (token !== generation) return;
        active -= 1;
        pump(token);
      });
    }
  }

  function begin(nextMode, nextPassage, nextBlocks, nextSources) {
    generation += 1;
    if (controller) controller.abort();
    controller = new AbortController();
    mode = nextMode;
    passage = nextPassage;
    blocks = nextBlocks;
    sources = nextSources;
    queue = blocks.map((_, index) => index);
    active = 0;
    changed();
    pump(generation);
  }

  return {
    view,

    // Un bloc par verset. Le passage est ramené dans ses bornes (dix versets au plus) ; sourate inconnue :
    // rien ne part, et la réponse est false.
    startPassage(asked) {
      const range = asked && typeof asked === 'object' ? clampRange(asked.sura, asked.start, asked.end) : null;
      if (!range) return false;
      const sura = Number(asked.sura);
      const nextBlocks = [];
      const nextSources = [];
      for (let verse = range.start; verse <= range.end; verse++) {
        nextBlocks.push(waiting(`${sura}:${verse}`, ''));
        nextSources.push({ sura, verse, raw: null });
      }
      begin('verset', { sura, ...range }, nextBlocks, nextSources);
      return true;
    },

    // Un seul bloc, sans référence. Texte vide : rien ne part, et la réponse est false.
    startText(text) {
      const sent = (typeof text === 'string' ? text : '').trim().slice(0, SEQUENCE_TEXT_MAX);
      if (!sent) return false;
      begin('texte', null, [waiting(null, sent)], [{ sura: null, verse: null, raw: sent }]);
      return true;
    },

    // Relance un bloc en échec, et lui seul ; sans effet sur un autre bloc
    retry(index) {
      const block = blocks[index];
      if (!block || block.step !== 'echec') return false;
      block.step = 'attente';
      block.failure = null;
      queue.push(index);
      changed();
      pump(generation);
      return true;
    },

    cancel() {
      generation += 1;
      if (controller) controller.abort();
      mode = null;
      passage = null;
      blocks = [];
      sources = [];
      queue = [];
      active = 0;
      changed();
    },
  };
}
