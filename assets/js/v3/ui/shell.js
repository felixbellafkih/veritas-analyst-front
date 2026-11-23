// Socle commun à toutes les pages : en-tête, menu, barre d'onglets du téléphone, pied de page.
import { CLASSIC_URL } from '../lib/config.js';
import { menuDestinations, moreDestinations, tabDestinations } from '../lib/destinations.js';
import { htmlLang, tx } from '../lib/i18n.js';
import { add, clear, el, fill } from './dom.js';
import { openDialog } from './dialog.js';
import { icon, logo } from './icons.js';
import { currentLang, interfaceLanguages, languageLabel, setLanguage, t, td } from './i18n-dom.js';

const HOME = '/accueil/';
const PAGE_TITLES = { accueil: tx('Accueil'), interpreteur: tx('Interpréteur'), scanner: tx('Scanner'), sequenceur: tx('Séquenceur'), tarteel: tx('Tarteel') };
const THEME_EVENT = 'veritas:theme';

// Le corpus a une page française et une page anglaise
const hrefOf = (destination) => (destination.hrefOther && currentLang() !== 'fr' ? destination.hrefOther : destination.href);
const isNight = () => document.documentElement.dataset.theme !== 'jour';

function toggleTheme(store) {
  const next = isNight() ? 'jour' : 'nuit';
  document.documentElement.dataset.theme = next;
  store.setTheme(next);
  document.dispatchEvent(new CustomEvent(THEME_EVENT));
}

function themeButton(store) {
  const button = el('button', { class: 'bouton-bord bouton-bord--icone bouton-theme', attrs: { type: 'button' }, on: { click: () => toggleTheme(store) } });
  const paint = () => {
    fill(button, icon(isNight() ? 'sun' : 'moon'));
    button.setAttribute('aria-label', isNight() ? t('Passer au thème clair') : t('Passer au thème sombre'));
  };
  document.addEventListener(THEME_EVENT, paint);
  paint();
  return button;
}

function openLanguageMenu() {
  const { body, close } = openDialog(t('Langue de l’interface'));
  const all = interfaceLanguages();
  const list = el('ul', { class: 'liste-choix' });
  const paint = (filter) => {
    clear(list);
    for (const entry of all) {
      if (filter && !entry.label.toLowerCase().includes(filter) && !entry.code.toLowerCase().includes(filter)) continue;
      const selected = entry.code === currentLang();
      const choose = () => {
        close();
        if (!selected) setLanguage(entry.code);
      };
      add(list, el('li', {}, el('button', {
        class: 'liste-choix__bouton',
        attrs: { type: 'button', lang: htmlLang(entry.code), 'aria-current': selected ? 'true' : null },
        on: { click: choose },
      }, el('span', { text: entry.label }), selected ? icon('check') : null)));
    }
  };
  // Le champ de recherche n'apparaît que si la liste est longue
  if (all.length > 8) {
    const search = el('input', { class: 'saisie', attrs: { type: 'search', 'aria-label': t('Rechercher une langue'), placeholder: t('Rechercher une langue'), autocomplete: 'off' } });
    search.addEventListener('input', () => paint(search.value.trim().toLowerCase()));
    add(body, search);
  }
  paint('');
  add(body, list);
}

function classicLink(className) {
  return el('a', { class: className, attrs: { href: CLASSIC_URL, target: '_blank', rel: 'noopener' } },
    el('span', { text: t('Version classique') }), icon('external', 16));
}

// « Plus », au téléphone : les destinations que la barre d'onglets ne porte pas, puis ce que la barre du
// haut ne peut pas porter
function openMore(store, page) {
  const { body, close } = openDialog(t('Plus'));
  const theme = el('button', { class: 'liste-choix__bouton', attrs: { type: 'button' } });
  const paint = () => {
    fill(theme, el('span', { text: isNight() ? t('Passer au thème clair') : t('Passer au thème sombre') }), icon(isNight() ? 'sun' : 'moon'));
  };
  theme.addEventListener('click', () => {
    toggleTheme(store);
    paint();
  });
  paint();
  add(body, el('ul', { class: 'liste-choix' },
    moreDestinations().map((destination) => el('li', {}, el('a', {
      class: 'liste-choix__bouton',
      attrs: { href: hrefOf(destination), 'aria-current': destination.id === page ? 'page' : null },
      on: { click: close },
    }, el('span', { text: td(destination.label) }), icon(destination.icon)))),
    el('li', {}, theme),
    el('li', {}, classicLink('liste-choix__bouton')),
    el('li', {}, el('a', { class: 'liste-choix__bouton', attrs: { href: '/legal.html' }, on: { click: close } }, el('span', { text: t('Mentions légales') }))),
  ));
}

// Essai en local seulement (localApi vaut 'reel' ou 'faux') : dire sur chaque page quelle API répond. Avec
// le faux serveur, les analyses affichées sont des textes enregistrés : il ne faut pas les prendre pour
// de vraies analyses. Ces deux phrases ne s'affichent jamais en ligne : elles ne sont pas traduites.
function localBanner(localApi) {
  const real = localApi === 'reel';
  const other = new URL(window.location.href);
  other.searchParams.set('api', real ? 'faux' : 'reel');
  return el('div', { class: `bandeau-local${real ? ' bandeau-local--reel' : ''}`, attrs: { role: 'note' } },
    el('span', { text: real
      ? 'Essai local — vraie API : les analyses sont réelles, et facturées sur votre clé.'
      : 'Essai local — faux serveur : les analyses affichées sont des textes enregistrés, pas de vraies analyses.' }),
    el('a', { text: real ? 'Revenir au faux serveur' : 'Passer à la vraie API', attrs: { href: `${other.pathname}${other.search}` } }));
}

export function mountShell({ page, store, onKeyClick, localApi = null }) {
  if (localApi) document.body.insertBefore(localBanner(localApi), document.body.firstChild);

  // ---- en-tête. Le bouton de la langue n'apparaît que si l'interface existe dans une autre langue que le français.
  const languageButton = el('button', {
    class: 'bouton-bord bouton-langue',
    attrs: { type: 'button', 'aria-haspopup': 'dialog', 'aria-label': `${t('Langue de l’interface')} : ${languageLabel(currentLang())}`, hidden: interfaceLanguages().length < 2 },
    on: { click: openLanguageMenu },
  }, icon('globe'), el('span', { class: 'bouton-bord__texte', text: languageLabel(currentLang()) }));

  const keyLabel = el('span', { class: 'bouton-bord__texte' });
  const keyButton = el('button', {
    class: 'bouton-bord bouton-cle',
    attrs: { type: 'button', 'aria-haspopup': 'dialog' },
    on: { click: () => onKeyClick && onKeyClick() },
  }, icon('key'), keyLabel, el('span', { class: 'temoin' }));

  const menu = el('nav', { class: 'menu', attrs: { 'aria-label': t('Outils') } });
  for (const destination of menuDestinations()) {
    add(menu, el('a', {
      class: 'menu__lien',
      text: td(destination.label),
      attrs: { href: hrefOf(destination), 'aria-current': destination.id === page ? 'page' : null },
    }));
  }
  add(menu, classicLink('menu__lien menu__lien--classique'));

  fill(document.getElementById('entete'), el('div', { class: 'entete__dans' },
    el('a', { class: 'marque', attrs: { href: HOME, 'aria-label': `VERITAS ANALYST — ${t('Accueil')}`, 'aria-current': page === 'accueil' ? 'page' : null } },
      logo(), el('span', { class: 'marque__nom', text: 'VERITAS ANALYST' })),
    el('span', { class: 'entete__titre', text: td(PAGE_TITLES[page] || ''), attrs: { 'aria-hidden': 'true' } }),
    menu,
    el('div', { class: 'outils' }, languageButton, themeButton(store), keyButton),
  ));

  // ---- barre d'onglets du téléphone
  const tabs = clear(document.getElementById('onglets'));
  tabs.setAttribute('aria-label', t('Outils'));
  for (const destination of tabDestinations()) {
    add(tabs, el('a', {
      class: 'onglets__lien',
      attrs: { href: hrefOf(destination), 'aria-current': destination.id === page ? 'page' : null },
    }, icon(destination.icon, 22), el('span', { text: td(destination.label) })));
  }
  add(tabs, el('button', { class: 'onglets__lien', attrs: { type: 'button', 'aria-haspopup': 'dialog' }, on: { click: () => openMore(store, page) } },
    icon('more', 22), el('span', { text: t('Plus') })));

  // ---- pied de page
  fill(document.getElementById('pied'), el('div', { class: 'pied__dans' },
    el('nav', { class: 'pied__liens', attrs: { 'aria-label': t('Liens du site') } },
      el('a', { text: 'Corpus public', attrs: { href: '/corpus/', lang: 'fr' } }),
      el('a', { text: 'Public corpus', attrs: { href: '/en/corpus/', lang: 'en' } }),
      el('a', { text: t('Mentions légales'), attrs: { href: '/legal.html' } })),
    el('span', { text: 'VERITAS ANALYST' }),
  ));

  function setKeyStatus(status) {
    keyButton.dataset.etat = status;
    keyLabel.textContent = status === 'dev' ? t('Mode développeur') : t('Clé API');
    const label = { absente: t('Clé API : aucune clé enregistrée'), presente: t('Clé API enregistrée'), dev: t('Mode développeur actif') }[status];
    keyButton.setAttribute('aria-label', label || t('Clé API'));
  }
  setKeyStatus('absente');

  return {
    setKeyStatus,
    // Pendant une analyse, la langue ne se change pas : la page se rechargerait
    setBusy(busy) {
      languageButton.disabled = Boolean(busy);
    },
  };
}
