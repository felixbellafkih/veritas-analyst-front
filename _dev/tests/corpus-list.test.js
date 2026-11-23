// Extraits lus dans la page de liste du corpus public (lib/corpus-list.js). Les pages du dépôt servent
// de témoin : si le Kernel change leur forme, ce test le dit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { corpusExcerpts } from '../../assets/js/v5/lib/corpus-list.js';

const page = (path) => readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), 'utf8');

test('une entrée de la liste : son adresse et son extrait, entités décodées', () => {
  const html = '<ul class="entries"><li><a href="/corpus/1/1/">Coran 1:1 — Analyse</a><br><span class="muted">L&#x27;amorce &amp; la suite &lt;x&gt; &quot;y&quot; &#233;t&#xE9;…</span></li>'
    + '<li><a href="/corpus/2/255/">Coran 2:255</a><br><span class="muted">Autre extrait</span></li></ul>';
  const excerpts = corpusExcerpts(html);
  assert.equal(excerpts.size, 2);
  assert.equal(excerpts.get('/corpus/1/1/'), 'L\'amorce & la suite <x> "y" été…');
  assert.equal(excerpts.get('/corpus/2/255/'), 'Autre extrait');
});

// Relecture de l'étape 5 : la liste au gabarit du site a une autre forme ; l'accueil avait perdu ses extraits
test('liste au gabarit du site : même lecture', () => {
  const html = '<ul class="corpus__liste"><li class="corpus__entree"><a class="corpus__lien" href="/corpus/1/1/">Coran 1:1</a>'
    + '<span class="corpus__extrait">L&#x27;amorce &amp; la suite</span></li>'
    + '<li class="corpus__entree"><a class="corpus__lien" href="/en/corpus/2/255/">Quran 2:255</a><span class="corpus__extrait">Other</span></li></ul>';
  const excerpts = corpusExcerpts(html);
  assert.equal(excerpts.get('/corpus/1/1/'), "L'amorce & la suite");
  assert.equal(excerpts.get('/en/corpus/2/255/'), 'Other');
  assert.equal(corpusExcerpts('<a class="corpus__lien" href="https://ailleurs.example/corpus/1/1/">x</a><span class="corpus__extrait">y</span>').size, 0);
});

test('liste anglaise : les adresses commencent par /en/corpus/', () => {
  const excerpts = corpusExcerpts('<li><a href="/en/corpus/1/1/">Quran 1:1</a><br><span class="muted">The initiation…</span></li>');
  assert.equal(excerpts.get('/en/corpus/1/1/'), 'The initiation…');
});

test('rien d’exploitable : aucune entrée, jamais d’erreur', () => {
  for (const html of ['', null, undefined, 42, '<p>autre page</p>', '<a href="/corpus/1/1/">sans extrait</a>', '<a href="https://ailleurs.example/corpus/1/1/">x</a><br><span class="muted">y</span>']) {
    assert.equal(corpusExcerpts(html).size, 0, String(html));
  }
});

test('un extrait vide ou fait d’espaces n’est pas retenu', () => {
  assert.equal(corpusExcerpts('<a href="/corpus/1/1/">x</a><br><span class="muted">   </span>').size, 0);
});

test('les listes publiées donnent un extrait aux trois analyses de l’accueil', () => {
  const french = corpusExcerpts(page('corpus/index.html'));
  const english = corpusExcerpts(page('en/corpus/index.html'));
  assert.ok(french.size >= 20, `${french.size} entrées`);
  for (const reference of ['1/1', '6/159', '18/96-97']) {
    assert.ok((french.get(`/corpus/${reference}/`) || '').length > 40, `français ${reference}`);
    assert.ok((english.get(`/en/corpus/${reference}/`) || '').length > 40, `anglais ${reference}`);
  }
  assert.ok(french.get('/corpus/1/1/').startsWith("L'amorce s'effectue"));
  for (const excerpt of french.values()) assert.doesNotMatch(excerpt, /[<>]|&#|&amp;/);
});
