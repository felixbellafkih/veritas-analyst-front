// Champs de verset (ui/verse-fields.js) : sourate, du verset, au verset, dix versets au plus. Montés sur un
// faux DOM. Ces champs servent à l'Interpréteur et au Séquenceur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './aides/faux-dom.mjs';

const dom = installFakeDom();
const { mountVerseFields } = await import('../../assets/js/v4/ui/verse-fields.js');

function mounted(state) {
  let changes = 0;
  const fields = mountVerseFields({ state, hint: (count) => `aide ${count}`, onChange: () => { changes += 1; } });
  const box = dom.node();
  box.append(...fields.nodes);
  const byId = (id) => box.find((node) => node.attrs.id === id)[0];
  const set = (control, value) => {
    control.value = value;
    control.dispatch('change');
  };
  return {
    state, fields, box, set,
    sura: byId('sourate'), start: byId('verset-debut'), end: byId('verset-fin'),
    hint: box.byClass('champ__aide')[0],
    changes: () => changes,
    shown: () => [byId('sourate').value, byId('verset-debut').value, byId('verset-fin').value],
  };
}

test('au départ : le passage de l’état dans les trois champs, avec leurs bornes', () => {
  const { sura, start, end, hint, shown, box, changes } = mounted({ sura: 2, start: 255, end: 255 });
  assert.deepEqual(shown(), ['2', '255', '255']);
  assert.equal(start.max, '286');
  assert.equal(end.min, '255');
  assert.equal(end.max, '264');
  assert.equal(hint.textContent, 'aide 286');
  assert.equal(sura.find((node) => node.tagName === 'OPTION').length, 114);
  assert.equal(changes(), 0);
  const labels = box.find((node) => node.tagName === 'LABEL');
  assert.deepEqual(labels.map((label) => [label.attrs.for, label.textContent]), [['sourate', 'Sourate'], ['verset-debut', 'Du verset'], ['verset-fin', 'au verset']]);
});

test('changer de sourate ramène au premier verset', () => {
  const context = mounted({ sura: 2, start: 255, end: 256 });
  context.set(context.sura, '1');
  assert.deepEqual(context.state, { sura: 1, start: 1, end: 1 });
  assert.deepEqual(context.shown(), ['1', '1', '1']);
  assert.equal(context.hint.textContent, 'aide 7');
  assert.equal(context.end.max, '7');
  assert.equal(context.changes(), 1);
});

test('un premier verset au-delà du dernier tire le dernier', () => {
  const context = mounted({ sura: 1, start: 1, end: 3 });
  context.set(context.start, '5');
  assert.deepEqual(context.state, { sura: 1, start: 5, end: 5 });
  assert.deepEqual(context.shown(), ['1', '5', '5']);
  assert.equal(context.changes(), 1);
});

test('le dernier verset est borné à la sourate, et à dix versets', () => {
  const short = mounted({ sura: 1, start: 1, end: 1 });
  short.set(short.end, '99');
  assert.deepEqual(short.state, { sura: 1, start: 1, end: 7 });
  const long = mounted({ sura: 2, start: 5, end: 5 });
  long.set(long.end, '30');
  assert.deepEqual(long.state, { sura: 2, start: 5, end: 14 });
  assert.deepEqual(long.shown(), ['2', '5', '14']);
});

test('une valeur qui n’est pas un nombre : le passage revient dans ses bornes, les champs aussi', () => {
  const context = mounted({ sura: 2, start: 255, end: 255 });
  context.set(context.start, 'abc');
  assert.deepEqual(context.state, { sura: 2, start: 1, end: 10 });
  assert.deepEqual(context.shown(), ['2', '1', '10']);
  context.set(context.end, '');
  assert.deepEqual(context.state, { sura: 2, start: 1, end: 1 });
  context.set(context.start, '0');
  assert.deepEqual(context.state, { sura: 2, start: 1, end: 1 });
});

test('paint : les champs suivent un état changé du dehors', () => {
  const context = mounted({ sura: 1, start: 1, end: 1 });
  Object.assign(context.state, { sura: 112, start: 2, end: 4 });
  context.fields.paint();
  assert.deepEqual(context.shown(), ['112', '2', '4']);
  assert.equal(context.hint.textContent, 'aide 4');
  assert.equal(context.changes(), 0);
});

test('setDisabled : les trois champs se verrouillent ensemble', () => {
  const context = mounted({ sura: 1, start: 1, end: 1 });
  context.fields.setDisabled(true);
  assert.deepEqual([context.sura.disabled, context.start.disabled, context.end.disabled], [true, true, true]);
  context.fields.setDisabled(false);
  assert.deepEqual([context.sura.disabled, context.start.disabled, context.end.disabled], [false, false, false]);
});
