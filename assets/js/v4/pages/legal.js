// Mentions légales (/legal.html) : page de confidentialité et de support de l'app sur l'App Store. Son texte,
// en anglais, est écrit dans la page ; ce module n'ajoute que le cadre du site (menu, pied de page, thèmes,
// langue de l'interface). La page ne contacte pas l'API : pas de bouton de clé. Le titre de la page est gardé.
import { browserStore } from '../ui/dom.js';
import { initI18n } from '../ui/i18n-dom.js';
import { mountShell } from '../ui/shell.js';

const store = browserStore();
await initI18n({ store });
mountShell({ page: 'legal', store });
