// Résultat du Séquenceur : l'en-tête (nom du passage, comptes, légende), un bloc par verset (sa référence, son
// texte arabe, sa chaîne de cartes), puis la transcription et le journal.
// - Les blocs arrivent un à un (lib/sequence-run.js) : un bloc déjà affiché n'est pas rebâti quand un autre
//   change, pour ne déplacer ni la lecture ni le curseur du visiteur.
// - Tout ce qui vient de l'API s'écrit comme du texte ; la transcription passe par le rendu sûr du site.
// - Lecture publique seulement : rien ici ne connaît de clé.
import { describeReadFailure } from '../lib/failures.js';
import { parseInline } from '../lib/markdown.js';
import { sequenceCounts, transcriptCopy } from '../lib/sequence.js';
import { interpreterHref, resultTitle } from '../lib/verses.js';
import { copyText } from './clipboard.js';
import { el, fill } from './dom.js';
import { icon } from './icons.js';
import { t, td } from './i18n-dom.js';
import { renderInline } from './markdown-view.js';
import { mountSequenceChain } from './sequence-chain.js';

const number = (value) => value.toLocaleString(document.documentElement.lang || 'fr');
const same = (first, second) => first.length === second.length && first.every((item, index) => item === second[index]);

// Un verset introuvable est dit tel quel ; le reste est une lecture publique en échec (réseau ou serveur)
const failureText = (failure) => (failure && failure.kind === 'http' && failure.status === 404 ? t('Passage introuvable.') : td(describeReadFailure(failure)));

// onRetry(rang) : relance le bloc en échec ; address() : l'adresse de la page, pour « Copier l'adresse »
export function mountSequenceView(container, { onRetry, address }) {
  const announce = el('span', { class: 'sr', attrs: { role: 'status' } });
  const say = (text) => {
    announce.textContent = '';
    announce.textContent = text;
  };

  // ------------------------------------------------------------------ en-tête

  const title = el('h2', { class: 'sequence__titre' });
  const counts = el('p', { class: 'sequence__comptes', attrs: { role: 'status' } });
  const share = el('button', { class: 'bouton-bord sequence__adresse', attrs: { type: 'button' } }, icon('external'), el('span', { text: t('Copier l’adresse') }));
  share.addEventListener('click', async () => {
    say((await copyText(address())) ? t('Adresse copiée.') : t('La copie n’a pas pu se faire.'));
  });
  const legend = el('details', { class: 'sequence__legende' },
    el('summary', { text: t('Comment lire cette chaîne') }),
    el('ul', {},
      el('li', { text: t('Chaque carte est un élément de la séquence, dans l’ordre du texte.') }),
      el('li', { text: t('Variable : un mot porteur d’une racine du LEXICON. La carte donne sa racine, son état (Tasreef) et sa fonction.') }),
      el('li', { text: t('Opérateur : un mot-outil, sans racine. La carte donne son étiquette.') }),
      el('li', { text: t('Trait plein : vers une variable. Trait pointillé : vers un opérateur.') }),
      el('li', { text: t('Un clic sur une racine ouvre sa fiche dans le Scanner.') })));
  const head = el('header', { class: 'sequence__tete' }, el('div', { class: 'sequence__ligne' }, title, share), counts, legend);

  // ------------------------------------------------------------------ blocs

  const outage = el('div', { class: 'message message--erreur sequence__panne', attrs: { role: 'alert' } });
  const blocksBox = el('div', { class: 'sequence__blocs', attrs: { role: 'group', 'aria-label': t('CAUSAL SYSTEM GRAPH') } });
  let identity = null; // le passage à l'écran : son mode et ses références
  let slots = [];      // un emplacement par bloc, gardé tant que le passage ne change pas

  // Le message d'un échec et son bouton « Réessayer »
  const failureParts = (failure, retry) => [
    el('p', { class: 'message__titre', text: failureText(failure) }),
    el('div', { class: 'message__actions' },
      el('button', { class: 'bouton-bord', text: t('Réessayer'), attrs: { type: 'button' }, on: { click: retry } })),
  ];
  const failureNode = (failure, retry) => el('div', { class: 'message message--erreur', attrs: { role: 'alert' } }, failureParts(failure, retry));

  function newSlot(block) {
    // Le texte d'un verset est de l'arabe ; un texte libre peut être n'importe quoi
    const text = el('p', { class: 'bloc__texte', attrs: block.reference ? { lang: 'ar', dir: 'rtl' } : { dir: 'auto' } });
    text.hidden = true;
    const body = el('div', { class: 'bloc__corps' });
    const node = el('section', { class: 'bloc' },
      block.reference ? el('h3', { class: 'bloc__titre' }, el('span', { class: 'verset__ref', text: block.reference })) : null,
      text,
      body);
    return { node, text, body, shownText: null, step: null, sequence: null, failure: null };
  }

  // Ne touche au bloc que si quelque chose a changé pour lui
  function paintSlot(slot, block, index) {
    if (slot.shownText !== block.text) {
      slot.shownText = block.text;
      slot.text.textContent = block.text;
      slot.text.hidden = !block.text;
    }
    if (slot.step === block.step && slot.sequence === block.sequence && slot.failure === block.failure) return;
    Object.assign(slot, { step: block.step, sequence: block.sequence, failure: block.failure });
    if (block.step === 'pret' && block.sequence) {
      if (block.sequence.elements.length) mountSequenceChain(slot.body, { elements: block.sequence.elements });
      else fill(slot.body, el('p', { class: 'champ__aide bloc__vide', text: t('Aucun élément à afficher.') }));
    } else if (block.step === 'echec') {
      fill(slot.body, failureNode(block.failure, () => onRetry(index)));
    } else {
      fill(slot.body, el('p', { class: 'champ__aide bloc__attente', text: t('Séquence en cours…'), attrs: { role: 'status' } }));
    }
  }

  // ------------------------------------------------------------------ transcription, journal

  const transcriptBody = el('div', { class: 'transcription' });
  const copy = el('button', { class: 'bouton-bord', attrs: { type: 'button' } }, icon('copy'), el('span', { text: t('Copier') }));
  let lastBlocks = [];
  copy.addEventListener('click', async () => {
    say((await copyText(transcriptCopy(lastBlocks))) ? t('Transcription copiée.') : t('La copie n’a pas pu se faire.'));
  });
  const transcript = el('section', { class: 'sequence__transcription' },
    el('div', { class: 'sequence__ligne' }, el('h2', { class: 'sequence__section', text: t('TRANSCRIPTION MATÉRIELLE BRUTE') }), copy),
    el('p', { class: 'champ__aide sequence__sous-titre', text: t('Lecture séquentielle des fonctions logiques (Ghayr Dhi \'Iwaj).') }),
    transcriptBody);
  const journalBody = el('div', { class: 'journal', attrs: { dir: 'ltr' } });
  const journal = el('details', { class: 'sequence__journal' }, el('summary', { text: t('SYSTEM EXECUTION LOG') }), journalBody);
  let shownSequences = []; // les séquences déjà écrites dans la transcription et le journal
  transcript.hidden = true;
  journal.hidden = true;

  function paintTexts(blocks) {
    const done = blocks.filter((block) => block.step === 'pret' && block.sequence);
    const sequences = done.map((block) => block.sequence);
    if (same(sequences, shownSequences)) return;
    shownSequences = sequences;
    const spoken = done.filter((block) => block.sequence.transcript.trim());
    // Les étiquettes restent telles que l'API les rend, de gauche à droite ; les fonctions en gras, les états en italique
    fill(transcriptBody, spoken.map((block) => el('div', { class: 'transcription__bloc' },
      block.reference ? el('p', { class: 'verset__ref transcription__ref', text: block.reference }) : null,
      el('p', { class: 'transcription__texte', attrs: { dir: 'ltr' } }, renderInline(parseInline(block.sequence.transcript), { breakable: true })))));
    transcript.hidden = !spoken.length;
    const logged = done.filter((block) => block.sequence.logs.length);
    fill(journalBody, logged.map((block) => [
      block.reference ? el('p', { class: 'verset__ref journal__ref', text: block.reference }) : null,
      block.sequence.logs.map((line) => el('p', { class: 'journal__ligne', text: `> ${line}` })),
    ]));
    journal.hidden = !logged.length;
  }

  // ------------------------------------------------------------------ vers l'Interpréteur

  // Le même passage s'ouvre dans l'Interpréteur ; rien n'y est analysé tant que le visiteur ne le lance pas
  const toInterpreter = el('a', { class: 'bouton sequence__vers' }, el('span', { text: t('Analyser dans l’Interpréteur') }), icon('arrow'));

  fill(container, head, outage, blocksBox, transcript, journal, el('div', { class: 'sequence__envoi' }, toInterpreter, announce));

  // view : la vue de lib/sequence-run.js, {mode, passage, blocks, pending}
  function show(view) {
    const blocks = view.blocks;
    lastBlocks = blocks;
    const verses = view.mode === 'verset' && Boolean(view.passage);
    head.hidden = !view.mode;
    title.textContent = verses ? resultTitle(view.passage) : view.mode ? t('Texte libre') : '';
    share.hidden = !verses;
    toInterpreter.hidden = !verses;
    if (verses) toInterpreter.setAttribute('href', interpreterHref(view.passage));

    // Les comptes portent sur les blocs déjà séquencés, et montent à mesure
    const elements = blocks.flatMap((block) => (block.step === 'pret' && block.sequence ? block.sequence.elements : []));
    const found = sequenceCounts(elements);
    const chip = (text) => el('span', { class: 'pastille sequence__compte', text });
    fill(counts, blocks.some((block) => block.step === 'pret') ? [
      chip(t('Éléments : {n}', { n: number(found.total) })),
      chip(t('Variables : {n}', { n: number(found.variables) })),
      chip(t('Opérateurs : {n}', { n: number(found.operators) })),
      found.unknown ? chip(t('Sans racine connue : {n}', { n: number(found.unknown) })) : null,
    ] : []);

    // Un autre passage : les emplacements repartent de zéro
    const next = `${view.mode}|${blocks.map((block) => block.reference).join(',')}`;
    if (next !== identity) {
      identity = next;
      slots = blocks.map(newSlot);
      fill(blocksBox, slots.map((slot) => slot.node));
    }
    blocks.forEach((block, index) => paintSlot(slots[index], block, index));

    // Tous les versets en échec : un seul message, qui relance tout
    const down = blocks.length > 1 && blocks.every((block) => block.step === 'echec');
    outage.hidden = !down;
    blocksBox.hidden = down;
    if (down) fill(outage, failureParts(blocks[0].failure, () => blocks.forEach((_, index) => onRetry(index))));
    paintTexts(blocks);
  }

  show({ mode: null, passage: null, blocks: [], pending: 0 });
  return { show };
}
