// Champ de recherche du Scanner : une racine (code latin ou lettres arabes) ou un mot complexe.
// Pendant la frappe, des suggestions tirées de la liste des racines livrée par le site ; sans cette liste,
// le champ marche quand même, sans suggestions. Le clavier suit l'usage d'une liste de suggestions :
// flèches pour parcourir, Entrée pour choisir ou lancer la recherche, Échap pour fermer.
import { searchRoots } from '../lib/roots-index.js';
import { add, clear, el } from './dom.js';
import { icon } from './icons.js';
import { t } from './i18n-dom.js';

const QUERY_MAX = 100;

// onPick(saisie) : le visiteur lance une recherche, ou choisit une suggestion
export function mountRootSearch(container, { onPick }) {
  let index = [];
  let shown = [];   // suggestions affichées
  let active = -1;  // rang de la suggestion sous le curseur du clavier

  const input = el('input', {
    class: 'saisie',
    attrs: {
      id: 'scanner-saisie', type: 'text', maxlength: QUERY_MAX, dir: 'auto', role: 'combobox',
      autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
      'aria-autocomplete': 'list', 'aria-controls': 'scanner-suggestions', 'aria-expanded': 'false',
      placeholder: 'S-M-W · س م و · بِسْمِ',
    },
  });
  const list = el('ul', { class: 'suggestions', attrs: { id: 'scanner-suggestions', role: 'listbox', hidden: true, 'aria-label': t('Suggestions') } });
  const form = el('form', { class: 'recherche', attrs: { role: 'search', novalidate: true } },
    el('label', { class: 'champ__etiquette', text: t('TYPE SIGNAL (ROOT OR COMPLEX WORD)'), attrs: { for: 'scanner-saisie' } }),
    el('div', { class: 'recherche__ligne' },
      el('div', { class: 'recherche__champ' }, input, list),
      el('button', { class: 'bouton', attrs: { type: 'submit' } }, el('span', { text: t('Scanner') }), icon('search', 18))));

  function close() {
    shown = [];
    active = -1;
    clear(list);
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }

  function mark() {
    [...list.children].forEach((item, position) => item.setAttribute('aria-selected', String(position === active)));
    if (active >= 0) {
      input.setAttribute('aria-activedescendant', `scanner-suggestion-${active}`);
      list.children[active].scrollIntoView({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  function suggest() {
    shown = searchRoots(index, input.value);
    active = -1;
    clear(list);
    if (!shown.length) {
      close();
      return;
    }
    shown.forEach((entry, position) => {
      const item = el('li', { class: 'suggestions__ligne', attrs: { id: `scanner-suggestion-${position}`, role: 'option', 'aria-selected': 'false' } },
        el('span', { class: 'suggestions__code', text: entry.code, attrs: { dir: 'ltr' } }),
        el('span', { class: 'suggestions__arabe', text: entry.arabic, attrs: { lang: 'ar', dir: 'rtl' } }),
        el('span', { class: 'suggestions__fonction', text: entry.logic, attrs: { dir: 'ltr' } }));
      // Appuyer sur une suggestion ne retire pas le curseur du champ (mousedown neutralisé). Le choix se
      // fait au clic, et non dès que le doigt se pose : sur un téléphone, faire défiler la liste ne choisit rien.
      item.addEventListener('mousedown', (event) => event.preventDefault());
      item.addEventListener('click', () => pick(entry.code));
      add(list, item);
    });
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function pick(query) {
    const wanted = String(query ?? '').trim().slice(0, QUERY_MAX);
    close();
    if (!wanted) {
      input.focus();
      return;
    }
    input.value = wanted;
    onPick(wanted);
  }

  input.addEventListener('input', suggest);
  input.addEventListener('blur', close);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      close();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!shown.length) {
        if (event.key === 'ArrowDown') suggest();
        return;
      }
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      // de -1 (le champ lui-même) à la dernière suggestion, en boucle
      active = ((active + 1 + step + shown.length + 1) % (shown.length + 1)) - 1;
      mark();
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault();
      pick(shown[active].code);
    }
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    pick(input.value);
  });

  add(container, form);

  return {
    // La liste des racines est arrivée (ou non) : les suggestions s'appuient sur elle
    setIndex(next) {
      index = Array.isArray(next) ? next : [];
    },
    // La recherche affichée, écrite dans le champ (adresse de la page, lien d'une fiche)
    setValue(query) {
      input.value = String(query ?? '');
      close();
    },
    focus: () => input.focus(),
  };
}
