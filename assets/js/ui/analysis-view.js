// Colonne « Analyse » de l'Interpréteur. Quatre états : vide, attente, résultat, erreur.
// Une zone d'état (attente ou erreur) précède la zone du résultat : pendant une attente ou après un
// échec, l'analyse précédente reste affichée dessous.
// Le texte d'une analyse est mis en forme, jamais réécrit : Copier et Exporter donnent le texte reçu du
// moteur, au caractère près, en-tête technique compris.
import { parseHeader, referenceHref, splitOutput } from '../lib/engine-output.js';
import { exportFileName } from '../lib/export-name.js';
import { describeFailure } from '../lib/failures.js';
import { outline, parseMarkdown } from '../lib/markdown.js';
import { resultTitle } from '../lib/verses.js';
import { clear, el } from './dom.js';
import { icon } from './icons.js';
import { t, td, tm } from './i18n-dom.js';
import { renderBlocks } from './markdown-view.js';

function titleOf(passage) {
  if (passage && passage.mode === 'verset') return resultTitle(passage);
  if (passage && passage.mode === 'tarteel') return `Tarteel : ${passage.primary}${passage.constraint ? ` ∩ ${passage.constraint}` : ''}`;
  return t('Texte libre');
}

// Copie dans le presse-papiers ; si le navigateur refuse l'accès direct, par une zone de texte invisible
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = el('textarea', { class: 'sr', attrs: { readonly: true, 'aria-hidden': 'true', tabindex: -1 } });
    area.value = text;
    document.body.append(area);
    area.select();
    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    }
    area.remove();
    return copied;
  }
}

function downloadText(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = el('a', { attrs: { href: url, download: name, hidden: true } });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function actionButton(name, label, onClick) {
  return el('button', { class: 'bouton-bord', attrs: { type: 'button' }, on: { click: onClick } }, icon(name), el('span', { text: label }));
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

  function header(title, actions) {
    return el('header', { class: 'analyse__tete' },
      el('div', { class: 'analyse__titres' },
        el('p', { class: 'analyse__surtitre', text: t('Analyse') }),
        el('h2', { class: 'analyse__titre', text: title, attrs: { dir: 'auto' } })),
      actions || null);
  }

  // Repères tirés de l'en-tête technique : le modèle, les jetons et le coût (repliés), les références du corpus
  function markers(headerLine) {
    const { model, usage, references } = parseHeader(headerLine);
    // En-tête de forme inconnue : rien n'est inventé, la ligne s'affiche telle quelle dans le repli
    const usageText = el('p', { class: 'analyse__jetons', text: usage === null ? headerLine : usage, attrs: { id: 'analyse-jetons', hidden: true, dir: 'ltr' } });
    const usageButton = el('button', { class: 'pastille pastille--bouton', attrs: { type: 'button', 'aria-expanded': 'false', 'aria-controls': 'analyse-jetons' } },
      el('span', { text: t('Jetons et coût') }), icon('chevron', 14));
    usageButton.addEventListener('click', () => {
      usageText.hidden = !usageText.hidden;
      usageButton.setAttribute('aria-expanded', String(!usageText.hidden));
    });
    const row = el('div', { class: 'analyse__reperes' },
      model ? el('span', { class: 'pastille pastille--code', text: model }) : null,
      usageButton);
    if (references.length) {
      const list = el('span', { class: 'analyse__references' }, el('span', { text: t('Références du corpus :') }));
      references.forEach((label, position) => {
        const href = referenceHref(label);
        if (position > 0) list.append(', ');
        else list.append(' ');
        list.append(href ? el('a', { class: 'analyse__reference', text: label, attrs: { href, target: '_blank', rel: 'noopener' } }) : el('span', { class: 'analyse__reference', text: label }));
      });
      row.append(list);
    }
    return [row, usageText];
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

    // result : le texte reçu du moteur ; passage : ce qui a été analysé ; input : la demande du visiteur
    showResult({ result: raw, passage, input = '' }) {
      stopTimer();
      clear(status);
      const { headerLine, text } = splitOutput(raw);
      const blocks = parseMarkdown(text);
      const sections = outline(blocks);
      const announce = el('span', { class: 'sr', attrs: { role: 'status' } });

      const copy = actionButton('copy', t('Copier'), async () => {
        announce.textContent = (await copyText(raw)) ? t('Analyse copiée.') : t('La copie n’a pas pu se faire.');
      });
      const reference = passage && passage.mode === 'verset' ? { sura: passage.sura, start: passage.start } : null;
      const save = actionButton('download', t('Exporter'), () => downloadText(exportFileName({ reference, result: raw, input }), raw));
      const print = actionButton('printer', t('Imprimer'), () => window.print());

      clear(result).append(
        header(titleOf(passage), el('div', { class: 'analyse__actions' }, copy, save, print, announce)),
        ...markers(headerLine),
        sections.length ? el('nav', { class: 'sommaire', attrs: { 'aria-label': t('Sections de l’analyse') } },
          sections.map((section) => el('a', { class: 'sommaire__lien', attrs: { href: `#${section.id}`, title: section.title } }, el('span', { text: section.title, attrs: { dir: 'auto' } })))) : null,
        el('div', { class: 'analyse__corps' }, renderBlocks(blocks, { tableLabel: t('Tableau de l’analyse') })));
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
