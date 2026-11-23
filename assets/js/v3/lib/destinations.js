// Les destinations du site, dans l'ordre du menu. Sans interface.
// - ready : la page existe. Une destination sans page n'apparaît nulle part.
// - tab : la destination a sa place dans la barre d'onglets du téléphone. Cette barre n'a que quatre places
//   pour les outils (cinq entrées avec « Plus » tiennent à 320 px, six non) ; les autres destinations vont
//   sous « Plus ». Le menu de l'ordinateur, lui, les porte toutes.
// Les noms sont ceux de l'app mobile.
import { tx } from './i18n.js';

export const DESTINATIONS = [
  { id: 'interpreteur', label: tx('Interpréteur'), href: '/interpreteur/', icon: 'book', ready: true, tab: true },
  { id: 'tarteel', label: tx('Tarteel'), href: '/tarteel/', icon: 'list', ready: true, tab: true },
  { id: 'sequenceur', label: tx('Séquenceur'), href: '/sequenceur/', icon: 'nodes', ready: true, tab: true },
  { id: 'scanner', label: tx('Scanner'), href: '/scanner/', icon: 'search', ready: true, tab: true },
  // Le corpus a une page française (href) et une page anglaise (hrefOther)
  { id: 'corpus', label: tx('Corpus'), href: '/corpus/', hrefOther: '/en/corpus/', icon: 'layers', ready: true, tab: false },
  { id: 'bibliotheque', label: tx('Bibliothèque'), href: '/bibliotheque/', icon: 'book', ready: false, tab: false },
];

// Menu de l'ordinateur : toutes les destinations qui ont leur page
export const menuDestinations = () => DESTINATIONS.filter((destination) => destination.ready);

// Barre d'onglets du téléphone : les outils
export const tabDestinations = () => menuDestinations().filter((destination) => destination.tab);

// Fenêtre « Plus » du téléphone : ce que la barre d'onglets ne porte pas
export const moreDestinations = () => menuDestinations().filter((destination) => !destination.tab);
