// Pages du corpus (/corpus/…, /en/corpus/…), écrites chaque nuit par la publication du corpus (export_corpus.py
// du Kernel) avec tout leur contenu. Ce module n'ajoute que le cadre du site : menu, pied de page, barre
// d'onglets du téléphone, thèmes, langue de l'interface. Il ne touche ni au titre ni au contenu de la page.
// - Le contenu est en français ou en anglais. Sans choix du visiteur, l'interface prend la langue de la page,
//   et non celle du navigateur : un robot qui exécute les scripts voit une page d'une seule langue.
// - La page ne contacte pas l'API : pas de bouton de clé.
import { browserStore } from '../ui/dom.js';
import { initI18n } from '../ui/i18n-dom.js';
import { mountShell } from '../ui/shell.js';

// La langue écrite par la publication, lue avant que l'interface ne pose la sienne sur le document
const pageLang = document.documentElement.lang;
const store = browserStore();
await initI18n({ store, fallback: pageLang });
mountShell({ page: 'corpus', store });
