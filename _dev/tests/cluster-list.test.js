// Liste des versets d'un cluster (ui/cluster-list.js), montée sur un faux DOM avec la vraie sonde et le
// cluster S-M-W capturé (352 versets). Ce que la liste affiche ne doit jamais changer ce qui part : les
// versets envoyés sont ceux que le visiteur a cochés, par rang dans le cluster entier.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { installFakeDom } from './aides/faux-dom.mjs';

const dom = installFakeDom();
const { mountClusterList } = await import('../../assets/js/v6/ui/cluster-list.js');
const { createTarteelProbe } = await import('../../assets/js/v6/lib/tarteel-probe.js');
const { indexesOfSura } = await import('../../assets/js/v6/lib/tarteel-stats.js');
const { clusterVerse } = await import('../../assets/js/v6/lib/tarteel.js');

const fixture = fileURLToPath(new URL('../fixtures/tarteel.json', import.meta.url));
const VERSES = JSON.parse(readFileSync(fixture, 'utf8')).clusters['S-M-W|'];
const SIX = indexesOfSura(VERSES, 6);
const ref = (index) => clusterVerse(VERSES[index]).reference;

// Une sonde prête sur le cluster, et la liste montée ; avec link, chaque ligne porte un lien (page Tarteel)
async function mounted({ link = false } = {}) {
  const api = { frequencies: async () => ({ primaryFrequency: VERSES.length, clusterFrequency: 0 }), cluster: async () => VERSES };
  const probe = createTarteelProbe({ api, onChange() {}, delay: 0, setTimer: (run) => { run(); return 1; }, clearTimer() {} });
  probe.input('S-M-W', '');
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(probe.view().step, 'pret');
  const container = dom.node();
  const rowExtra = link ? () => {
    const anchor = dom.node('a');
    anchor.className = 'cluster__lien';
    return anchor;
  } : undefined;
  const list = mountClusterList(container, { probe, verses: VERSES, rowExtra });
  const tools = container.byClass('cluster__outil');
  return {
    probe,
    list,
    boxes: () => container.byClass('cluster__case'),
    links: () => container.byClass('cluster__lien'),
    all: tools[0],
    none: tools[1],
    more: container.byClass('cluster__suite')[0],
    sent: () => (probe.passage() ? probe.passage().verses.map((verse) => clusterVerse(verse).reference) : []),
  };
}

test('au départ : une première tranche de lignes, rien de coché, une seule case atteignable par Tab', async () => {
  const { boxes, probe, more } = await mounted();
  assert.equal(boxes().length, 60);
  assert.equal(probe.selection().chosen, 0);
  assert.equal(boxes().filter((box) => box.tabIndex === 0).length, 1);
  assert.equal(more.hidden, false);
});

test('sous un filtre par sourate, les cases cochées sont bien les versets affichés', async () => {
  const { list, boxes, sent, probe } = await mounted();
  list.setVisible(SIX);
  assert.equal(boxes().length, SIX.length);
  boxes()[0].click();
  boxes()[2].click();
  assert.deepEqual(sent(), [ref(SIX[0]), ref(SIX[2])]);
  // Le filtre retiré, la sélection n'a pas bougé
  list.setVisible(null);
  assert.deepEqual(probe.selection(), { chosen: 2, total: VERSES.length });
  assert.deepEqual(sent(), [ref(SIX[0]), ref(SIX[2])]);
});

test('une ligne bâtie par « Afficher la suite » garde son rang dans le cluster', async () => {
  const { boxes, more, sent } = await mounted();
  more.click();
  assert.equal(boxes().length, 120);
  boxes()[75].click();
  assert.deepEqual(sent(), [ref(75)]);
});

test('« Tout sélectionner » sans filtre coche tout le cluster, lignes non bâties comprises', async () => {
  const { all, none, probe, boxes } = await mounted();
  all.click();
  assert.equal(probe.selection().chosen, VERSES.length);
  assert.ok(boxes().every((box) => box.checked));
  none.click();
  assert.equal(probe.selection().chosen, 0);
  assert.ok(boxes().every((box) => !box.checked));
});

// Relecture de l'étape 2 : avec un filtre, « Tout sélectionner » cochait les 352 versets, dont 334 que le
// visiteur ne voyait pas, et qui partaient à une analyse facturée.
test('sous un filtre, « Tout sélectionner » ne coche que les versets affichés', async () => {
  const { list, all, probe, sent } = await mounted();
  list.setVisible(SIX);
  all.click();
  assert.equal(probe.selection().chosen, SIX.length);
  assert.deepEqual(sent(), SIX.map(ref));
});

test('sous un filtre, « Tout désélectionner » ne décoche que les versets affichés', async () => {
  const { list, none, boxes, probe, sent } = await mounted();
  boxes()[0].click(); // 1:1, hors de la sourate 6
  list.setVisible(SIX);
  boxes()[0].click();
  boxes()[1].click();
  assert.equal(probe.selection().chosen, 3);
  none.click();
  assert.deepEqual(sent(), [ref(0)]);
  assert.ok(boxes().every((box) => !box.checked));
});

test('au clavier : Fin bâtit la liste jusqu’au bout, Entrée coche sans rien soumettre', async () => {
  const { boxes, probe } = await mounted();
  const end = boxes()[0].dispatch('keydown', { key: 'End' });
  assert.equal(end.prevented, true);
  assert.equal(boxes().length, VERSES.length);
  assert.equal(boxes().filter((box) => box.tabIndex === 0).length, 1);
  assert.equal(dom.focused(), boxes()[VERSES.length - 1]);
  const enter = dom.focused().dispatch('keydown', { key: 'Enter' });
  assert.equal(enter.prevented, true);
  assert.equal(probe.selection().chosen, 1);
});

// Relecture de l'étape 2 : sur la page Tarteel, le lien de chaque verset ajoutait un arrêt de tabulation
// par ligne (60, puis jusqu'à 1 879). Seul le lien de la ligne du curseur est atteignable par Tab.
test('page Tarteel : les liens des versets n’ajoutent pas un arrêt de tabulation par ligne', async () => {
  const { boxes, links } = await mounted({ link: true });
  assert.equal(links().length, 60);
  assert.deepEqual(links().map((link) => link.tabIndex), [0, ...Array(59).fill(-1)]);
  // Le curseur descend d'une ligne : son lien devient le seul atteignable
  boxes()[0].dispatch('keydown', { key: 'ArrowDown' });
  assert.equal(dom.focused(), boxes()[1]);
  assert.deepEqual(links().map((link) => link.tabIndex).slice(0, 3), [-1, 0, -1]);
  assert.equal(links().filter((link) => link.tabIndex === 0).length, 1);
  // Un clic sur une case plus bas y amène le curseur, et son lien avec lui
  boxes()[5].focus();
  assert.equal(links().filter((link) => link.tabIndex === 0).length, 1);
  assert.equal(links()[5].tabIndex, 0);
});

test('page Tarteel : une ligne bâtie plus tard arrive avec un lien hors du parcours de Tab', async () => {
  const { links, more } = await mounted({ link: true });
  more.click();
  assert.equal(links().length, 120);
  assert.equal(links().filter((link) => link.tabIndex === 0).length, 1);
});

// Relecture de l'étape 3 : le défaut trouvé dans la chaîne du Séquenceur existait ici, sur une page en ligne
test('au clavier : une flèche tenue avec Alt, Ctrl, Cmd ou Maj reste au navigateur ; Entrée coche toujours', async () => {
  const { boxes, probe } = await mounted();
  boxes()[2].focus();
  for (const [key, modifier] of [['ArrowDown', 'altKey'], ['ArrowUp', 'metaKey'], ['End', 'ctrlKey'], ['ArrowDown', 'shiftKey']]) {
    const event = boxes()[2].dispatch('keydown', { key, [modifier]: true });
    assert.equal(event.prevented, false, `${modifier}+${key}`);
    assert.equal(dom.focused(), boxes()[2], `${modifier}+${key}`);
  }
  assert.equal(boxes().length, 60);
  // Entrée ne lance jamais l'analyse depuis une case, même tenue avec Ctrl
  const enter = boxes()[2].dispatch('keydown', { key: 'Enter', ctrlKey: true });
  assert.equal(enter.prevented, true);
  assert.equal(probe.selection().chosen, 1);
});
