// Colonne « Analyse » de l'Interpréteur. Quatre états : vide, attente, résultat, erreur.
// Une zone d'état (attente ou erreur) précède la zone du résultat : pendant une attente ou après un
// échec, l'analyse précédente reste affichée dessous.
import { describeFailure } from '../lib/failures.js';
import { resultTitle } from '../lib/verses.js';
import { clear, el } from './dom.js';
import { t, td, tm } from './i18n-dom.js';

function titleOf(passage) {
  if (passage && passage.mode === 'verset') return resultTitle(passage);
  if (passage && passage.mode === 'tarteel') return `Tarteel : ${passage.primary}${passage.constraint ? ` ∩ ${passage.constraint}` : ''}`;
  return t('Texte libre');
}

// onRetry() : relancer la demande en échec ; onManageKey() : ouvrir la fenêtre de la clé
export function mountAnalysis(container, { onRetry, onManageKey }) {
  const status = el('div', { class: 'analyse__etat' });
  const result = el('div', { class: 'analyse__resultat' });
  clear(container).append(
    el('a', { class: 'analyse__retour', text: t('Modifier le passage'), attrs: { href: '#passage' } }),
    status,
    result);

  let timer = null;
  let pings = 0;
  let pingCount = null;

  function stopTimer() {
    if (timer !== null) clearInterval(timer);
    timer = null;
  }

  function header(title) {
    return el('header', { class: 'analyse__tete' },
      el('div', { class: 'analyse__titres' },
        el('p', { class: 'analyse__surtitre', text: t('Analyse') }),
        el('h2', { class: 'analyse__titre', text: title, attrs: { dir: 'auto' } })));
  }

  return {
    showEmpty() {
      stopTimer();
      clear(status);
      clear(result).append(
        header(t('L’analyse s’affichera ici')),
        el('p', { class: 'analyse__intro', text: t('Choisissez un passage, puis lancez l’analyse : sens littéraire, audit des déviations, conclusion, tableau des racines et compilation.') }),
        el('p', { class: 'note' }, tm("**Avertissement d'exécution :** L'accès de l'IA aux exégèses traditionnelles (Tafsir) a été bloqué au maximum pour assurer une décompilation purement mécanique. Quelques résidus dogmatiques peuvent encore transparaître, mais ce bruit s'atténuera au fil des mises à jour du Lexicon.")));
    },

    // L'analyse précédente, s'il y en a une, reste affichée sous la zone d'état
    showWaiting() {
      stopTimer();
      pings = 0;
      const started = Date.now();
      const elapsed = el('p', { class: 'attente__duree', text: t('Durée écoulée : {n} s', { n: 0 }) });
      pingCount = el('p', { text: t('Signaux reçus du serveur : {n}', { n: 0 }) });
      clear(status).append(el('div', { class: 'attente' },
        // Cette partie est annoncée par les lecteurs d'écran ; la durée, qui change chaque seconde, ne l'est pas
        el('div', { attrs: { role: 'status', 'aria-live': 'polite' } },
          el('p', { class: 'attente__titre' }, el('span', { class: 'attente__rond', attrs: { 'aria-hidden': 'true' } }), el('span', { text: t('System processing...') })),
          el('ol', { class: 'attente__etapes' },
            el('li', { text: t('Initializing connection to Gemini Core...') }),
            el('li', { text: t('Injecting Full Minified Lexicon...') }),
            el('li', { text: t('Executing Systemic Parsing...') }))),
        elapsed,
        el('p', { class: 'champ__aide', text: t('L’analyse peut prendre plus d’une minute. Gardez cette page ouverte.') }),
        el('details', { class: 'detail' }, el('summary', { text: t('Détail technique') }), pingCount)));
      timer = setInterval(() => {
        elapsed.textContent = t('Durée écoulée : {n} s', { n: Math.round((Date.now() - started) / 1000) });
      }, 1000);
    },

    // Un signal du serveur est arrivé pendant l'attente
    notePing() {
      pings += 1;
      if (pingCount) pingCount.textContent = t('Signaux reçus du serveur : {n}', { n: pings });
    },

    showResult({ result: text, passage }) {
      stopTimer();
      clear(status);
      clear(result).append(header(titleOf(passage)), el('pre', { class: 'analyse__brut', text, attrs: { dir: 'auto' } }));
    },

    showFailure(failure, { keepResult = false } = {}) {
      stopTimer();
      const { text, retry, askKey } = describeFailure(failure);
      const detail = failure && failure.detail ? String(failure.detail) : '';
      const actions = el('div', { class: 'message__actions' },
        retry ? el('button', { class: 'bouton-bord', text: t('Réessayer'), attrs: { type: 'button' }, on: { click: () => onRetry() } }) : null,
        askKey ? el('button', { class: 'bouton-bord', text: t('Gérer la clé'), attrs: { type: 'button' }, on: { click: () => onManageKey() } }) : null);
      clear(status).append(el('div', { class: 'message message--erreur', attrs: { role: 'alert' } },
        el('p', { class: 'message__titre', text: td(text) }),
        // Le message du moteur est fait pour être lu : il s'affiche ouvert. Les autres détails restent repliés.
        detail ? el('details', { class: 'detail', attrs: { open: failure.kind === 'engine' } },
          el('summary', { text: t('Détail technique') }),
          el('pre', { class: 'detail__texte', text: failure.status ? `${failure.status} — ${detail}` : detail, attrs: { dir: 'auto' } })) : null,
        actions));
      if (!keepResult) clear(result);
    },
  };
}
