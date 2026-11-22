// « Toutes les racines », sous la recherche du Scanner : la liste livrée par le site, avec un filtre.
// Elle s'affiche par tranches : près de deux mille lignes d'un coup alourdiraient la page sur téléphone.
import { filterRoots, scannerHref } from '../lib/roots-index.js';
import { add, clear, el, fill } from './dom.js';
import { t } from './i18n-dom.js';

const SLICE = 100;
// Les nombres s'écrivent à la manière de la langue affichée (« 1 994 » en français)
const number = (value) => value.toLocaleString(document.documentElement.lang || 'fr');

// onOpen(code) : ouvrir la fiche d'une racine sans recharger la page
export function mountRootList(container, { onOpen }) {
  let index = [];
  let found = [];
  let shown = 0;

  const count = el('p', { class: 'champ__aide', attrs: { role: 'status' } });
  const filter = el('input', { class: 'saisie', attrs: { id: 'racines-filtre', type: 'search', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', dir: 'auto', maxlength: 100 } });
  const list = el('ul', { class: 'racines__liste' });
  const more = el('button', { class: 'bouton-bord', text: t('Afficher la suite'), attrs: { type: 'button', hidden: true } });

  function row(entry) {
    const link = el('a', { class: 'racines__ligne', attrs: { href: scannerHref(entry.code) } },
      el('span', { class: 'racines__code', text: entry.code, attrs: { dir: 'ltr' } }),
      el('span', { class: 'racines__arabe', text: entry.arabic, attrs: { lang: 'ar', dir: 'rtl' } }),
      el('span', { class: 'racines__fonction', text: entry.logic, attrs: { lang: 'fr', dir: 'ltr' } }));
    link.addEventListener('click', (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      onOpen(entry.code);
    });
    return el('li', {}, link);
  }

  function showMore() {
    const next = found.slice(shown, shown + SLICE);
    for (const entry of next) add(list, row(entry));
    shown += next.length;
    more.hidden = shown >= found.length;
  }

  function paint() {
    found = filterRoots(index, filter.value);
    shown = 0;
    clear(list);
    count.textContent = filter.value.trim()
      ? t('{n} racines sur {total}', { n: number(found.length), total: number(index.length) })
      : t('{n} racines', { n: number(index.length) });
    showMore();
  }

  filter.addEventListener('input', paint);
  more.addEventListener('click', showMore);

  container.hidden = true;
  fill(container,
    el('h2', { class: 'racines__titre', text: t('Toutes les racines') }),
    el('div', { class: 'champ' },
      el('label', { class: 'champ__etiquette', text: t('Filtrer les racines'), attrs: { for: 'racines-filtre' } }),
      filter),
    count,
    list,
    more);

  let wanted = true; // faux pendant qu'une fiche est ouverte

  return {
    // La liste des racines est arrivée : sans elle, cette partie de la page reste absente
    setIndex(next) {
      index = Array.isArray(next) ? next : [];
      container.hidden = !wanted || !index.length;
      paint();
    },
    // Une fiche ouverte prend la place de la liste
    setHidden(hidden) {
      wanted = !hidden;
      container.hidden = hidden || !index.length;
    },
  };
}
