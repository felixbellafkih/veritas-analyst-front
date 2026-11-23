// Vue de la Bibliothèque (ui/library-view.js), montée sur un faux DOM : trois onglets (manifeste, thèse,
// gouvernance), le chargement du contenu à la première ouverture, le repli sur le français, l'échec.
// Ce que le faux DOM ne montre pas : la mise en page, le défilement, la place réelle du curseur à l'écran.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './aides/faux-dom.mjs';

const dom = installFakeDom();
const { mountLibraryView } = await import('../../assets/js/v3/ui/library-view.js');
const { GOVERNANCE_PANELS, THESIS_CHAPTERS } = await import('../../assets/js/v3/lib/library.js');

const FRENCH = {
  these: { introduction: 'Introduction en français.', 'phase-1': 'Phase une en français.', 'phase-2': 'Phase deux en français.', 'phase-3': 'Phase trois en français.' },
  gouvernance: { 1: 'Volet un en français.', 2: 'Volet deux en français.', 3: 'Volet trois en français.', 4: 'Volet quatre en français.' },
};
const ENGLISH = {
  these: { introduction: 'Introduction in English.', 'phase-2': 'Phase two in English.', 'phase-3': 'Phase three in English.' },
  gouvernance: { 1: 'Panel one in English.', 2: 'Panel two in English.' },
};
const settle = () => new Promise((resolve) => setImmediate(resolve));
const HOME = { doc: 'manifeste', chapter: 'introduction', panel: '1' };

// files : {code: contenu | null (échec) | fonction qui rend l'un ou l'autre}
function mounted({ lang = 'fr', files = { fr: FRENCH }, target = HOME } = {}) {
  const container = dom.node();
  const manifesto = dom.node();
  manifesto.textContent = 'Le manifeste, écrit dans la page.';
  const calls = [];
  const asked = [];
  const view = mountLibraryView(container, {
    manifesto,
    lang,
    load: async (code) => {
      calls.push(code);
      const file = files[code];
      return typeof file === 'function' ? file() : file ?? null;
    },
    onNavigate: (next) => asked.push(next),
  });
  view.show(target);
  const tabs = () => container.find((node) => node.getAttribute('role') === 'tab');
  const tab = (id) => tabs().find((node) => node.dataset.cible === id);
  const panel = (id) => container.find((node) => node.dataset.panneau === id)[0];
  const texts = (node, name) => node.byClass(name).map((found) => found.textContent);
  const paragraphs = (node) => node.find((found) => found.tagName === 'P' && !found.className).map((found) => found.textContent);
  const body = (id) => panel(id).byClass('biblio__texte')[0];
  return { container, manifesto, calls, asked, view, tabs, tab, panel, texts, paragraphs, body };
}

test('au départ : trois onglets, le manifeste montré, rien n’est chargé', async () => {
  const { tabs, tab, manifesto, panel, calls } = mounted();
  await settle();
  assert.deepEqual(tabs().slice(0, 3).map((node) => node.textContent), ['Manifeste', 'Thèse', 'Gouvernance']);
  assert.equal(tab('manifeste').getAttribute('aria-selected'), 'true');
  assert.equal(tab('these').getAttribute('aria-selected'), 'false');
  assert.equal(manifesto.hidden, false);
  assert.equal(panel('these').hidden, true);
  assert.equal(panel('gouvernance').hidden, true);
  assert.deepEqual(calls, []);
});

test('le manifeste de la page reste dans la vue, avec ses repères d’onglet', () => {
  const { container, manifesto, tab } = mounted();
  assert.ok(container.find((node) => node === manifesto).length === 1);
  assert.equal(manifesto.getAttribute('role'), 'tabpanel');
  assert.equal(manifesto.getAttribute('aria-labelledby'), tab('manifeste').getAttribute('id'));
});

test('ouvrir la thèse charge une fois et affiche l’introduction ; changer de chapitre ne recharge rien', async () => {
  const { tab, manifesto, panel, calls, asked, paragraphs, body } = mounted();
  tab('these').click();
  await settle();
  assert.equal(manifesto.hidden, true);
  assert.equal(panel('these').hidden, false);
  assert.equal(tab('these').getAttribute('aria-selected'), 'true');
  assert.deepEqual(calls, ['fr']);
  assert.deepEqual(paragraphs(body('these')), ['Introduction en français.']);
  assert.deepEqual(asked, [{ doc: 'these', chapter: 'introduction', panel: '1' }]);
  tab('phase-1').click();
  await settle();
  assert.deepEqual(calls, ['fr']);
  assert.deepEqual(paragraphs(body('these')), ['Phase une en français.']);
  assert.deepEqual(asked[1], { doc: 'these', chapter: 'phase-1', panel: '1' });
  assert.equal(tab('phase-1').getAttribute('aria-selected'), 'true');
  assert.equal(tab('introduction').getAttribute('aria-selected'), 'false');
});

test('les sous-onglets de la thèse portent les intitulés de l’app', () => {
  const { tab } = mounted();
  assert.deepEqual(THESIS_CHAPTERS.map((chapter) => tab(chapter.id).textContent), THESIS_CHAPTERS.map((chapter) => chapter.label));
});

test('show() ouvre ce que l’adresse désigne, sans rien demander à la page', async () => {
  const { view, panel, asked, paragraphs, body, tab } = mounted({ target: { doc: 'these', chapter: 'phase-2', panel: '1' } });
  await settle();
  assert.equal(panel('these').hidden, false);
  assert.deepEqual(paragraphs(body('these')), ['Phase deux en français.']);
  assert.equal(tab('phase-2').getAttribute('aria-selected'), 'true');
  view.show({ doc: 'gouvernance', chapter: 'introduction', panel: '3' });
  await settle();
  assert.equal(panel('these').hidden, true);
  assert.equal(panel('gouvernance').hidden, false);
  assert.deepEqual(paragraphs(body('gouvernance')), ['Volet trois en français.']);
  view.show(HOME);
  assert.equal(panel('gouvernance').hidden, true);
  assert.deepEqual(asked, []);
});

test('chapitre précédent, chapitre suivant', async () => {
  const { tab, panel, asked, paragraphs, body, texts } = mounted();
  tab('these').click();
  await settle();
  const moves = () => panel('these').byClass('biblio__pas').filter((node) => !node.hidden);
  // l'introduction n'a pas de chapitre précédent
  assert.equal(moves().length, 1);
  assert.deepEqual(texts(moves()[0], 'biblio__pas-nom'), ['Phase 1 : Le Bootstrap']);
  moves()[0].click();
  await settle();
  assert.deepEqual(paragraphs(body('these')), ['Phase une en français.']);
  assert.deepEqual(asked.at(-1), { doc: 'these', chapter: 'phase-1', panel: '1' });
  assert.deepEqual(moves().map((node) => texts(node, 'biblio__pas-nom')[0]), ['Introduction : Maqasid Al-Huruf', 'Phase 2 : La Syntaxe']);
  // la phase 3 n'a pas de chapitre suivant
  tab('phase-3').click();
  await settle();
  assert.deepEqual(moves().map((node) => texts(node, 'biblio__pas-nom')[0]), ['Phase 2 : La Syntaxe']);
});

test('interface en français : le texte porte la langue et le sens du français, sans ligne d’annonce', async () => {
  const { tab, panel, body } = mounted();
  tab('these').click();
  await settle();
  assert.equal(body('these').getAttribute('lang'), 'fr');
  assert.equal(body('these').getAttribute('dir'), 'ltr');
  assert.equal(panel('these').byClass('biblio__langue')[0].hidden, true);
});

test('autre langue : le fichier de la langue seul quand il porte le texte', async () => {
  const { tab, panel, calls, paragraphs, body } = mounted({ lang: 'ar', files: { ar: ENGLISH, fr: FRENCH } });
  tab('these').click();
  await settle();
  assert.deepEqual(calls, ['ar']);
  assert.deepEqual(paragraphs(body('these')), ['Introduction in English.']);
  assert.equal(body('these').getAttribute('lang'), 'ar');
  assert.equal(body('these').getAttribute('dir'), 'rtl');
  assert.equal(panel('these').byClass('biblio__langue')[0].hidden, true);
});

test('un chapitre absent du fichier de la langue est pris au français, et la page le dit', async () => {
  const { tab, panel, calls, paragraphs, body } = mounted({ lang: 'ar', files: { ar: ENGLISH, fr: FRENCH } });
  tab('these').click();
  await settle();
  tab('phase-1').click();
  await settle();
  assert.deepEqual(calls, ['ar', 'fr']);
  assert.deepEqual(paragraphs(body('these')), ['Phase une en français.']);
  assert.equal(body('these').getAttribute('lang'), 'fr');
  assert.equal(body('these').getAttribute('dir'), 'ltr');
  const note = panel('these').byClass('biblio__langue')[0];
  assert.equal(note.hidden, false);
  assert.ok(note.textContent.length > 10);
  // retour à un chapitre traduit : la ligne d'annonce s'efface, le texte reprend la langue de l'interface
  tab('phase-2').click();
  await settle();
  assert.deepEqual(calls, ['ar', 'fr']);
  assert.equal(note.hidden, true);
  assert.equal(body('these').getAttribute('lang'), 'ar');
  assert.deepEqual(paragraphs(body('these')), ['Phase two in English.']);
});

test('un chargement en échec : le message, « Réessayer » relance, le manifeste reste accessible', async () => {
  let broken = true;
  const { tab, panel, manifesto, calls, paragraphs, body } = mounted({ files: { fr: () => (broken ? null : FRENCH) } });
  tab('these').click();
  await settle();
  const failure = () => panel('these').find((node) => node.getAttribute('role') === 'alert');
  assert.equal(failure().length, 1);
  assert.deepEqual(paragraphs(body('these')), []);
  const retry = failure()[0].find((node) => node.tagName === 'BUTTON');
  assert.deepEqual(retry.map((node) => node.textContent), ['Réessayer']);
  // le manifeste et les onglets restent utilisables
  tab('manifeste').click();
  assert.equal(manifesto.hidden, false);
  assert.equal(panel('these').hidden, true);
  tab('these').click();
  await settle();
  assert.deepEqual(calls, ['fr', 'fr']); // un échec n'est pas gardé : la thèse est redemandée
  broken = false;
  failure()[0].find((node) => node.tagName === 'BUTTON')[0].click();
  await settle();
  assert.deepEqual(calls, ['fr', 'fr', 'fr']);
  assert.equal(failure().length, 0);
  assert.deepEqual(paragraphs(body('these')), ['Introduction en français.']);
});

test('un chargement qui lève une erreur est un échec comme un autre', async () => {
  const { tab, panel } = mounted({ files: { fr: () => { throw new Error('hors ligne'); } } });
  tab('these').click();
  await settle();
  assert.equal(panel('these').find((node) => node.getAttribute('role') === 'alert').length, 1);
});

test('autre langue : le fichier de la langue en échec affiche le message, pas le français', async () => {
  const { tab, panel, calls, paragraphs, body } = mounted({ lang: 'en', files: { en: null, fr: FRENCH } });
  tab('these').click();
  await settle();
  assert.deepEqual(calls, ['en']);
  assert.equal(panel('these').find((node) => node.getAttribute('role') === 'alert').length, 1);
  assert.deepEqual(paragraphs(body('these')), []);
});

test('un texte absent des deux fichiers : un message, jamais un chapitre vide', async () => {
  const { tab, panel, paragraphs, body } = mounted({ lang: 'en', files: { en: ENGLISH, fr: { these: {}, gouvernance: {} } } });
  tab('these').click();
  await settle();
  tab('phase-1').click();
  await settle();
  assert.equal(panel('these').find((node) => node.getAttribute('role') === 'alert').length, 1);
  assert.deepEqual(paragraphs(body('these')), []);
});

test('une réponse en retard ne remplace pas le chapitre demandé ensuite', async () => {
  let release;
  const slow = new Promise((resolve) => { release = resolve; });
  const { tab, paragraphs, body } = mounted({ files: { fr: () => slow } });
  tab('these').click();
  tab('phase-3').click();
  release(FRENCH);
  await settle();
  assert.deepEqual(paragraphs(body('these')), ['Phase trois en français.']);
});

test('gouvernance : la carte, puis le volet choisi sous le titre de l’app', async () => {
  const { tab, panel, asked, paragraphs, body, texts } = mounted();
  tab('gouvernance').click();
  await settle();
  const governance = panel('gouvernance');
  assert.equal(governance.hidden, false);
  assert.equal(governance.byClass('carte-gouv').length, 1);
  assert.deepEqual(texts(governance, 'biblio__volet-titre'), [GOVERNANCE_PANELS[0].title]);
  assert.deepEqual(paragraphs(body('gouvernance')), ['Volet un en français.']);
  const groups = governance.find((node) => node.tagName === 'BUTTON' && node.hasAttribute('aria-pressed'));
  assert.equal(groups.length, 4);
  groups[2].click();
  await settle();
  assert.deepEqual(asked.at(-1), { doc: 'gouvernance', chapter: 'introduction', panel: '3' });
  assert.deepEqual(texts(governance, 'biblio__volet-titre'), [GOVERNANCE_PANELS[2].title]);
  assert.deepEqual(paragraphs(body('gouvernance')), ['Volet trois en français.']);
  assert.deepEqual(groups.map((node) => node.getAttribute('aria-pressed')), ['false', 'false', 'true', 'false']);
});

test('gouvernance : un volet absent de la langue est pris au français, et la page le dit', async () => {
  const { tab, panel, body } = mounted({ lang: 'en', files: { en: ENGLISH, fr: FRENCH }, target: { doc: 'gouvernance', chapter: 'introduction', panel: '4' } });
  await settle();
  assert.equal(body('gouvernance').getAttribute('lang'), 'fr');
  assert.equal(panel('gouvernance').byClass('biblio__langue')[0].hidden, false);
  tab('these').click();
  await settle();
  assert.equal(body('these').getAttribute('lang'), 'en');
});

test('un contenu hostile reste du texte : ni lien, ni élément inattendu', async () => {
  const hostile = { these: { introduction: 'Avant <script>alert(1)</script> [x](javascript:alert(1))\n\n<img src=x onerror=alert(1)>' }, gouvernance: {} };
  const { tab, body } = mounted({ files: { fr: hostile } });
  tab('these').click();
  await settle();
  const tags = body('these').find(() => true).map((node) => node.tagName);
  for (const tag of ['SCRIPT', 'IMG', 'A', 'IFRAME']) assert.ok(!tags.includes(tag), tag);
  assert.ok(body('these').find((node) => node.tagName === 'P').some((node) => node.textContent.includes('<script>alert(1)</script>')));
});

test('au clavier : les flèches passent d’un onglet à l’autre, une touche modifiée est laissée au navigateur', async () => {
  const { tab, panel, asked } = mounted();
  const event = tab('manifeste').dispatch('keydown', { key: 'ArrowRight' });
  await settle();
  assert.equal(event.prevented, true);
  assert.equal(panel('these').hidden, false);
  assert.equal(dom.focused(), tab('these'));
  assert.deepEqual(asked, [{ doc: 'these', chapter: 'introduction', panel: '1' }]);
  const modified = tab('these').dispatch('keydown', { key: 'ArrowRight', altKey: true });
  assert.equal(modified.prevented, false);
  assert.equal(panel('these').hidden, false);
  // un seul arrêt de la touche Tab par rangée d'onglets : l'onglet choisi
  assert.deepEqual(['manifeste', 'these', 'gouvernance'].map((id) => tab(id).tabIndex), [-1, 0, -1]);
});
