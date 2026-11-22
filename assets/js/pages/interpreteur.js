// Page de l'Interpréteur.
import { createApi } from '../api.js';
import { apiBase } from '../lib/config.js';
import { browserStore } from '../ui/dom.js';
import { initI18n, t } from '../ui/i18n-dom.js';
import { openKeyDialog } from '../ui/key-dialog.js';
import { mountShell } from '../ui/shell.js';

const store = browserStore();
const api = createApi({ base: apiBase(window.location) });
await initI18n({ store });
document.title = `${t('Interpréteur')} — Veritas Analyst`;

// Témoin de l'en-tête : mode développeur, clé présente, ou rien
function showAccess() {
  shell.setKeyStatus(store.getDevPassword() ? 'dev' : store.getKey() ? 'presente' : 'absente');
}

const shell = mountShell({ page: 'interpreteur', store, onKeyClick: () => openKeyDialog({ store, api, onChange: showAccess }) });
showAccess();
