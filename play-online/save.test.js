import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SAVE, loadSave, writeSave, exportSave, importSave } from './save.js';

const KEY = 'poke2d-community-v1';
const freshSave = () => structuredClone(DEFAULT_SAVE);
const encode = save => 'P2DA1.' + Buffer.from(JSON.stringify(save), 'utf8').toString('base64');

function memoryStorage(initial = new Map()) {
  return {
    values: initial,
    getItem(key) { return initial.get(key) ?? null; },
    setItem(key, value) { initial.set(key, value); },
  };
}

test('save round trip preserves teams, preferences and fractional story times', () => {
  const save = freshSave();
  save.teams[2] = [1025, 1, 999];
  save.selectedTeam = 2;
  save.arena = 'ruins';
  save.difficulty = 'hard';
  save.settings.sound = true;
  save.settings.largeButtons = true;
  save.story = { unlocked: 16, bestTimes: { 1: 32.125, 16: 402.5 } };
  save.wins = 24;
  const storage = memoryStorage();
  assert.equal(writeSave(save, storage), true);
  assert.deepEqual(loadSave(storage), save);
  const code = exportSave(save);
  assert.ok(code.startsWith('P2DA1.'));
  assert.deepEqual(importSave(`  ${code}\n`), save);
});

test('fresh and corrupt loads return independent mutable defaults', () => {
  for (const raw of [null, '', '{', 'null', '[]', '{}', 'x'.repeat(50_001)]) {
    const loaded = loadSave(memoryStorage(new Map([[KEY, raw]])));
    assert.deepEqual(loaded, DEFAULT_SAVE);
    loaded.teams[0][0] = 1;
    loaded.settings.sound = true;
    loaded.story.bestTimes['1'] = 20;
    assert.equal(DEFAULT_SAVE.teams[0][0], 25);
    assert.equal(DEFAULT_SAVE.settings.sound, false);
    assert.deepEqual(DEFAULT_SAVE.story.bestTimes, {});
  }
  assert.ok(Object.isFrozen(DEFAULT_SAVE.teams[0]));
});

test('disabled storage is recoverable and only the community key is accessed', () => {
  const inaccessible = {
    getItem() { throw new Error('Storage disabled'); },
    setItem() { throw new Error('Quota reached'); },
  };
  assert.deepEqual(loadSave(inaccessible), DEFAULT_SAVE);
  assert.equal(writeSave(freshSave(), inaccessible), false);
  const storage = memoryStorage(new Map([['poke2d.original', 'untouched']]));
  assert.equal(writeSave(freshSave(), storage), true);
  assert.deepEqual([...storage.values.keys()].sort(), [KEY, 'poke2d.original'].sort());
  assert.equal(storage.values.get('poke2d.original'), 'untouched');
});

test('storage accessor failures are also recoverable with omitted storage', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Blocked'); } });
  try {
    assert.deepEqual(loadSave(), DEFAULT_SAVE);
    assert.equal(writeSave(freshSave()), false);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});

test('invalid roster IDs, duplicate teammates and wrong team counts are rejected', () => {
  const invalidTeams = [
    [[0, 6, 9], [3, 94, 143], [149, 212, 448]],
    [[1026, 6, 9], [3, 94, 143], [149, 212, 448]],
    [[25.5, 6, 9], [3, 94, 143], [149, 212, 448]],
    [['25', 6, 9], [3, 94, 143], [149, 212, 448]],
    [[25, 25, 9], [3, 94, 143], [149, 212, 448]],
    [[25, 6], [3, 94, 143], [149, 212, 448]],
    [[25, 6, 9], [3, 94, 143]],
    new Array(3),
  ];
  for (const teams of invalidTeams) {
    const save = { ...freshSave(), teams };
    assert.throws(() => exportSave(save), TypeError);
    assert.throws(() => importSave(encode(save)), TypeError);
  }
});

test('unsupported versions, options, unknown fields and missing fields are rejected', () => {
  const mutations = [
    save => { save.version = 2; },
    save => { save.selectedTeam = 3; },
    save => { save.arena = 'random'; },
    save => { save.difficulty = 'impossible'; },
    save => { save.settings.sound = 1; },
    save => { save.settings.remote = true; },
    save => { save.extra = 'ignored'; },
    save => { delete save.settings.largeButtons; },
    save => { save.wins = -1; },
    save => { save.wins = 1_000_000_001; },
  ];
  for (const mutate of mutations) {
    const save = freshSave();
    mutate(save);
    assert.throws(() => importSave(encode(save)), TypeError);
    assert.throws(() => writeSave(save, memoryStorage()), TypeError);
    assert.deepEqual(loadSave(memoryStorage(new Map([[KEY, JSON.stringify(save)]]))), DEFAULT_SAVE);
  }
});

test('malformed progression cannot enter imports or persisted state', () => {
  const stories = [
    { unlocked: 0, bestTimes: {} }, { unlocked: 17, bestTimes: {} },
    { unlocked: 2.5, bestTimes: {} }, { unlocked: 1, bestTimes: [] },
    { unlocked: 1, bestTimes: { 0: 2 } }, { unlocked: 16, bestTimes: { 17: 2 } },
    { unlocked: 2, bestTimes: { '01': 2 } }, { unlocked: 2, bestTimes: { 1: 0 } },
    { unlocked: 2, bestTimes: { 1: -1 } }, { unlocked: 2, bestTimes: { 1: 86_401 } },
    { unlocked: 2, bestTimes: { 1: '12' } },
    { unlocked: 2, bestTimes: JSON.parse('{"__proto__":1}') },
  ];
  for (const story of stories) {
    const save = { ...freshSave(), story };
    assert.throws(() => importSave(encode(save)), TypeError);
    assert.deepEqual(loadSave(memoryStorage(new Map([[KEY, JSON.stringify(save)]]))), DEFAULT_SAVE);
  }
  const save = freshSave();
  save.story.bestTimes['1'] = Infinity;
  assert.throws(() => exportSave(save), TypeError);
});

test('damaged, oversized, non-UTF8 and unsupported encoded input is rejected', () => {
  for (const value of [null, {}, 123, '', 'P2DA2.e30=', 'P2DA1.%', 'P2DA1.', 'P2DA1.e30', 'P2DA1./w==', 'x'.repeat(50_001)]) {
    assert.throws(() => importSave(value), TypeError);
  }
  assert.throws(() => importSave('P2DA1.' + Buffer.from('invalid JSON').toString('base64')), TypeError);
});
