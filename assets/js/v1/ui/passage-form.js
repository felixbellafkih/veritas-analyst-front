// Colonne « Passage » de l'Interpréteur : le choix de ce qui sera analysé, en trois modes.
// - Verset : sourate, du verset, au verset (10 versets au plus), avec le texte arabe affiché aussitôt.
// - Tarteel : racine primaire et contrainte, puis tous les versets du cluster, à cocher (lib/tarteel-probe.js).
// - Texte libre : une zone de 10 000 caractères.
// Puis, communs aux trois modes : la langue de la réponse, le modèle Gemini, le lancement, l'état de la clé.
import { ApiFailure, describeFailure } from '../lib/failures.js';
import { FREE_TEXT_MAX, ROOT_MAX, formState } from '../lib/form-state.js';
import { responseLanguage } from '../lib/i18n.js';
import { createLatest } from '../lib/interpreter-state.js';
import { parseMarkdown } from '../lib/markdown.js';
import { modelMenu } from '../lib/models.js';
import { createTarteelProbe } from '../lib/tarteel-probe.js';
import { clusterVerse } from '../lib/tarteel.js';
import { MAX_VERSES, SURAS, clampRange, cleanVerseText, referenceLabel } from '../lib/verses.js';
import { add, clear, el, fill } from './dom.js';
import { icon } from './icons.js';
import { currentLang, languages, t, td } from './i18n-dom.js';
import { renderBlocks } from './markdown-view.js';

// Champ étiqueté : l'étiquette est liée au champ par son identifiant
function field(id, label, control) {
  return el('div', { class: 'champ' }, el('label', { class: 'champ__etiquette', text: label, attrs: { for: id } }), control);
}

function message(kind, text) {
  return el('p', { class: `message message--${kind}`, text, attrs: { dir: 'auto' } });
}

// asked : passage demandé par l'adresse de la page (il l'emporte sur le formulaire gardé pour l'onglet) ;
// onLaunch(passage) : le visiteur lance l'analyse ; onManageKey() : il ouvre la fenêtre de la clé
export function mountPassageForm(container, { api, store, asked, onLaunch, onManageKey }) {
  const state = formState(store.loadForm());
  if (asked) Object.assign(state, { mode: 'verset', sura: asked.sura, start: asked.start, end: asked.end });
  const save = () => store.saveForm(state);
  let disabled = false;

  // ------------------------------------------------------------------ mode Verset

  const verseLatest = createLatest();
  const verseCache = new Map(); // textes déjà lus pendant cette visite
  let verseText = '';
  let versePending = null;

  const sura = el('select', { class: 'saisie', attrs: { id: 'sourate' } });
  for (const entry of SURAS) add(sura, el('option', { text: `${entry.n} · ${entry.name}`, attrs: { value: entry.n } }));
  const start = el('input', { class: 'saisie', attrs: { id: 'verset-debut', type: 'number', inputmode: 'numeric', min: 1 } });
  const end = el('input', { class: 'saisie', attrs: { id: 'verset-fin', type: 'number', inputmode: 'numeric', min: 1 } });
  const hint = el('p', { class: 'champ__aide' });
  const reference = el('span', { class: 'verset__ref' });
  const verseBody = el('div', { class: 'verset__corps' });
  const verse = el('div', { class: 'verset', attrs: { 'aria-live': 'polite' } }, reference, verseBody);

  function showVerseText() {
    fill(verseBody, el('p', { class: 'verset__texte', text: cleanVerseText(verseText), attrs: { lang: 'ar', dir: 'rtl' } }));
  }

  function showVerseFailure(failure) {
    fill(verseBody,
      el('p', { class: 'verset__erreur', text: failure.kind === 'http' && failure.status === 404 ? t('Passage introuvable.') : t('Texte indisponible pour l’instant.') }),
      el('button', { class: 'bouton-lien', text: t('Réessayer'), attrs: { type: 'button' }, on: { click: loadVerse } }));
  }

  // Lit le texte du passage. Si le visiteur change de choix entre-temps, seule la dernière lecture compte.
  async function loadVerse() {
    const key = `${state.sura}:${state.start}-${state.end}`;
    const token = verseLatest.next();
    if (versePending) versePending.abort();
    reference.textContent = referenceLabel(state);
    if (verseCache.has(key)) {
      verseText = verseCache.get(key);
      showVerseText();
      return;
    }
    verseText = '';
    fill(verseBody, el('p', { class: 'verset__attente', text: t('Chargement du texte…') }));
    versePending = new AbortController();
    try {
      const loaded = await api.verseRange(state.sura, state.start, state.end, { signal: versePending.signal });
      verseCache.set(key, loaded);
      if (!verseLatest.isCurrent(token)) return;
      verseText = loaded;
      showVerseText();
    } catch (failure) {
      if (verseLatest.isCurrent(token) && failure.kind !== 'aborted') showVerseFailure(failure);
    }
  }

  function paintVerseFields() {
    const limit = SURAS[state.sura - 1].verses;
    sura.value = String(state.sura);
    start.value = String(state.start);
    start.max = String(limit);
    end.value = String(state.end);
    end.min = String(state.start);
    end.max = String(Math.min(limit, state.start + MAX_VERSES - 1));
    hint.textContent = t('Sourate de {n} versets · 10 versets au plus par analyse', { n: limit });
  }

  function changePassage(next) {
    const range = clampRange(next.sura, next.start, next.end);
    if (!range) return;
    Object.assign(state, { sura: Number(next.sura), ...range });
    paintVerseFields();
    save();
    loadVerse();
  }

  sura.addEventListener('change', () => changePassage({ sura: Number(sura.value), start: 1, end: 1 }));
  start.addEventListener('change', () => changePassage({ sura: state.sura, start: start.value, end: Math.max(Number(end.value) || 0, Number(start.value) || 0) }));
  end.addEventListener('change', () => changePassage({ sura: state.sura, start: state.start, end: end.value }));

  const versePanel = el('div', { class: 'passage__mode' },
    field('sourate', t('Sourate'), el('div', { class: 'choix' }, sura, icon('chevron'))),
    el('div', { class: 'passage__versets' }, field('verset-debut', t('Du verset'), start), field('verset-fin', t('au verset'), end)),
    hint,
    verse);

  // ------------------------------------------------------------------ mode Tarteel

  const rootAttrs = { type: 'text', maxlength: ROOT_MAX, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', dir: 'auto' };
  const primary = el('input', { class: 'saisie', attrs: { id: 'racine-primaire', ...rootAttrs } });
  const constraint = el('input', { class: 'saisie', attrs: { id: 'racine-contrainte', ...rootAttrs } });
  const signal = el('div', { class: 'tarteel__signal', attrs: { role: 'status', 'aria-live': 'polite' } });
  const clusterBox = el('div', { class: 'tarteel__cluster' });
  let clusterUi = null;      // cases et compteur du cluster à l'écran
  let tarteelStep = '';      // dernière étape affichée
  let tarteelSynced = false; // faux tant que la saisie gardée pour l'onglet n'a pas été vérifiée

  // Tous les versets du cluster, une case devant chacun : le visiteur coche ceux qu'il veut faire analyser.
  // Rien n'est coché au départ. La sélection elle-même est tenue par la sonde (lib/tarteel-probe.js).
  function clusterList(verses) {
    const count = el('p', { class: 'cluster__compte', attrs: { role: 'status' } });
    const hint = el('p', { class: 'message message--attention', text: t('Cochez au moins un verset.'), attrs: { role: 'alert', hidden: true } });
    const boxes = [];
    const paint = () => {
      const { chosen, total } = probe.selection();
      count.textContent = t('Versets cochés : {n} sur {total}', { n: chosen, total });
      if (chosen) hint.hidden = true;
    };
    const setAll = (on) => {
      probe.selectAll(on);
      for (const box of boxes) box.checked = on;
      paint();
    };
    const list = el('ul', { class: 'cluster__liste' });
    verses.forEach((item, index) => {
      const { reference: label, text } = clusterVerse(item);
      const box = el('input', { class: 'cluster__case', attrs: { type: 'checkbox' } });
      box.addEventListener('change', () => {
        probe.select(index, box.checked);
        paint();
      });
      boxes.push(box);
      // Toute la ligne est l'étiquette de sa case : un clic sur le verset le coche
      add(list, el('li', {}, el('label', { class: 'cluster__verset' }, box,
        el('span', { class: 'cluster__contenu' },
          label ? el('span', { class: 'verset__ref', text: label }) : null,
          el('span', { class: 'cluster__texte', text, attrs: label ? { lang: 'ar', dir: 'rtl' } : { dir: 'auto' } })))));
    });
    clusterUi = { hint, first: boxes[0] };
    paint();
    return [
      el('div', { class: 'cluster__barre' }, count,
        el('div', { class: 'cluster__outils' },
          el('button', { class: 'bouton-lien cluster__outil', text: t('Tout sélectionner'), attrs: { type: 'button' }, on: { click: () => setAll(true) } }),
          el('button', { class: 'bouton-lien cluster__outil', text: t('Tout désélectionner'), attrs: { type: 'button' }, on: { click: () => setAll(false) } }))),
      hint,
      el('div', { class: 'cluster', attrs: { role: 'group', 'aria-label': t('Versets du cluster') } }, list),
    ];
  }

  function tarteelFailure(failure) {
    return [
      // Fréquences de forme inattendue (failure absent) : le message est celui d'une erreur du serveur
      message('erreur', td(describeFailure(failure || new ApiFailure('http')).text)),
      el('button', { class: 'bouton-lien', text: t('Réessayer'), attrs: { type: 'button' }, on: { click: () => probe.check() } }),
    ];
  }

  // Affiche ce que la vérification annonce (lib/tarteel-probe.js)
  function showTarteel(view) {
    const repeated = view.step === 'attente' && tarteelStep === 'attente'; // à chaque frappe : rien de neuf à annoncer
    tarteelStep = view.step;
    if (repeated) return;
    clusterUi = null;

    // Plus de plafond : dès une occurrence, le signal est pur, et c'est le visiteur qui choisit les versets
    if (view.step === 'vide') {
      clear(signal);
    } else if (view.step === 'attente') {
      fill(signal, el('p', { class: 'champ__aide', text: t('Recherche des occurrences…') }));
    } else if (view.step === 'echec' && view.stage === 'frequences') {
      fill(signal, tarteelFailure(view.failure));
    } else if (view.step === 'signal') {
      fill(signal, message('erreur', t("Aucune occurrence détectée (0 résultat). Assurez-vous d'avoir introduit une racine valide. Ex : S-M-W  س م و | D.-R-B ض ر ب | DH-K-R ذ ك ر  | A.-B-D ع ب د")));
    } else {
      fill(signal, message('reussite', t('Signal pur ({n} occurrences triangulées).', { n: view.count })));
    }

    // Sous le signal : les versets du cluster, ou ce qui en tient lieu
    if (view.step === 'lecture') fill(clusterBox, el('p', { class: 'champ__aide', text: t('Chargement du texte…') }));
    else if (view.step === 'pret') fill(clusterBox, clusterList(view.verses));
    else if (view.step === 'message') fill(clusterBox, message('erreur', td(view.text)));
    else if (view.step === 'absent') fill(clusterBox, message('erreur', t('Zéro occurrence matérielle trouvée pour cette triangulation.')));
    else if (view.step === 'echec' && view.stage === 'cluster') fill(clusterBox, tarteelFailure(view.failure));
    else clear(clusterBox);
  }

  const probe = createTarteelProbe({ api, onChange: showTarteel });

  // À chaque frappe : ce qui était vérifié ne vaut plus, et la vérification attend la fin de la saisie
  function rootsChanged() {
    state.primary = primary.value;
    state.constraint = constraint.value;
    save();
    tarteelSynced = true;
    probe.input(state.primary, state.constraint);
  }

  primary.addEventListener('input', rootsChanged);
  constraint.addEventListener('input', rootsChanged);

  const tarteelPanel = el('div', { class: 'passage__mode' },
    el('div', { class: 'texte-auteur tarteel__aide' }, renderBlocks(parseMarkdown(t("Module d'extraction par triangulation. Pour isoler un sujet lié à une racine à haute fréquence, croisez avec une racine de contrainte ou un Tasreef précis afin d'éviter la saturation du processeur IA (Buffer Overflow).\n\n💡 **Support Bi-directionnel :** Saisie acceptée en **Arabe** (ex: ض ر ب) ou en **Latin**.\n*Rappel Latin (Emphatiques) :* `A.` (ع) | `H.` (ح) | `S.` (ص) | `D.` (ض) | `T.` (ط) | `Z.` (ظ)")), { ids: false })),
    field('racine-primaire', t('1. Racine Primaire (ex: D.-R-B)'), primary),
    field('racine-contrainte', t('2. Contrainte (Optionnelle)'), constraint),
    signal,
    clusterBox);

  // ------------------------------------------------------------------ mode Texte libre

  const freeText = el('textarea', {
    class: 'saisie',
    attrs: { id: 'texte-libre', rows: 6, maxlength: FREE_TEXT_MAX, dir: 'auto', placeholder: t('Ex: ...بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ ...') },
  });
  const counter = el('p', { class: 'champ__aide passage__compte', attrs: { dir: 'ltr' } });
  const paintCounter = () => {
    counter.textContent = `${state.text.length} / ${FREE_TEXT_MAX}`;
  };
  freeText.addEventListener('input', () => {
    state.text = freeText.value;
    paintCounter();
    save();
  });

  const freePanel = el('div', { class: 'passage__mode' }, field('texte-libre', t('Texte à analyser'), freeText), counter);

  // ------------------------------------------------------------------ sélecteur de mode

  const panels = { verset: versePanel, tarteel: tarteelPanel, libre: freePanel };
  const modeButtons = {
    verset: el('button', { class: 'segments__bouton', text: t('Verset'), attrs: { type: 'button' } }),
    tarteel: el('button', { class: 'segments__bouton', text: t('Tarteel'), attrs: { type: 'button' } }),
    libre: el('button', { class: 'segments__bouton', text: t('Texte libre'), attrs: { type: 'button' } }),
  };
  const modes = el('div', { class: 'segments', attrs: { role: 'group', 'aria-label': t('Mode de saisie') } }, Object.values(modeButtons));

  function showMode(mode) {
    state.mode = mode;
    for (const [name, button] of Object.entries(modeButtons)) button.setAttribute('aria-pressed', String(name === mode));
    for (const [name, panel] of Object.entries(panels)) panel.hidden = name !== mode;
    if (mode === 'verset') loadVerse();
    // Racines gardées pour l'onglet : la vérification part à la première ouverture du mode, sans attendre une frappe
    if (mode === 'tarteel' && !tarteelSynced) {
      tarteelSynced = true;
      probe.input(state.primary, state.constraint);
      probe.flush();
    }
  }

  for (const [name, button] of Object.entries(modeButtons)) {
    button.addEventListener('click', () => {
      showMode(name);
      save();
    });
  }

  // ------------------------------------------------------------------ langue de la réponse, modèle

  // La langue de la réponse suit celle de l'interface tant que le visiteur ne l'a pas changée
  const languageSelect = el('select', { class: 'saisie saisie--langues', attrs: { id: 'langue-reponse' } });
  for (const entry of languages()) add(languageSelect, el('option', { text: entry.label, attrs: { value: entry.code } }));
  languageSelect.value = responseLanguage(languages(), state.language, currentLang()).code;
  languageSelect.addEventListener('change', () => {
    state.language = languageSelect.value;
    save();
  });

  // Le menu du modèle n'apparaît que si la liste est venue : sans lui, le modèle par défaut du moteur sert
  const modelsLatest = createLatest();
  let menu = null;
  const modelSelect = el('select', { class: 'saisie saisie--serree', attrs: { id: 'modele' } });
  const modelField = field('modele', t('Modèle Gemini'), el('div', { class: 'choix' }, modelSelect, icon('chevron')));
  modelField.hidden = true;
  // Un nom plus long que le champ se lit en entier au survol, et dans la liste ouverte
  const nameModel = () => {
    modelSelect.title = modelSelect.selectedOptions.length ? modelSelect.selectedOptions[0].textContent : '';
  };
  modelSelect.addEventListener('change', () => {
    store.setModel(modelSelect.value);
    nameModel();
  });

  function showModels(next) {
    menu = next;
    modelField.hidden = !menu;
    clear(modelSelect);
    if (menu) {
      for (const name of menu.models) {
        add(modelSelect, el('option', { text: name === menu.defaultModel ? `${name} (${t('par défaut')})` : name, attrs: { value: name } }));
      }
      modelSelect.value = menu.selected;
    }
    nameModel();
  }

  // La liste dépend de la clé en service : elle est relue à chaque changement d'accès
  async function loadModels() {
    const token = modelsLatest.next();
    const credentials = store.credentials();
    if (!credentials.key && !credentials.devPassword) {
      showModels(null);
      return;
    }
    try {
      const data = await api.models(credentials);
      if (modelsLatest.isCurrent(token)) showModels(modelMenu(data, store.getModel()));
    } catch {
      if (modelsLatest.isCurrent(token)) showModels(null);
    }
  }

  // ------------------------------------------------------------------ lancement, état de la clé

  const launchButton = el('button', { class: 'bouton bouton--large', attrs: { type: 'submit' } }, el('span', { text: t('Analyser le passage') }), icon('arrow'));
  const accessText = el('span', { class: 'passage__cle-etat' });
  const access = el('div', { class: 'passage__cle' }, accessText,
    el('button', { class: 'bouton-lien', text: t('Gérer'), attrs: { type: 'button' }, on: { click: () => onManageKey() } }));

  const form = el('form', { class: 'passage carte', attrs: { novalidate: true } },
    modes,
    versePanel,
    tarteelPanel,
    freePanel,
    el('div', { class: 'passage__options' },
      field('langue-reponse', t('Langue de la réponse'), el('div', { class: 'choix' }, languageSelect, icon('chevron'))),
      modelField),
    launchButton,
    access);
  fill(container, form);

  // Ce qui part à l'analyse dans le mode en cours ; null quand il n'y a rien à envoyer
  function currentPassage() {
    if (state.mode === 'verset') return verseText ? { mode: 'verset', sura: state.sura, start: state.start, end: state.end, text: verseText } : null;
    if (state.mode === 'tarteel') {
      const cluster = probe.passage();
      return cluster ? { mode: 'tarteel', ...cluster } : null;
    }
    return state.text.trim() ? { mode: 'libre', text: state.text } : null;
  }

  // Rien à envoyer : l'attention va à ce qui manque
  function showWhatIsMissing() {
    if (state.mode === 'verset') {
      verse.scrollIntoView({ block: 'nearest' });
    } else if (state.mode === 'tarteel') {
      probe.flush(); // la saisie vient de changer : la vérification part tout de suite
      if (probe.view().step === 'pret' && clusterUi) {
        // Le cluster est à l'écran, mais aucun verset n'est coché
        clusterUi.hint.hidden = false;
        clusterBox.scrollIntoView({ block: 'nearest' });
        clusterUi.first.focus({ preventScroll: true });
      } else {
        signal.scrollIntoView({ block: 'nearest' });
        primary.focus({ preventScroll: true });
      }
    } else {
      freeText.focus();
    }
  }

  // Lance l'analyse de ce que le formulaire montre : le bouton, la touche Entrée, et « Réessayer »
  function submit() {
    if (disabled) return;
    const passage = currentPassage();
    if (passage) onLaunch(passage);
    else showWhatIsMissing();
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submit();
  });

  paintVerseFields();
  primary.value = state.primary;
  constraint.value = state.constraint;
  freeText.value = state.text;
  paintCounter();
  showMode(state.mode);
  if (asked) save();

  return {
    // Pendant une analyse, le formulaire est verrouillé
    setDisabled(value) {
      disabled = Boolean(value);
      for (const control of form.querySelectorAll('select, input, textarea, .segments__bouton, .cluster__outil, button[type="submit"]')) control.disabled = disabled;
    },
    // Relance le formulaire tel qu'il est (« Réessayer » après un lancement en échec)
    submit,
    // Langue de la réponse et modèle, pour la demande (lib/request.js)
    options: () => ({
      language: responseLanguage(languages(), state.language, currentLang()).label,
      model: menu ? modelSelect.value : null,
      defaultModel: menu ? menu.defaultModel : null,
    }),
    // État de la clé, sous le bouton : 'absente', 'presente' ou 'dev'. La liste des modèles en dépend.
    setAccess(status, remembered) {
      const labels = {
        absente: t('Aucune clé API : elle vous sera demandée.'),
        presente: remembered ? t('Clé API gardée sur cet appareil.') : t('Clé API gardée pour cet onglet.'),
        dev: td('Mode Développeur : API Interne Connectée.'),
      };
      fill(accessText, icon(status === 'absente' ? 'key' : 'check', 16), el('span', { text: labels[status] || labels.absente }));
      access.dataset.etat = status;
      loadModels();
    },
  };
}
