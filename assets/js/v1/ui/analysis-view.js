// Colonne « Analyse » de l'Interpréteur. Quatre états : vide, attente, résultat, erreur.
// Une zone d'état (attente ou erreur) précède la zone du résultat : pendant une attente ou après un
// échec, l'analyse précédente reste affichée dessous.
// Le texte d'une analyse est mis en forme, jamais réécrit : Copier et Exporter donnent le texte reçu du
// moteur, au caractère près, en-tête technique compris.
import { parseHeader, publishedHref, splitOutput } from '../lib/engine-output.js';
import { EXPORT_LINK_LIFETIME_MS, exportFileName } from '../lib/export-name.js';
import { BILLED_NOTICE, describeFailure, maybeBilled } from '../lib/failures.js';
import { outline, parseMarkdown } from '../lib/markdown.js';
import { resultTitle } from '../lib/verses.js';
import { corpusPanel } from './corpus-panel.js';
import { add, clear, el, fill } from './dom.js';
import { icon } from './icons.js';
import { t, td, tm } from './i18n-dom.js';
import { renderBlocks } from './markdown-view.js';

function titleOf(passage) {
  if (passage && passage.mode === 'verset') return resultTitle(passage);
  if (passage && passage.mode === 'tarteel') return `${t('Tarteel')} : ${passage.primary}${passage.constraint ? ` ∩ ${passage.constraint}` : ''}`;
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
    add(document.body, area);
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
  add(document.body, link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), EXPORT_LINK_LIFETIME_MS);
}

function actionButton(name, label, onClick) {
  return el('button', { class: 'bouton-bord', attrs: { type: 'button' }, on: { click: onClick } }, icon(name), el('span', { text: label }));
}

// Copier, Exporter, Imprimer : toujours le texte reçu du moteur, tel quel
function resultActions(raw, passage, input) {
  const announce = el('span', { class: 'sr', attrs: { role: 'status' } });
  const copy = actionButton('copy', t('Copier'), async () => {
    announce.textContent = (await copyText(raw)) ? t('Analyse copiée.') : t('La copie n’a pas pu se faire.');
  });
  const reference = passage && passage.mode === 'verset' ? { sura: passage.sura, start: passage.start } : null;
  const save = actionButton('download', t('Exporter'), () => downloadText(exportFileName({ reference, result: raw, input }), raw));
  const print = actionButton('printer', t('Imprimer'), () => window.print());
  return el('div', { class: 'analyse__actions' }, copy, save, print, announce);
}

// Échanges précédents de la conversation, repliés : la demande du visiteur, puis la réponse mise en forme
function earlierExchanges(previous) {
  const list = el('div', { class: 'echanges__liste' });
  for (const [request, answer] of previous) {
    add(list, el('div', { class: 'echange' },
      el('p', { class: 'echange__role', text: t('Votre demande') }),
      el('p', { class: 'echange__demande', text: request, attrs: { dir: 'auto' } }),
      el('p', { class: 'echange__role', text: t('Réponse') }),
      // Sans repères de section : ceux de l'analyse affichée ne doivent pas exister en double
      el('div', { class: 'analyse__corps' }, renderBlocks(parseMarkdown(splitOutput(answer).text), { ids: false }))));
  }
  return el('details', { class: 'echanges' }, el('summary', { text: `${t('Échanges précédents')} (${previous.length})` }), list);
}

// onRetry() : relancer la demande en échec ; onManageKey() : ouvrir la fenêtre de la clé ;
// onFollowUp(message) : poursuivre la conversation ; onNewConversation() : en commencer une autre ;
// publishedPages() : promesse des adresses publiées du corpus (pour les liens des références) ;
// corpus : {api, credentials(), onSaved(result, entry)}, pour le panneau « Valider / Corriger » du mode développeur
export function mountAnalysis(container, { onRetry, onManageKey, onFollowUp, onNewConversation, publishedPages = async () => null, corpus = null }) {
  const status = el('div', { class: 'analyse__etat' });
  const result = el('div', { class: 'analyse__resultat' });
  fill(container,
    el('a', { class: 'analyse__retour', text: t('Modifier le passage'), attrs: { href: '#passage' } }),
    status,
    result);

  let timer = null;
  let pings = 0;
  let pingCount = null;
  let submitDraft = null; // envoie ce que contient la zone de suite, quand elle est à l'écran
  let devMode = false;     // mode développeur : le panneau du corpus s'affiche sous l'analyse
  let current = null;      // l'analyse affichée, telle que la page l'a reçue
  let corpusHolder = null; // emplacement du panneau du corpus, sous l'analyse affichée

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

  // Le panneau du corpus n'existe qu'en mode développeur. Il n'est bâti qu'une fois par analyse : le rebâtir
  // effacerait ce que l'auteur y a saisi.
  function paintCorpus() {
    if (!corpusHolder) return;
    if (!devMode || !corpus || !current) {
      clear(corpusHolder);
      return;
    }
    if (corpusHolder.firstChild) return;
    fill(corpusHolder, corpusPanel(corpus, current, (result, entry) => {
      // L'entrée suit l'analyse affichée : si le panneau est rebâti, il la retrouve
      if (current && current.result === result) current = { ...current, corpusEntry: entry };
      corpus.onSaved(result, entry);
    }));
  }

  // Sous l'analyse qui vient d'être affichée
  function corpusPlace(shown) {
    current = shown;
    corpusHolder = el('div', { class: 'analyse__corpus' });
    return corpusHolder;
  }

  function forgetResult() {
    submitDraft = null;
    current = null;
    corpusHolder = null;
  }

  // Pendant une attente, la suite de conversation est verrouillée comme le formulaire
  function lockFollowUp(locked) {
    for (const control of result.querySelectorAll('.suite textarea, .suite button')) control.disabled = locked;
  }

  // Sous l'analyse : poursuivre la conversation, ou en commencer une autre
  function followUpForm() {
    const message = el('textarea', { class: 'saisie', attrs: { id: 'suite-texte', rows: 2, placeholder: t('Objecter, demander une précision…') } });
    const form = el('form', { class: 'suite', attrs: { novalidate: true } },
      el('label', { class: 'champ__etiquette', text: t('Poursuivre la conversation'), attrs: { for: 'suite-texte' } }),
      message,
      el('div', { class: 'suite__bas' },
        el('span', { class: 'champ__aide', text: t('Conversation en cours : votre prochain message la poursuit.') }),
        el('div', { class: 'suite__actions' },
          el('button', { class: 'bouton-bord', text: t('Nouvelle conversation'), attrs: { type: 'button' }, on: { click: () => onNewConversation() } }),
          el('button', { class: 'bouton', attrs: { type: 'submit' } }, el('span', { text: t('Envoyer') }), icon('arrow')))));
    const submit = () => {
      if (message.value.trim()) onFollowUp(message.value);
      else message.focus();
    };
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submit();
    });
    // Ctrl + Entrée (ou Cmd + Entrée) envoie le message
    message.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      submit();
    });
    submitDraft = submit;
    return form;
  }

  // Un libellé de référence ne devient un lien que si une page du corpus est publiée à son adresse.
  // La liste publiée arrive après l'affichage : d'ici là, et sans elle, les libellés restent du texte.
  async function linkReferences(labels, holders) {
    let published = null;
    try {
      published = await publishedPages();
    } catch {
      published = null;
    }
    labels.forEach((label, index) => {
      const href = publishedHref(label, published);
      if (href && holders[index].isConnected) {
        fill(holders[index], el('a', { class: 'analyse__reference', text: label, attrs: { href, target: '_blank', rel: 'noopener' } }));
      }
    });
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
      const holders = references.map((label) => el('span', {}, el('span', { class: 'analyse__reference', text: label, attrs: { dir: 'auto' } })));
      const list = el('span', { class: 'analyse__references' }, el('span', { text: t('Références du corpus :') }));
      holders.forEach((holder, position) => add(list, position > 0 ? ', ' : ' ', holder));
      add(row, list);
      linkReferences(references, holders);
    }
    return [row, usageText];
  }

  return {
    showEmpty() {
      stopTimer();
      forgetResult();
      clear(status);
      fill(result,
        header(t('L’analyse s’affichera ici')),
        el('p', { class: 'analyse__intro', text: t('Choisissez un passage, puis lancez l’analyse : sens littéraire, audit des déviations, conclusion, tableau des racines et compilation.') }),
        el('p', { class: 'note' }, tm("**Avertissement d'exécution :** L'accès de l'IA aux exégèses traditionnelles (Tafsir) a été bloqué au maximum pour assurer une décompilation purement mécanique. Quelques résidus dogmatiques peuvent encore transparaître, mais ce bruit s'atténuera au fil des mises à jour du Lexicon.")));
    },

    // L'analyse précédente, s'il y en a une, reste affichée sous la zone d'état
    showWaiting() {
      stopTimer();
      lockFollowUp(true);
      pings = 0;
      const started = Date.now();
      const elapsed = el('p', { class: 'attente__duree', text: t('Durée écoulée : {n} s', { n: 0 }) });
      pingCount = el('p', { text: t('Signaux reçus du serveur : {n}', { n: 0 }) });
      fill(status, el('div', { class: 'attente' },
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

    // result : le texte reçu du moteur ; passage : ce qui a été analysé ; input : la première demande du
    // visiteur ; previous : les échanges précédents de la conversation, [[demande, réponse], …]
    showResult(shown) {
      const { result: raw, passage, input = '', previous = [] } = shown;
      const { headerLine, text } = splitOutput(raw);
      const blocks = parseMarkdown(text);
      const sections = outline(blocks);
      // Tout est bâti avant de toucher à la page : si la mise en forme échoue, rien n'est effacé
      const content = [
        previous.length ? earlierExchanges(previous) : null,
        header(titleOf(passage), resultActions(raw, passage, input)),
        ...markers(headerLine),
        sections.length ? el('nav', { class: 'sommaire', attrs: { 'aria-label': t('Sections de l’analyse') } },
          sections.map((section) => el('a', { class: 'sommaire__lien', attrs: { href: `#${section.id}`, title: section.title } }, el('span', { text: section.title, attrs: { dir: 'auto' } })))) : null,
        el('div', { class: 'analyse__corps' }, renderBlocks(blocks, { tableLabel: t('Tableau de l’analyse') })),
      ];
      stopTimer();
      clear(status);
      fill(result, content, corpusPlace(shown), followUpForm());
      paintCorpus();
    },

    // Secours quand la mise en forme échoue : le texte reçu, tel quel, avec les mêmes actions
    showPlainResult(shown) {
      const { result: raw, passage, input = '' } = shown;
      stopTimer();
      clear(status);
      fill(result,
        header(titleOf(passage), resultActions(raw, passage, input)),
        el('pre', { class: 'analyse__brut', text: String(raw ?? ''), attrs: { dir: 'auto' } }),
        corpusPlace(shown),
        followUpForm());
      paintCorpus();
    },

    // Mode développeur en service, ou non : le panneau du corpus apparaît ou disparaît sous l'analyse affichée
    setDevMode(on) {
      devMode = Boolean(on);
      paintCorpus();
    },

    // « Réessayer » d'une suite : la zone de suite repart telle qu'elle est
    submitFollowUp() {
      if (submitDraft) submitDraft();
    },

    showFailure(failure, { keepResult = false } = {}) {
      stopTimer();
      lockFollowUp(false); // le message saisi reste dans sa zone : il peut repartir
      const { text, retry, askKey } = describeFailure(failure);
      const detail = failure && failure.detail ? String(failure.detail) : '';
      const actions = el('div', { class: 'message__actions' },
        retry ? el('button', { class: 'bouton-bord', text: t('Réessayer'), attrs: { type: 'button' }, on: { click: () => onRetry() } }) : null,
        askKey ? el('button', { class: 'bouton-bord', text: t('Gérer la clé'), attrs: { type: 'button' }, on: { click: () => onManageKey() } }) : null);
      fill(status, el('div', { class: 'message message--erreur', attrs: { role: 'alert' } },
        el('p', { class: 'message__titre', text: td(text) }),
        // Coupure ou délai dépassé : le serveur a pu finir l'analyse, et la clé être facturée
        maybeBilled(failure) ? el('p', { class: 'message__note', text: td(BILLED_NOTICE) }) : null,
        // Le message du moteur est fait pour être lu : il s'affiche ouvert. Les autres détails restent repliés.
        detail ? el('details', { class: 'detail', attrs: { open: failure.kind === 'engine' } },
          el('summary', { text: t('Détail technique') }),
          el('pre', { class: 'detail__texte', text: failure.status ? `${failure.status} — ${detail}` : detail, attrs: { dir: 'auto' } })) : null,
        actions));
      if (!keepResult) {
        forgetResult();
        clear(result);
      }
    },
  };
}
