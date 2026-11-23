// Vérification d'une saisie du mode Tarteel, sans interface : les fréquences, l'état du signal, tous les
// versets du cluster, et ceux que le visiteur a cochés.
//
// Une frappe annule aussitôt ce qui était vérifié ou en cours de vérification, et vide la sélection :
// seule la réponse à la dernière saisie est annoncée, et les versets rendus par passage() sont toujours
// ceux du cluster à l'écran. Sans cela, une réponse arrivée en retard ferait partir à l'analyse d'autres
// versets que ceux que le visiteur a sous les yeux.
//
// Ce qu'il faut afficher (onChange) :
//   {step:'vide'}                           pas de racine primaire
//   {step:'attente'}                        saisie en cours, ou fréquences demandées
//   {step:'signal', state:'aucune', count}  aucune occurrence
//   {step:'lecture', count}                 des occurrences : les versets sont demandés
//   {step:'pret', count, verses}            le cluster est lu : le visiteur coche les versets à analyser
//   {step:'message', count, text}           le Kernel a répondu par un message
//   {step:'absent', count}                  aucun verset
//   {step:'echec', stage, failure[, count]} stage : 'frequences' | 'cluster'
// Cocher une case n'annonce rien : la page tient son compteur d'après selection().
import { pickVerses, tarteelState } from './tarteel.js';

// api : frequencies(primary, constraint, {signal}) et cluster(primary, constraint, limit, {signal})
// delay : pause après la dernière frappe, en millisecondes ; setTimer, clearTimer : la minuterie
export function createTarteelProbe({ api, onChange, delay = 400, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let roots = { primary: '', constraint: '' };
  let view = { step: 'vide' };
  let chosen = new Set(); // rangs des versets cochés dans le cluster à l'écran
  let token = 0;      // change à chaque saisie et à chaque vérification : une réponse d'un autre jeton est ignorée
  let timer = null;   // vérification en attente de la fin de la saisie
  let pending = null; // demande en cours

  // Toute nouvelle annonce part d'une sélection vide : un autre cluster n'hérite d'aucune case cochée
  function show(next) {
    view = next;
    chosen = new Set();
    onChange(view);
  }

  const total = () => (view.step === 'pret' ? view.verses.length : 0);

  function invalidate() {
    token += 1;
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
    if (pending) {
      pending.abort();
      pending = null;
    }
  }

  async function check() {
    invalidate();
    const mine = token;
    const { primary, constraint } = roots;
    if (!primary) {
      show({ step: 'vide' });
      return;
    }
    const controller = new AbortController();
    pending = controller;
    show({ step: 'attente' });
    let stage = 'frequences';
    let known = {};
    try {
      const found = tarteelState({ primary, constraint, ...await api.frequencies(primary, constraint, { signal: controller.signal }) });
      if (mine !== token) return;
      if (found.state === 'vide') {
        // Fréquences de forme inattendue : rien n'est conclu
        show({ step: 'echec', stage, failure: null });
        return;
      }
      known = { count: found.count };
      if (found.state !== 'pur') {
        show({ step: 'signal', state: found.state, ...known });
        return;
      }
      stage = 'cluster';
      show({ step: 'lecture', ...known });
      // Tous les versets du cluster : le visiteur choisit ensuite ceux qui partent
      const list = await api.cluster(primary, constraint, found.count, { signal: controller.signal });
      if (mine !== token) return;
      if (typeof list === 'string') show({ step: 'message', ...known, text: list }); // un texte : message du Kernel
      else if (!Array.isArray(list) || !list.length) show({ step: 'absent', ...known });
      else show({ step: 'pret', ...known, verses: list.map(String) });
    } catch (failure) {
      if (mine !== token || (failure && failure.kind === 'aborted')) return;
      if (stage === 'cluster' && failure && failure.kind === 'http' && failure.status === 404) show({ step: 'absent', ...known });
      else show({ step: 'echec', stage, failure, ...known });
    } finally {
      if (pending === controller) pending = null;
    }
  }

  return {
    // Le visiteur a modifié une racine : la vérification attend la fin de la saisie
    input(primary, constraint) {
      invalidate();
      roots = { primary: String(primary ?? '').trim(), constraint: String(constraint ?? '').trim() };
      if (!roots.primary) {
        show({ step: 'vide' });
        return;
      }
      show({ step: 'attente' });
      timer = setTimer(() => {
        timer = null;
        check();
      }, delay);
    },

    // Vérifie tout de suite les racines en place (bouton « Réessayer »)
    check,

    // Si une vérification attend la fin de la saisie, elle part tout de suite
    flush() {
      if (timer !== null) check();
    },

    view: () => view,

    // Coche ou décoche le verset de ce rang, dans le cluster à l'écran
    select(index, on) {
      if (!Number.isInteger(index) || index < 0 || index >= total()) return;
      if (on) chosen.add(index);
      else chosen.delete(index);
    },

    // Tout sélectionner, ou tout désélectionner
    selectAll(on) {
      chosen = new Set(on ? Array.from({ length: total() }, (_, index) => index) : []);
    },

    // Coche plusieurs versets d'un coup (sélection reportée de la page Tarteel) ; les rangs hors du cluster
    // sont ignorés, et rien ne se passe tant que le cluster n'est pas lu
    selectMany(indexes) {
      if (!Array.isArray(indexes)) return;
      for (const index of indexes) {
        if (Number.isInteger(index) && index >= 0 && index < total()) chosen.add(index);
      }
    },

    isSelected: (index) => chosen.has(index),

    selection: () => ({ chosen: chosen.size, total: total() }),

    // Ce qui part à l'analyse : les versets cochés du cluster lu pour les racines en place ; sinon rien
    passage() {
      if (view.step !== 'pret' || !chosen.size) return null;
      return { primary: roots.primary, constraint: roots.constraint, verses: pickVerses(view.verses, chosen) };
    },
  };
}
