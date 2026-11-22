// Pose le thème avant le premier affichage, pour qu'aucun éclair de l'autre thème n'apparaisse.
// Script classique, chargé dans <head> sans attente : le choix du visiteur s'il existe, sinon le réglage de l'appareil.
(function () {
  var theme = null;
  try {
    theme = window.localStorage.getItem('veritas.theme');
  } catch (error) {
    theme = null;
  }
  if (theme !== 'nuit' && theme !== 'jour') {
    theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'jour' : 'nuit';
  }
  document.documentElement.dataset.theme = theme;
})();
