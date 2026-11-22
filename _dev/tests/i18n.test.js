import { test } from 'node:test';
import assert from 'node:assert/strict';
import { htmlLang, isRtl, pickLanguage, responseLanguage, translate, tx, validLang } from '../../assets/js/lib/i18n.js';

// Les codes de engine/translator.py (LANGUAGE_NAMES), plus le français
const codes = ['fr', 'en', 'ar', 'es', 'de', 'it', 'pt', 'ru', 'zh-CN', 'zh-TW', 'ja', 'ko', 'hi', 'tr', 'id', 'vi', 'pl', 'nl', 'sv',
  'fi', 'da', 'no', 'cs', 'hu', 'el', 'ro', 'bg', 'uk', 'iw', 'fa', 'ur', 'sw', 'am', 'ha', 'yo', 'zu', 'af', 'ta', 'te', 'ml', 'kn',
  'mr', 'bn', 'gu', 'pa', 'th', 'my', 'km', 'tl', 'lo', 'ms', 'jv', 'ceb', 'so', 'ku', 'ps', 'uz', 'kk', 'az', 'bs', 'hr', 'sr', 'sq',
  'sk', 'sl', 'et', 'lv', 'lt', 'eo', 'la'];

test('translate : la traduction si elle existe, sinon le français', () => {
  assert.equal(translate({ Bonjour: 'Hello' }, 'Bonjour'), 'Hello');
  assert.equal(translate({}, 'Bonjour'), 'Bonjour');
  assert.equal(translate({ Bonjour: '' }, 'Bonjour'), 'Bonjour');
  assert.equal(translate(null, 'x'), 'x');
  assert.equal(translate(undefined, 'x'), 'x');
});

test('translate : un nombre s’insère par son repère', () => {
  assert.equal(translate({ '{n} versets': '{n} verses' }, '{n} versets', { n: 30 }), '30 verses');
  assert.equal(translate({}, '{n} versets envoyés sur {total}', { n: 30, total: 47 }), '30 versets envoyés sur 47');
  assert.equal(translate({ 'sur {total} : {n}': '{n} of {total}' }, 'sur {total} : {n}', { n: 1, total: 2 }), '1 of 2');
});

test('translate : une traduction qui a perdu un repère est écartée', () => {
  assert.equal(translate({ '{n} versets': 'verses' }, '{n} versets', { n: 30 }), '30 versets');
  assert.equal(translate({ '{n} sur {total}': '{n} of them' }, '{n} sur {total}', { n: 1, total: 2 }), '1 sur 2');
});

test('translate : un nom qui existe déjà sur tout objet ne passe pas pour une traduction', () => {
  assert.equal(translate({}, 'constructor'), 'constructor');
  assert.equal(translate({}, 'toString'), 'toString');
});

test('tx : simple repère pour la collecte des textes', () => {
  assert.equal(tx('Bonjour'), 'Bonjour');
});

test('pickLanguage : la première langue du visiteur qui existe', () => {
  assert.equal(pickLanguage(['de-AT', 'en'], codes), 'de');
  assert.equal(pickLanguage(['EN-us'], codes), 'en');
  assert.equal(pickLanguage(['pt-BR'], codes), 'pt');
  assert.equal(pickLanguage(['xx', 'es'], codes), 'es');
  assert.equal(pickLanguage(['fr-CA'], codes), 'fr');
});

test('pickLanguage : codes qui diffèrent entre le navigateur et le catalogue', () => {
  assert.equal(pickLanguage(['he'], codes), 'iw');
  assert.equal(pickLanguage(['he-IL'], codes), 'iw');
  assert.equal(pickLanguage(['zh-TW'], codes), 'zh-TW');
  assert.equal(pickLanguage(['zh-Hant-HK'], codes), 'zh-TW');
  assert.equal(pickLanguage(['zh-HK'], codes), 'zh-TW');
  assert.equal(pickLanguage(['zh'], codes), 'zh-CN');
  assert.equal(pickLanguage(['zh-Hans-SG'], codes), 'zh-CN');
  assert.equal(pickLanguage(['nb-NO'], codes), 'no');
  assert.equal(pickLanguage(['nn'], codes), 'no');
  assert.equal(pickLanguage(['fil'], codes), 'tl');
});

test('pickLanguage : rien de connu, le français', () => {
  assert.equal(pickLanguage(['xx'], codes), 'fr');
  assert.equal(pickLanguage([], codes), 'fr');
  assert.equal(pickLanguage(undefined, codes), 'fr');
  assert.equal(pickLanguage([null, 42, ''], codes), 'fr');
});

test('validLang : seulement un code de la liste', () => {
  assert.equal(validLang('en', codes), true);
  assert.equal(validLang('zh-TW', codes), true);
  assert.equal(validLang('<script>', codes), false);
  assert.equal(validLang('EN', codes), false);
  assert.equal(validLang(null, codes), false);
});

test('isRtl : arabe, hébreu, persan, ourdou, pachto', () => {
  for (const code of ['ar', 'iw', 'fa', 'ur', 'ps']) assert.equal(isRtl(code), true, code);
  for (const code of ['ku', 'fr', 'en', 'zh-CN']) assert.equal(isRtl(code), false, code);
});

test('htmlLang : codes normalisés pour l’attribut lang', () => {
  assert.equal(htmlLang('iw'), 'he');
  assert.equal(htmlLang('no'), 'nb');
  assert.equal(htmlLang('tl'), 'fil');
  assert.equal(htmlLang('zh-CN'), 'zh-Hans');
  assert.equal(htmlLang('zh-TW'), 'zh-Hant');
  assert.equal(htmlLang('fr'), 'fr');
  assert.equal(htmlLang('ceb'), 'ceb');
});

const LISTE = [{ code: 'fr', label: 'Français' }, { code: 'en', label: 'English' }, { code: 'ar', label: 'العربية' }];

test('langue de la réponse : celle de l’interface tant que le visiteur n’a rien choisi', () => {
  assert.deepEqual(responseLanguage(LISTE, null, 'en'), { code: 'en', label: 'English' });
  assert.deepEqual(responseLanguage(LISTE, undefined, 'fr'), { code: 'fr', label: 'Français' });
});

test('langue de la réponse : le choix du visiteur l’emporte sur la langue de l’interface', () => {
  assert.deepEqual(responseLanguage(LISTE, 'ar', 'en'), { code: 'ar', label: 'العربية' });
  assert.deepEqual(responseLanguage(LISTE, 'fr', 'en'), { code: 'fr', label: 'Français' });
});

test('langue de la réponse : un choix absent de la liste est abandonné', () => {
  assert.deepEqual(responseLanguage(LISTE, 'xx', 'en'), { code: 'en', label: 'English' });
  assert.deepEqual(responseLanguage(LISTE, 42, 'ar'), { code: 'ar', label: 'العربية' });
});

test('langue de la réponse : à défaut, « Français », le libellé qui ne demande aucune traduction au moteur', () => {
  assert.deepEqual(responseLanguage(LISTE, null, 'xx'), { code: 'fr', label: 'Français' });
  assert.deepEqual(responseLanguage([], 'en', 'en'), { code: 'fr', label: 'Français' });
  assert.deepEqual(responseLanguage(null, null, null), { code: 'fr', label: 'Français' });
  assert.deepEqual(responseLanguage([{ code: 'en' }, null, { code: 'ar', label: '' }], 'en', 'ar'), { code: 'fr', label: 'Français' });
});
