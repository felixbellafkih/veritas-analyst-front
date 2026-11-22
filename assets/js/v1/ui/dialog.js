// Fenêtre de l'interface, bâtie sur <dialog> : le navigateur y retient le focus.
import { add, el } from './dom.js';
import { icon } from './icons.js';
import { t } from './i18n-dom.js';

// Ouvre une fenêtre et rend { dialog, body, close }. À la fermeture (bouton, touche Échap, clic sur le
// voile), la fenêtre est retirée de la page et le focus revient à l'élément qui l'avait ouverte.
// La fermeture ne compte pas sur l'événement « close » du navigateur : certains ne l'émettent qu'au
// prochain affichage, voire jamais quand la page n'est pas visible.
let serial = 0;

export function openDialog(title, { className = '', onClose = null } = {}) {
  const opener = document.activeElement;
  serial += 1;
  // La fenêtre porte le nom de son titre : c'est lui que les lecteurs d'écran annoncent à l'ouverture
  const heading = el('h2', { class: 'fenetre__titre', text: title, attrs: { id: `fenetre-titre-${serial}` } });
  const dialog = el('dialog', { class: `fenetre ${className}`.trim(), attrs: { 'aria-labelledby': heading.id } });
  const closeButton = el('button', { class: 'fenetre__fermer', attrs: { type: 'button', 'aria-label': t('Fermer') } }, icon('close', 20));
  const body = el('div', { class: 'fenetre__corps' });
  add(dialog, el('div', { class: 'fenetre__dans' }, el('div', { class: 'fenetre__tete' }, heading, closeButton), body));

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

  add(document.body, dialog);
  dialog.showModal();
  return { dialog, body, close };
}

// Question à deux réponses, avant un geste qui ferait perdre quelque chose. Rend une promesse : vrai si le
// visiteur confirme. Fermer la fenêtre (bouton, Échap, clic sur le voile) vaut refus, et c'est le refus
// qui reçoit le focus à l'ouverture.
export function openConfirm({ title, text, confirmLabel, cancelLabel }) {
  return new Promise((resolve) => {
    let confirmed = false;
    const { body, close } = openDialog(title, { className: 'fenetre--question', onClose: () => resolve(confirmed) });
    const cancel = el('button', { class: 'bouton-bord', text: cancelLabel, attrs: { type: 'button' }, on: { click: () => close() } });
    const confirm = el('button', {
      class: 'bouton',
      text: confirmLabel,
      attrs: { type: 'button' },
      on: {
        click: () => {
          confirmed = true;
          close();
        },
      },
    });
    add(body, el('p', { text }), el('div', { class: 'fenetre__actions' }, cancel, confirm));
    cancel.focus();
  });
}
