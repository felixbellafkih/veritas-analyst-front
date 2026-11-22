// Ce que le site garde dans le navigateur, et rien d'autre :
// - sur l'appareil (local) : le thème, la langue, et la clé API seulement si le visiteur l'a demandé ;
// - pour l'onglet en cours (session) : la clé, le mot de passe développeur, la conversation,
//   le modèle choisi et l'état du formulaire.
// Si le stockage du navigateur refuse (navigation privée, quota), les valeurs vivent en mémoire :
// le site marche pour la visite en cours.
import { STORAGE } from './config.js';

const KEY_SHAPE = /^[\x21-\x7E]{1,200}$/;              // caractères qu'un en-tête HTTP accepte, sans espace
const PASSWORD_SHAPE = /^[\x20-\x7E\xA0-\xFF]{1,200}$/; // Latin-1 imprimable : fetch refuse le reste dans un en-tête
const LANG_SHAPE = /^[A-Za-z]{2,3}(-[A-Za-z]{2,4})?$/;
const THEMES = new Set(['nuit', 'jour']);

// Espaces de bord d'une clé collée : \s couvre aussi U+FEFF et l'espace insécable
const cleanKey = (value) => String(value ?? '').replace(/^\s+|\s+$/g, '');

export function createStore({ local, session } = {}) {
  const memory = new Map();

  function read(storage, area, name) {
    try {
      const value = storage.getItem(name);
      if (value !== null && value !== undefined) return value;
    } catch {
      // stockage indisponible : la mémoire prend le relais
    }
    return memory.has(area + name) ? memory.get(area + name) : null;
  }

  function write(storage, area, name, value) {
    try {
      storage.setItem(name, value);
      memory.delete(area + name);
    } catch {
      memory.set(area + name, value);
    }
  }

  function remove(storage, area, name) {
    try {
      storage.removeItem(name);
    } catch {
      // rien à retirer d'un stockage indisponible
    }
    memory.delete(area + name);
  }

  const onDevice = {
    get: (name) => read(local, 'local:', name),
    set: (name, value) => write(local, 'local:', name, value),
    remove: (name) => remove(local, 'local:', name),
  };
  const inTab = {
    get: (name) => read(session, 'session:', name),
    set: (name, value) => write(session, 'session:', name, value),
    remove: (name) => remove(session, 'session:', name),
  };

  function readJson(name) {
    const raw = inTab.get(name);
    if (raw === null) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  const validKey = (value) => KEY_SHAPE.test(cleanKey(value));
  const getKey = () => inTab.get(STORAGE.key) || onDevice.get(STORAGE.key) || '';
  const getDevPassword = () => inTab.get(STORAGE.dev) || '';

  return {
    getTheme() {
      const theme = onDevice.get(STORAGE.theme);
      return THEMES.has(theme) ? theme : null;
    },
    setTheme(theme) {
      if (!THEMES.has(theme)) return false;
      onDevice.set(STORAGE.theme, theme);
      return true;
    },

    getLang() {
      const lang = onDevice.get(STORAGE.lang);
      return lang && LANG_SHAPE.test(lang) ? lang : null;
    },
    setLang(code) {
      onDevice.set(STORAGE.lang, String(code));
    },

    validKey,
    getKey,
    // La clé reste dans l'onglet ; elle ne va sur l'appareil que si remember est vrai
    setKey(value, { remember = false } = {}) {
      if (!validKey(value)) return false;
      const key = cleanKey(value);
      inTab.set(STORAGE.key, key);
      if (remember) onDevice.set(STORAGE.key, key);
      else onDevice.remove(STORAGE.key);
      return true;
    },
    keyIsRemembered: () => Boolean(onDevice.get(STORAGE.key)),
    forgetKey() {
      inTab.remove(STORAGE.key);
      onDevice.remove(STORAGE.key);
    },

    getDevPassword,
    // Jamais sur l'appareil : le mot de passe développeur disparaît avec l'onglet
    setDevPassword(value) {
      if (typeof value !== 'string' || !PASSWORD_SHAPE.test(value)) return false;
      inTab.set(STORAGE.dev, value);
      return true;
    },
    clearDevPassword: () => inTab.remove(STORAGE.dev),

    credentials: () => ({ key: getKey(), devPassword: getDevPassword() }),

    loadConversation: () => readJson(STORAGE.conversation),
    saveConversation: (value) => inTab.set(STORAGE.conversation, JSON.stringify(value)),
    clearConversation: () => inTab.remove(STORAGE.conversation),

    getModel: () => inTab.get(STORAGE.model),
    setModel: (name) => inTab.set(STORAGE.model, String(name)),

    // Essai en local : quelle API répond ('reel' ou 'faux'), pour l'onglet
    getApiChoice: () => inTab.get(STORAGE.api),
    setApiChoice: (value) => inTab.set(STORAGE.api, String(value)),

    loadForm: () => readJson(STORAGE.form),
    saveForm: (value) => inTab.set(STORAGE.form, JSON.stringify(value)),

    // Sélection reportée de la page Tarteel à l'Interpréteur (lib/tarteel-handoff.js) : gardée pour
    // l'onglet, et lue une seule fois. Un rechargement de l'Interpréteur ne recoche donc rien.
    saveTarteelHandoff: (value) => inTab.set(STORAGE.handoff, JSON.stringify(value)),
    takeTarteelHandoff() {
      const value = readJson(STORAGE.handoff);
      inTab.remove(STORAGE.handoff);
      return value;
    },
  };
}
