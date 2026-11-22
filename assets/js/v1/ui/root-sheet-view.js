// Fiche d'une racine, sur la page du Scanner : ce que l'app actuelle montre dans son mode ROOT SCANNER.
// Le contenu du LEXICON (définition, équation, dérivations, libellés de décompilation) est affiché tel que
// l'API le rend, en français, comme du texte : il porte lang="fr" et se lit de gauche à droite quelle que
// soit la langue de l'interface.
import { describeReadFailure } from '../lib/failures.js';
import { scannerHref } from '../lib/roots-index.js';
import { clear, el, fill } from './dom.js';
import { icon } from './icons.js';
import { currentLang, t, td } from './i18n-dom.js';

// Texte venu du LEXICON ou de l'API
const lex = (tag, className, text) => el(tag, { class: className, text, attrs: { lang: 'fr', dir: 'ltr' } });

// onOpen(saisie) : ouvrir une autre fiche (racine opposée) sans recharger la page
export function mountRootSheet(container, { onOpen }) {
  // Un lien vers une autre fiche : il marche comme un lien (nouvel onglet, copie de l'adresse), et un clic
  // simple ouvre la fiche sur place
  function sheetLink(code, className, children) {
    const link = el('a', { class: className, attrs: { href: scannerHref(code), dir: 'ltr' } }, children);
    link.addEventListener('click', (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      onOpen(code);
    });
    return link;
  }

  // Mot complexe ramené à sa racine : l'état, la connectique, les quantificateurs
  function decompilation(sheet) {
    const { signal, state, inputs, outputs, quantifiers } = sheet.decompiled;
    const group = (label, lines, none) => el('div', { class: 'decompilation__groupe' },
      el('p', { class: 'decompilation__titre', text: label }),
      lines.length ? lines.map((line) => lex('code', 'decompilation__code', line)) : el('p', { class: 'decompilation__rien', text: none }));
    return el('div', { class: 'decompilation carte' },
      el('p', { class: 'fiche__surtitre', text: t('DÉCOMPILATION SYSTÉMIQUE') }),
      el('p', { class: 'decompilation__phrase', text: t('Le signal {signal} a été réduit à sa racine matérielle fondamentale {root}.', { signal, root: sheet.code }), attrs: { dir: 'auto' } }),
      el('div', { class: 'decompilation__grille' },
        el('div', { class: 'decompilation__groupe' },
          el('p', { class: 'decompilation__titre', text: t('ÉTAT (TASREEF)') }),
          lex('code', 'decompilation__code', state.tag ? `${state.label} ${state.tag}` : state.label),
          state.note ? lex('p', 'decompilation__note', state.note) : null),
        group(t('CONNECTIQUE (I/O)'), [...inputs.map((line) => `IN : ${line}`), ...outputs.map((line) => `OUT : ${line}`)], t('AUCUNE FIXATION')),
        group(t('QUANTIFICATEURS'), quantifiers, t('SINGULIER'))));
  }

  function identity(sheet) {
    return el('div', { class: 'fiche__carte carte' },
      el('p', { class: 'fiche__arabe', text: sheet.arabic, attrs: { lang: 'ar', dir: 'rtl' } }),
      el('p', { class: 'fiche__code', text: sheet.code, attrs: { dir: 'ltr' } }),
      sheet.logic ? lex('p', 'fiche__fonction', sheet.logic) : null,
      sheet.opposites.length ? el('div', { class: 'fiche__opposees' },
        el('p', { class: 'fiche__surtitre', text: t('BINARY SWITCH') }),
        sheet.opposites.map((code) => sheetLink(code, 'bouton-bord', [el('span', { text: '⇄', attrs: { 'aria-hidden': 'true' } }), el('span', { text: code })]))) : null,
      el('a', { class: 'bouton-lien', attrs: { href: `/tarteel/?p=${encodeURIComponent(sheet.code)}` } },
        el('span', { text: t('Voir les versets de cette racine') }), icon('arrow', 16)));
  }

  function definition(sheet) {
    return el('div', { class: 'fiche__detail' },
      el('h2', { class: 'fiche__titre', text: t('SYSTEM DEFINITION') }),
      sheet.description ? lex('p', 'fiche__definition', sheet.description) : null,
      sheet.equation ? el('div', { class: 'fiche__equation' },
        el('p', { class: 'fiche__surtitre', text: t('Équation Physique') }),
        // Une tuile par lettre quand l'équation en a la forme ; l'équation entière suit dans tous les cas
        sheet.tiles ? el('div', { class: 'fiche__tuiles', attrs: { dir: 'rtl' } }, sheet.tiles.map((tile) => el('div', { class: 'fiche__tuile', attrs: { dir: 'ltr' } },
          el('span', { class: 'fiche__lettre', text: tile.letter, attrs: { lang: 'ar' } }),
          el('span', { class: 'fiche__latin', text: tile.code }),
          lex('span', 'fiche__charge', tile.charge)))) : null,
        lex('p', 'fiche__formule', sheet.equation)) : null,
      sheet.instances.length ? el('div', { class: 'fiche__derivations' },
        el('h3', { class: 'fiche__surtitre', text: t('Dérivations Morphologiques (Tasreef)') }),
        el('ul', { class: 'derivations' }, sheet.instances.map((instance) => el('li', { class: 'derivations__ligne' },
          el('span', { class: 'derivations__mot', text: instance.word, attrs: { lang: 'ar', dir: 'rtl' } }),
          instance.type ? lex('span', 'pastille pastille--code', instance.type) : null,
          instance.definition ? lex('p', 'derivations__sens', instance.definition) : null)))) : null);
  }

  return {
    showEmpty() {
      clear(container);
    },

    showWaiting() {
      fill(container, el('p', { class: 'champ__aide', text: t('Recherche en cours…'), attrs: { role: 'status' } }));
    },

    // sheet : lib/root-sheet.js
    showSheet(sheet) {
      fill(container,
        sheet.decompiled ? decompilation(sheet) : null,
        el('div', { class: 'fiche' }, identity(sheet), definition(sheet)),
        // L'interface est traduite, le contenu du LEXICON ne l'est pas : la page le dit hors du français
        currentLang() === 'fr' ? null : el('p', { class: 'champ__aide fiche__mention', text: t('Contenu du LEXICON en français.') }));
    },

    // La saisie ne correspond à aucune racine connue du serveur
    showUnknown(query) {
      fill(container, el('div', { class: 'message message--erreur', attrs: { role: 'alert' } },
        el('p', { class: 'message__titre', text: t('Ce signal ne correspond à aucune racine matérielle connue dans le registre.') }),
        el('p', { text: query, attrs: { dir: 'auto' } })));
    },

    showFailure(failure, onRetry) {
      fill(container, el('div', { class: 'message message--erreur', attrs: { role: 'alert' } },
        el('p', { class: 'message__titre', text: td(describeReadFailure(failure)) }),
        el('div', { class: 'message__actions' },
          el('button', { class: 'bouton-bord', text: t('Réessayer'), attrs: { type: 'button' }, on: { click: () => onRetry() } }))));
    },
  };
}
