// Fenêtre de l'interface, bâtie sur <dialog> : le navigateur y retient le focus.
import { el } from './dom.js';
import { icon } from './icons.js';
import { t } from './i18n-dom.js';

// Ouvre une fenêtre et rend { dialog, body, close }. À la fermeture (bouton, touche Échap, clic sur le
// voile), la fenêtre est retirée de la page et le focus revient à l'élément qui l'avait ouverte.
// La fermeture ne compte pas sur l'événement « close » du navigateur : certains ne l'émettent qu'au
// prochain affichage, voire jamais quand la page n'est pas visible.
export function openDialog(title, { className = '', onClose = null } = {}) {
  const opener = document.activeElement;
  const dialog = el('dialog', { class: `fenetre ${className}`.trim() });
  const heading = el('h2', { class: 'fenetre__titre', text: title });
  const closeButton = el('button', { class: 'fenetre__fermer', attrs: { type: 'button', 'aria-label': t('Fermer') } }, icon('close', 20));
  const body = el('div', { class: 'fenetre__corps' });
  dialog.append(el('div', { class: 'fenetre__dans' }, el('div', { class: 'fenetre__tete' }, heading, closeButton), body));

  let closed = false;
  // Échap ferme la fenêtre, où que soit le focus (y compris hors de la fenêtre, sur la page)
  function onKey(event) {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    event.preventDefault();
    close();
  }
  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey, true);
    if (dialog.open) dialog.close();
    dialog.remove();
    if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus();
    if (onClose) onClose();
  }

  closeButton.addEventListener('click', close);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close(); // clic sur le voile, hors de la fenêtre
  });
  document.addEventListener('keydown', onKey, true);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener('close', close);

  document.body.append(dialog);
  dialog.showModal();
  return { dialog, body, close };
}
