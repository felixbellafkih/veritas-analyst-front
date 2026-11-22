// Page de l'Interpréteur.
import { browserStore } from '../ui/dom.js';
import { initI18n, t } from '../ui/i18n-dom.js';
import { mountShell } from '../ui/shell.js';

const store = browserStore();
await initI18n({ store });
document.title = `${t('Interpréteur')} — Veritas Analyst`;

const shell = mountShell({ page: 'interpreteur', store, onKeyClick: () => {} });
shell.setKeyStatus(store.getDevPassword() ? 'dev' : store.getKey() ? 'presente' : 'absente');
