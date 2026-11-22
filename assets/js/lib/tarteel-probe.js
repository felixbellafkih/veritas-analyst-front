// Vérification d'une saisie du mode Tarteel, sans interface : les fréquences, l'état du signal et, s'il
// est pur, les versets du cluster.
//
// Une frappe annule aussitôt ce qui était vérifié ou en cours de vérification : seule la réponse à la
// dernière saisie est annoncée, et le cluster rendu par passage() est toujours celui des racines en
// place. Sans cela, une réponse arrivée en retard ferait partir à l'analyse un autre cluster que celui
// que le visiteur a sous les yeux.
//
// Ce qu'il faut afficher (onChange) :
//   {step:'vide'}                                        pas de racine primaire
//   {step:'attente'}                                     saisie en cours, ou fréquences demandées
//   {step:'signal', state, count, constraintRequired}    state : 'surcharge' | 'insuffisant' | 'aucune'
//   {step:'lecture', count, constraintRequired}          signal pur : les versets sont demandés
//   {step:'pret', count, constraintRequired, verses}     le cluster peut être analysé
//   {step:'message', count, constraintRequired, text}    le Kernel a répondu par un message
//   {step:'absent', count, constraintRequired}           aucun verset
//   {step:'echec', stage, failure[, count, constraintRequired]}   stage : 'frequences' | 'cluster'
import { SENT_LIMIT, tarteelState } from './tarteel.js';

// api : frequencies(primary, constraint, {signal}) et cluster(primary, constraint, limit, {signal})
// delay : pause après la dernière frappe, en millisecondes ; setTimer, clearTimer : la minuterie
export function createTarteelProbe({ api, onChange, delay = 400, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let roots = { primary: '', constraint: '' };
  let view = { step: 'vide' };
  let token = 0;      // change à chaque saisie et à chaque vérification : une réponse d'un autre jeton est ignorée
  let timer = null;   // vérification en attente de la fin de la saisie
  let pending = null; // demande en cours

  function show(next) {
    view = next;
    onChange(view);
  }

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
      known = { count: found.count, constraintRequired: found.constraintRequired };
      if (found.state !== 'pur') {
        show({ step: 'signal', state: found.state, ...known });
        return;
      }
      stage = 'cluster';
      show({ step: 'lecture', ...known });
      const list = await api.cluster(primary, constraint, SENT_LIMIT, { signal: controller.signal });
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

    // Le cluster à analyser : seulement quand il a été lu pour les racines en place
    passage: () => (view.step === 'pret' ? { primary: roots.primary, constraint: roots.constraint, verses: view.verses } : null),
  };
}
