// Garde-fou pendant une analyse : quitter la page la ferait perdre, alors qu'elle est facturée.
// - Fermeture de l'onglet ou rechargement : le navigateur prévient (événement beforeunload).
// - Lien qui remplacerait la page (menu, logo, barre d'onglets, pied de page) : le site demande lui-même
//   confirmation. Safari sur iPhone n'affiche pas l'avertissement du navigateur ; sans cela, un doigt posé
//   sur « Corpus » ferait perdre l'analyse sans un mot.
import { leavesPage } from '../lib/navigation.js';
import { openConfirm } from './dialog.js';
import { t } from './i18n-dom.js';

export function createLeaveGuard() {
  let active = false;
  let leaving = false; // le visiteur a confirmé son départ : plus aucune question
  let asking = false;

  function onBeforeUnload(event) {
    if (!active || leaving) return;
    event.preventDefault();
    event.returnValue = '';
  }

  async function onClick(event) {
    if (!active || leaving || asking || event.defaultPrevented) return;
    // Un clic qui ouvre un autre onglet (molette, Ctrl, Cmd, Maj) ne quitte pas la page
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!link) return;
    const described = { href: link.getAttribute('href'), target: link.getAttribute('target'), download: link.getAttribute('download') };
    if (!leavesPage(described, window.location.href)) return;
    event.preventDefault();
    asking = true;
    const confirmed = await openConfirm({
      title: t('Analyse en cours'),
      text: t('Une analyse est en cours, facturée sur votre clé. Quitter la page la ferait perdre.'),
      confirmLabel: t('Quitter la page'),
      cancelLabel: t('Rester sur la page'),
    });
    asking = false;
    if (!confirmed) return;
    leaving = true;
    window.location.assign(link.href);
  }

  window.addEventListener('beforeunload', onBeforeUnload);
  document.addEventListener('click', onClick, true);

  return {
    // Vrai pendant qu'une demande est en cours
    setActive(value) {
      active = Boolean(value);
    },
  };
}
