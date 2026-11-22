import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leavesPage } from '../../assets/js/v1/lib/navigation.js';

const HERE = 'https://veritas-analyst.org/interpreteur/?s=1&de=1&a=7';

// Défaut relevé à la relecture : Safari sur iPhone n'affiche pas l'avertissement du navigateur quand on
// quitte une page. Pendant une analyse (facturée), le site demande donc lui-même confirmation avant de
// suivre un lien qui remplacerait la page.
test('un lien vers une autre page du site, ou vers un autre site, quitte la page', () => {
  assert.equal(leavesPage({ href: '/corpus/' }, HERE), true);
  assert.equal(leavesPage({ href: '/accueil/' }, HERE), true);
  assert.equal(leavesPage({ href: '/legal.html' }, HERE), true);
  assert.equal(leavesPage({ href: '/interpreteur/' }, HERE), true); // même page, autre passage : elle se recharge
  assert.equal(leavesPage({ href: 'https://ailleurs.example/' }, HERE), true);
});

test('un lien qui ouvre un autre onglet, un téléchargement ou un repère de la page ne la quitte pas', () => {
  assert.equal(leavesPage({ href: 'https://veritas-analyst.streamlit.app', target: '_blank' }, HERE), false);
  assert.equal(leavesPage({ href: '/corpus/1/1/', target: '_blank' }, HERE), false);
  assert.equal(leavesPage({ href: 'blob:https://veritas-analyst.org/abc', download: 'analyse.txt' }, HERE), false);
  assert.equal(leavesPage({ href: '/fichier.txt', download: '' }, HERE), false);
  assert.equal(leavesPage({ href: '#passage' }, HERE), false);
  assert.equal(leavesPage({ href: '/interpreteur/?s=1&de=1&a=7#section-2' }, HERE), false);
});

test('ce qui n’est pas une adresse de page ne quitte rien', () => {
  for (const href of ['', null, undefined, 'mailto:quelquun@example.org', 'tel:+33100000000', 'javascript:void(0)']) {
    assert.equal(leavesPage({ href }, HERE), false, String(href));
  }
  assert.equal(leavesPage(null, HERE), false);
  assert.equal(leavesPage({ href: '/corpus/' }, 'pas une adresse'), false);
});
