// Fenêtre « Clé API » : la clé Gemini du visiteur et, plus discret, l'accès développeur.
// La clé enregistrée n'est jamais réaffichée. Par défaut elle reste dans l'onglet ; la case la garde sur l'appareil.
import { describeFailure } from '../lib/failures.js';
import { openDialog } from './dialog.js';
import { clear, el } from './dom.js';
import { icon } from './icons.js';
import { t, td, tm } from './i18n-dom.js';

const KEY_PAGE = 'https://aistudio.google.com/app/apikey';
const TUTORIAL = 'https://youtu.be/t0v_FDAsmaY';

function externalLink(href, text) {
  return el('a', { class: 'cle__lien', attrs: { href, target: '_blank', rel: 'noopener noreferrer' } }, el('span', { text }), icon('external', 16));
}

function alertBox() {
  return el('p', { class: 'message message--erreur', attrs: { role: 'alert', hidden: true } });
}

function show(box, text) {
  box.textContent = text;
  box.hidden = !text;
}

// store : lib/store.js ; api : assets/js/api.js ; onChange : appelé quand la clé ou le mode développeur change
export function openKeyDialog({ store, api, onChange }) {
  const { body, close } = openDialog(t('Clé API'), { className: 'fenetre--cle' });
  const changed = () => {
    if (onChange) onChange();
  };

  function keySection() {
    const input = el('input', {
      class: 'saisie',
      attrs: {
        id: 'cle-saisie', type: 'password', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
        placeholder: t('Insérez votre clé API Google Gemini ici...'),
      },
    });
    const reveal = el('button', { class: 'bouton-bord', text: t('Afficher'), attrs: { type: 'button', 'aria-pressed': 'false' } });
    reveal.addEventListener('click', () => {
      const visible = input.type === 'password';
      input.type = visible ? 'text' : 'password';
      reveal.textContent = visible ? t('Masquer') : t('Afficher');
      reveal.setAttribute('aria-pressed', String(visible));
    });
    const remember = el('input', { attrs: { type: 'checkbox', id: 'cle-garder' } });
    remember.checked = store.keyIsRemembered();
    const error = alertBox();
    const hasKey = Boolean(store.getKey());

    const form = el('form', { class: 'cle__formulaire', attrs: { novalidate: true } },
      el('div', { class: 'champ' },
        el('label', { class: 'champ__etiquette', text: t('Clé API Google Gemini'), attrs: { for: 'cle-saisie' } }),
        el('div', { class: 'cle__saisie' }, input, reveal)),
      el('label', { class: 'case', attrs: { for: 'cle-garder' } }, remember, el('span', { text: t('Garder la clé sur cet appareil') })),
      el('p', { class: 'champ__aide', text: t('Sans cette case, la clé est oubliée à la fermeture de l’onglet.') }),
      error,
      el('div', { class: 'cle__actions' },
        el('button', { class: 'bouton', text: t('Enregistrer'), attrs: { type: 'submit' } }),
        hasKey ? el('button', {
          class: 'bouton-bord',
          text: t('Oublier la clé'),
          attrs: { type: 'button' },
          on: {
            click: () => {
              store.forgetKey();
              changed();
              render();
            },
          },
        }) : null),
    );
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      // Champ vide alors qu'une clé existe : seule la case change (garder ou non sur l'appareil)
      const value = input.value.trim() ? input.value : store.getKey();
      if (!store.setKey(value, { remember: remember.checked })) {
        show(error, t('Cette clé n’est pas valable : elle ne doit contenir ni espace ni caractère accentué.'));
        input.focus();
        return;
      }
      changed();
      close();
    });

    let status = t('En attente de la clé pour autoriser la compilation.');
    if (hasKey) {
      status = `${t('Noyau déverrouillé. Systèmes prêts.')} ${store.keyIsRemembered() ? t('Clé gardée sur cet appareil.') : t('Clé gardée pour cet onglet.')}`;
    }
    return [
      el('p', { class: 'texte-auteur' }, tm("**Mode Public :** L'analyse nécessite l'injection de la matrice complète en mémoire. Clé API requise (non sauvegardée). Un compte AI Studio (Pay-As-You-Go) est impératif.")),
      el('p', { class: 'texte-auteur', text: t('Le système scannera le verset et injectera la base compressée en mémoire tampon pour optimiser le protocole et réduire la latence.') }),
      el('p', { class: `message ${hasKey ? 'message--reussite' : 'message--attention'}`, text: status, attrs: { role: 'status' } }),
      form,
      el('div', { class: 'cle__liens' },
        externalLink(KEY_PAGE, t('Obtenir une clé API (Google AI Studio)')),
        externalLink(TUTORIAL, t('Tutoriel : Comment obtenir sa clé API'))),
    ];
  }

  function developerSection() {
    if (store.getDevPassword()) {
      return el('div', { class: 'cle__dev' },
        el('p', { class: 'message message--reussite', text: t('Mode Développeur : API Interne Connectée.'), attrs: { role: 'status' } }),
        el('button', {
          class: 'bouton-bord',
          text: t('Quitter le mode développeur'),
          attrs: { type: 'button' },
          on: {
            click: () => {
              store.clearDevPassword();
              changed();
              render();
            },
          },
        }));
    }
    const password = el('input', { class: 'saisie', attrs: { id: 'cle-dev', type: 'password', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' } });
    const error = alertBox();
    const submit = el('button', { class: 'bouton-bord', text: t('Valider'), attrs: { type: 'submit' } });
    const form = el('form', { class: 'cle__formulaire', attrs: { novalidate: true, hidden: true } },
      el('div', { class: 'champ' },
        el('label', { class: 'champ__etiquette', text: t('Mot de passe développeur'), attrs: { for: 'cle-dev' } }),
        el('div', { class: 'cle__saisie' }, password, submit)),
      error);
    const toggle = el('button', { class: 'bouton-lien', text: t('Accès développeur'), attrs: { type: 'button', 'aria-expanded': 'false' } });
    toggle.addEventListener('click', () => {
      form.hidden = !form.hidden;
      toggle.setAttribute('aria-expanded', String(!form.hidden));
      if (!form.hidden) password.focus();
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!password.value) return;
      submit.disabled = true;
      show(error, '');
      try {
        // Le serveur vérifie d'abord ; le mot de passe n'est gardé (pour l'onglet seulement) que s'il est accepté
        await api.devMode(password.value);
        if (!store.setDevPassword(password.value)) {
          show(error, t('Cette clé ou ce mot de passe contient un caractère que le navigateur ne peut pas transmettre.'));
          return;
        }
        changed();
        close();
      } catch (failure) {
        const refused = failure && failure.kind === 'http' && failure.status === 401;
        show(error, refused ? t('Mot de passe développeur refusé.') : td(describeFailure(failure).text));
      } finally {
        submit.disabled = false;
      }
    });
    return el('div', { class: 'cle__dev' }, toggle, form);
  }

  function render() {
    clear(body).append(...keySection(), developerSection());
  }

  render();
  // Le visiteur vient saisir sa clé : le champ reçoit le focus, sauf si un accès est déjà en place
  if (!store.getKey() && !store.getDevPassword()) body.querySelector('#cle-saisie').focus();
}
