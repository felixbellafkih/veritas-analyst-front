// Ce que la vérification d'une saisie Tarteel annonce (lib/tarteel-probe.js), dit au visiteur.
// Module partagé par l'Interpréteur (mode Tarteel) et par la page Tarteel : les deux disent la même chose
// du même signal. La liste des versets elle-même est bâtie par ui/cluster-list.js.
import { ApiFailure, describeFailure } from '../lib/failures.js';
import { parseMarkdown } from '../lib/markdown.js';
import { el } from './dom.js';
import { t, td } from './i18n-dom.js';
import { renderBlocks } from './markdown-view.js';

function message(kind, text) {
  return el('p', { class: `message message--${kind}`, text, attrs: { dir: 'auto' } });
}

function failure(found, onRetry) {
  return [
    // Fréquences de forme inattendue (échec absent) : le message est celui d'une erreur du serveur
    message('erreur', td(describeFailure(found || new ApiFailure('http')).text)),
    el('button', { class: 'bouton-lien', text: t('Réessayer'), attrs: { type: 'button' }, on: { click: () => onRetry() } }),
  ];
}

// Le signal, sous les deux champs : rien (pas de racine), la recherche en cours, l'échec des fréquences,
// aucune occurrence, ou le nombre d'occurrences. Plus de plafond : dès une occurrence, le signal est pur.
export function signalNodes(view, onRetry) {
  if (view.step === 'vide') return null;
  if (view.step === 'attente') return el('p', { class: 'champ__aide', text: t('Recherche des occurrences…') });
  if (view.step === 'echec' && view.stage === 'frequences') return failure(view.failure, onRetry);
  if (view.step === 'signal') {
    return message('erreur', t("Aucune occurrence détectée (0 résultat). Assurez-vous d'avoir introduit une racine valide. Ex : S-M-W  س م و | D.-R-B ض ر ب | DH-K-R ذ ك ر  | A.-B-D ع ب د"));
  }
  return message('reussite', t('Signal pur ({n} occurrences triangulées).', { n: view.count }));
}

// Sous le signal, à la place de la liste des versets tant qu'elle n'est pas là : la lecture en cours, un
// message du Kernel, aucun verset, ou l'échec de la lecture. Rend null quand il n'y a rien à dire (et pour
// l'étape « pret », où la page bâtit la liste).
export function clusterNodes(view, onRetry) {
  if (view.step === 'lecture') return el('p', { class: 'champ__aide', text: t('Chargement du texte…') });
  if (view.step === 'message') return message('erreur', td(view.text));
  if (view.step === 'absent') return message('erreur', t('Zéro occurrence matérielle trouvée pour cette triangulation.'));
  if (view.step === 'echec' && view.stage === 'cluster') return failure(view.failure, onRetry);
  return null;
}

// Le texte d'aide de l'auteur, au-dessus des deux champs
export function tarteelHelp() {
  return el('div', { class: 'texte-auteur tarteel__aide' }, renderBlocks(parseMarkdown(t("Module d'extraction par triangulation. Pour isoler un sujet lié à une racine à haute fréquence, croisez avec une racine de contrainte ou un Tasreef précis afin d'éviter la saturation du processeur IA (Buffer Overflow).\n\n💡 **Support Bi-directionnel :** Saisie acceptée en **Arabe** (ex: ض ر ب) ou en **Latin**.\n*Rappel Latin (Emphatiques) :* `A.` (ع) | `H.` (ح) | `S.` (ص) | `D.` (ض) | `T.` (ط) | `Z.` (ظ)")), { ids: false }));
}
