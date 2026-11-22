// Panneau « Valider / Corriger » du corpus public, sous l'analyse affichée. Mode développeur seulement.
// Même déroulé que le panneau de l'app mobile et de l'app classique : replié ; à l'ouverture, le brouillon
// (le texte sans l'en-tête technique, et la référence proposée) est demandé au serveur ; l'auteur valide
// tel quel ou corrige ; ensuite, toute modification réécrit la même entrée du corpus.
// Un enregistrement est publié : le serveur lance la publication du corpus (site et jeu de données).
// Ces textes ne s'affichent qu'à l'auteur : comme dans les deux apps, ils sont en français, non traduits.
import { draftRequest, saveRequest, updateRequest } from '../lib/corpus-panel.js';
import { describeFailure } from '../lib/failures.js';
import { el, fill } from './dom.js';
import { td } from './i18n-dom.js';

function field(id, label, control, help) {
  return el('div', { class: 'champ' }, el('label', { class: 'champ__etiquette', text: label, attrs: { for: id } }), control, help || null);
}

// Le message d'un refus : celui du serveur quand il en donne un (ils sont écrits pour l'auteur)
function failureText(failure) {
  if (failure && failure.kind === 'http' && failure.status === 401) return 'Mot de passe développeur refusé par le serveur : ressaisis-le dans « Clé API ».';
  if (failure && failure.kind === 'http' && failure.detail) return String(failure.detail);
  return td(describeFailure(failure).text);
}

const savedText = (entry) => `Enregistré dans le corpus : ${entry.status === 'validated' ? 'validé tel quel.' : 'version corrigée.'}`;

// source : {api, credentials()} ;
// shown : ce que la page affiche, {result, passage, lastInput, first, language, corpusEntry} ;
// onSaved(result, entry) : l'analyse vient d'être enregistrée, ou son entrée mise à jour.
export function corpusPanel({ api, credentials }, shown, onSaved) {
  const { result } = shown;
  let saved = shown.corpusEntry || null; // entrée déjà enregistrée pour cette analyse
  let kind = '';
  let loaded = false;
  let busy = false;

  const mark = el('span', { class: 'pastille corpus__marque', text: 'Enregistré', attrs: { hidden: !saved } });
  const body = el('div', { class: 'corpus__corps' });
  const reference = el('input', { class: 'saisie', attrs: { id: 'corpus-reference', type: 'text', autocomplete: 'off', dir: 'ltr' } });
  const kindHelp = el('p', { class: 'champ__aide' });
  const finalText = el('textarea', { class: 'saisie corpus__texte', attrs: { id: 'corpus-texte', rows: 16, dir: 'auto', spellcheck: 'false' } });
  const note = el('input', { class: 'saisie', attrs: { id: 'corpus-note', type: 'text', autocomplete: 'off', dir: 'auto' } });
  const again = el('p', { class: 'champ__aide', text: 'Tu peux encore le modifier : la même entrée sera mise à jour.' });
  const buttons = el('div', { class: 'corpus__actions' });
  const info = el('p', { class: 'corpus__info', attrs: { role: 'status', hidden: true } });
  const error = el('p', { class: 'corpus__erreur', attrs: { role: 'alert', hidden: true } });

  function say(text = '', problem = '') {
    info.textContent = text;
    info.hidden = !text;
    error.textContent = problem;
    error.hidden = !problem;
  }

  const button = (style, label, action) => el('button', { class: style, text: label, attrs: { type: 'button', disabled: busy }, on: { click: () => send(action) } });

  // Avant le premier enregistrement : valider ou corriger ; ensuite : mettre à jour la même entrée
  function paintButtons() {
    mark.hidden = !saved;
    again.hidden = !saved;
    fill(buttons, saved
      ? button('bouton', 'Mettre à jour l’entrée', 'update')
      : [button('bouton', 'Valider tel quel', 'validate'), button('bouton-bord', 'Enregistrer la correction', 'correct')]);
  }

  async function send(action) {
    if (busy) return;
    busy = true;
    paintButtons();
    say();
    const fields = { reference: reference.value, finalText: finalText.value, note: note.value };
    try {
      if (saved) {
        const { id, body: update } = updateRequest(saved, fields);
        const answer = await api.corpusUpdate(id, update, credentials());
        saved = answer.entry;
        say(answer.changed ? 'Entrée mise à jour.' : 'Aucune modification à enregistrer.');
      } else {
        saved = await api.corpusSave(saveRequest({ action, input: shown.lastInput, result, kind, language: shown.language, ...fields }), credentials());
        say(savedText(saved));
      }
      onSaved(result, saved);
    } catch (failure) {
      say('', failureText(failure));
    } finally {
      busy = false;
      paintButtons();
    }
  }

  // À la première ouverture : le texte à relire et la référence proposée viennent du serveur
  async function load() {
    if (loaded || busy) return;
    busy = true;
    fill(body, el('p', { class: 'champ__aide', text: 'Chargement du brouillon…' }));
    try {
      const draft = await api.corpusDraft(draftRequest({ input: shown.lastInput, result, passage: shown.passage, first: shown.first }), credentials());
      kind = draft.kind || 'free';
      kindHelp.textContent = `Type : ${kind}`;
      // Analyse déjà enregistrée (la page a été rechargée) : ce qui est dans le corpus l'emporte sur le brouillon
      reference.value = saved ? saved.reference : draft.reference || '';
      finalText.value = saved ? saved.final_output : draft.text || '';
      note.value = saved ? saved.note : '';
      loaded = true;
      busy = false;
      paintButtons();
      fill(body,
        again,
        field('corpus-reference', 'Référence (ex. 2:255 ou 2:1-5)', reference, kindHelp),
        field('corpus-texte', 'Texte final (corrige directement ici)', finalText),
        field('corpus-note', 'Note de correction (facultatif)', note),
        buttons);
      if (saved) say(savedText(saved));
    } catch (failure) {
      busy = false;
      fill(body,
        el('p', { class: 'corpus__erreur', text: failureText(failure), attrs: { role: 'alert' } }),
        el('button', { class: 'bouton-lien', text: 'Réessayer', attrs: { type: 'button' }, on: { click: load } }));
    }
  }

  const panel = el('details', { class: 'corpus' },
    el('summary', { class: 'corpus__titre' }, el('span', { text: 'Corpus public : valider / corriger' }), mark),
    el('div', { class: 'corpus__dans' },
      el('p', { class: 'champ__aide', text: 'Seuls les textes validés ou corrigés ici entrent dans le corpus public (licence CC BY 4.0). La réponse brute est conservée à côté du texte final.' }),
      body,
      info,
      error));
  panel.addEventListener('toggle', () => {
    if (panel.open) load();
  });
  return panel;
}
