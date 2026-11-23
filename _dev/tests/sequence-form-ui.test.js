// Formulaire du Séquenceur (ui/sequence-form.js), monté sur un faux DOM : deux modes, et ce qui part à l'envoi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './aides/faux-dom.mjs';

const dom = installFakeDom();
const { mountSequenceForm } = await import('../../assets/js/v5/ui/sequence-form.js');
const { sequenceFormState } = await import('../../assets/js/v5/lib/sequence-form.js');

function mounted(saved) {
  const state = sequenceFormState(saved);
  const sent = [];
  let changes = 0;
  const container = dom.node();
  const form = mountSequenceForm(container, { state, onChange: () => { changes += 1; }, onSubmit: (request) => sent.push(request) });
  const byId = (id) => container.find((node) => node.attrs.id === id)[0];
  const node = container.find((item) => item.tagName === 'FORM')[0];
  return {
    state, sent, form, container, byId,
    changes: () => changes,
    modes: () => container.byClass('segments__bouton'),
    panels: () => container.byClass('sequence__mode'),
    submit: () => node.dispatch('submit'),
    type(text) {
      byId('texte-sequence').value = text;
      byId('texte-sequence').dispatch('input');
    },
  };
}

test('au départ : le mode Verset, ses champs à l’écran, la zone de texte cachée', () => {
  const { modes, panels, byId } = mounted(null);
  assert.deepEqual(modes().map((button) => [button.textContent, button.attrs['aria-pressed']]), [['Verset', 'true'], ['Texte libre', 'false']]);
  assert.deepEqual(panels().map((panel) => panel.hidden), [false, true]);
  assert.equal(byId('sourate').value, '1');
  const area = byId('texte-sequence');
  assert.deepEqual([area.attrs.dir, area.attrs.lang, area.attrs.maxlength], ['rtl', 'ar', '5000']);
});

test('envoi en mode Verset : le passage choisi, et rien d’autre', () => {
  const context = mounted({ sura: 2, start: 255, end: 256 });
  const event = context.submit();
  assert.equal(event.prevented, true);
  assert.deepEqual(context.sent, [{ mode: 'verset', sura: 2, start: 255, end: 256 }]);
});

test('changer de mode montre l’autre saisie et garde le choix', () => {
  const context = mounted(null);
  context.modes()[1].click();
  assert.equal(context.state.mode, 'texte');
  assert.deepEqual(context.panels().map((panel) => panel.hidden), [true, false]);
  assert.deepEqual(context.modes().map((button) => button.attrs['aria-pressed']), ['false', 'true']);
  assert.equal(context.changes(), 1);
  assert.deepEqual(context.sent, []);
});

test('envoi en mode Texte libre : le texte tapé ; vide, rien ne part et le curseur revient dans la zone', () => {
  const context = mounted({ mode: 'texte' });
  context.submit();
  assert.deepEqual(context.sent, []);
  assert.equal(dom.focused(), context.byId('texte-sequence'));
  context.type('   ');
  context.submit();
  assert.deepEqual(context.sent, []);
  context.type('بِسْمِ ٱللَّهِ');
  assert.equal(context.state.text, 'بِسْمِ ٱللَّهِ');
  assert.equal(context.container.byClass('sequence__compteur')[0].textContent, '14 / 5000');
  context.submit();
  assert.deepEqual(context.sent, [{ mode: 'texte', text: 'بِسْمِ ٱللَّهِ' }]);
  assert.ok(context.changes() >= 2);
});

test('paint : le formulaire suit un état changé du dehors (adresse, bouton « précédent »)', () => {
  const context = mounted(null);
  Object.assign(context.state, { mode: 'texte', sura: 112, start: 2, end: 3, text: 'نص' });
  context.form.paint();
  assert.deepEqual(context.panels().map((panel) => panel.hidden), [true, false]);
  assert.equal(context.byId('texte-sequence').value, 'نص');
  assert.deepEqual([context.byId('sourate').value, context.byId('verset-debut').value, context.byId('verset-fin').value], ['112', '2', '3']);
  assert.equal(context.changes(), 0);
});
