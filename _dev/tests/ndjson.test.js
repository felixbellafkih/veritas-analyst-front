import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readOutcome } from '../../assets/js/v6/lib/ndjson.js';

async function* from(items) {
  for (const item of items) yield item;
}

test('des ping, puis le résultat', async () => {
  let pings = 0;
  const outcome = await readOutcome(from(['{"type":"ping"}\n', '{"type":"ping"}\n{"type":"result","result":"R"}\n']), { onPing: () => { pings += 1; } });
  assert.deepEqual(outcome, { type: 'result', result: 'R' });
  assert.equal(pings, 2);
});

test('sans onPing, les ping sont simplement ignorés', async () => {
  assert.deepEqual(await readOutcome(from(['{"type":"ping"}\n{"type":"result","result":"R"}\n'])), { type: 'result', result: 'R' });
});

test('ligne coupée entre deux morceaux, sans retour final', async () => {
  assert.deepEqual(await readOutcome(from(['{"type":"res', 'ult","result":"R"}'])), { type: 'result', result: 'R' });
});

test('octets coupés au milieu d’un caractère arabe', async () => {
  const bytes = new TextEncoder().encode('{"type":"result","result":"بِسْمِ"}\n');
  const cut = bytes.findIndex((byte) => byte >= 0x80) + 1; // entre les deux octets du premier caractère arabe
  assert.ok(cut > 1 && bytes[cut] >= 0x80);
  const outcome = await readOutcome(from([bytes.slice(0, cut), bytes.slice(cut)]));
  assert.deepEqual(outcome, { type: 'result', result: 'بِسْمِ' });
});

test('un octet à la fois', async () => {
  const bytes = new TextEncoder().encode('{"type":"ping"}\n{"type":"result","result":"ٱلرَّحْمَٰنِ"}\n');
  const outcome = await readOutcome(from([...bytes].map((byte) => Uint8Array.of(byte))));
  assert.deepEqual(outcome, { type: 'result', result: 'ٱلرَّحْمَٰنِ' });
});

test('ligne error', async () => {
  assert.deepEqual(await readOutcome(from(['{"type":"error","detail":"D"}\n'])), { type: 'error', detail: 'D' });
});

test('flux terminé sans résultat : coupure', async () => {
  assert.deepEqual(await readOutcome(from(['{"type":"ping"}\n'])), { type: 'cut' });
  assert.deepEqual(await readOutcome(from([])), { type: 'cut' });
});

test('flux qui casse en route : coupure', async () => {
  async function* broken() {
    yield '{"type":"ping"}\n';
    throw new Error('terminated');
  }
  assert.deepEqual(await readOutcome(broken()), { type: 'cut' });
});

test('une ligne illisible est ignorée', async () => {
  assert.deepEqual(await readOutcome(from(['pas du json\n', '\n', '42\n', '{"type":"result","result":"R"}\n'])), { type: 'result', result: 'R' });
});

test('un résultat qui n’est pas un texte est ignoré', async () => {
  assert.deepEqual(await readOutcome(from(['{"type":"result","result":null}\n'])), { type: 'cut' });
});

test('les lignes qui suivent le résultat sont ignorées', async () => {
  assert.deepEqual(await readOutcome(from(['{"type":"result","result":"R"}\n{"type":"error","detail":"D"}\n'])), { type: 'result', result: 'R' });
});

test('fins de ligne Windows', async () => {
  assert.deepEqual(await readOutcome(from(['{"type":"ping"}\r\n{"type":"result","result":"R"}\r\n'])), { type: 'result', result: 'R' });
});
