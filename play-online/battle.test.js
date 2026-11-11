import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDamage, canvasPoint, createFighter, moveFighter, startBattle, typeMultiplier } from './battle.js';

const specimen = { id: 1, name: 'Test', types: ['Grass', 'Poison'], stats: { hp: 60, atk: 65, def: 70, spa: 80, spd: 70, spe: 60 } };

test('type effectiveness combines both defender types and respects immunities', () => {
  assert.equal(typeMultiplier('Ice', ['Ground', 'Flying']), 4);
  assert.equal(typeMultiplier('Electric', ['Water', 'Ground']), 0);
  assert.equal(typeMultiplier('Fighting', ['Poison', 'Flying']), 0.25);
  assert.equal(typeMultiplier('unknown', ['Water']), 1);
});

test('fighter state is independent from saved team records and sibling fighters', () => {
  const first = createFighter(specimen);
  const second = createFighter(specimen);
  first.hp = 0;
  first.cooldowns[0] = 4;
  assert.ok(second.hp > 0);
  assert.equal(second.cooldowns[0], 0);
  assert.deepEqual(specimen.types, ['Grass', 'Poison']);
  assert.equal(createFighter({ name: 'Old save', stats: { hp: 'invalid' } }).maxHp, 268);
});

test('immune targets take zero damage and defensive stats reduce hits', () => {
  const attacker = createFighter(specimen);
  const target = createFighter({ ...specimen, types: ['Ghost'] });
  assert.equal(calculateDamage(attacker, target, 30, 'normal'), 0);
  target.types = ['normal'];
  const baseline = calculateDamage(attacker, target, 30, 'water');
  target.defense = 200;
  assert.ok(calculateDamage(attacker, target, 30, 'water') < baseline);
});

test('movement stays in bounds and pushes overlapping fighters outside pillars', () => {
  const fighter = createFighter(specimen);
  fighter.x = 100;
  fighter.y = 100;
  const bounds = { left: 0, top: 0, right: 300, bottom: 200 };
  moveFighter(fighter, -1000, 1000, [], bounds);
  assert.equal(fighter.x, fighter.radius);
  assert.equal(fighter.y, 200 - fighter.radius);
  fighter.x = 100;
  fighter.y = 100;
  moveFighter(fighter, 0, 0, [{ x: 100, y: 100, radius: 25 }], bounds);
  assert.equal(Math.hypot(fighter.x - 100, fighter.y - 100), 45);
});

test('pointer coordinates follow the contained canvas across both letterbox directions', () => {
  const wide = { left: 100, top: 40, width: 1200, height: 625 };
  assert.deepEqual(canvasPoint(wide, 200, 40), { x: 0, y: 0 });
  assert.deepEqual(canvasPoint(wide, 700, 352.5), { x: 500, y: 312.5 });
  assert.equal(canvasPoint(wide, 150, 100), null);
  const tall = { left: 20, top: 30, width: 500, height: 500 };
  assert.deepEqual(canvasPoint(tall, 20, 123.75), { x: 0, y: 0 });
  assert.deepEqual(canvasPoint(tall, 520, 436.25), { x: 1000, y: 625 });
  assert.equal(canvasPoint(tall, 100, 80), null);
  assert.equal(canvasPoint({ left: 0, top: 0, width: 0, height: 0 }, 0, 0), null);
});

test('battle pause, cooldowns, switching and teardown preserve a single active session', () => {
  const original = new Map(['window', 'document', 'Image', 'requestAnimationFrame', 'cancelAnimationFrame'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  class Surface extends EventTarget {
    listeners = new Set();
    addEventListener(event, listener, options) {
      this.listeners.add(listener);
      super.addEventListener(event, listener, options);
    }
    removeEventListener(event, listener, options) {
      this.listeners.delete(listener);
      super.removeEventListener(event, listener, options);
    }
  }
  const windowSurface = new Surface();
  const documentSurface = new Surface();
  const canvas = new Surface();
  const context = new Proxy({}, { get: (object, key) => object[key] || (() => {}) });
  canvas.getContext = () => context;
  canvas.setAttribute = () => {};
  const frames = new Map();
  let sequence = 0;
  globalThis.window = windowSurface;
  globalThis.document = documentSurface;
  globalThis.Image = class { complete = false; };
  globalThis.requestAnimationFrame = callback => { frames.set(++sequence, callback); return sequence; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  let now = performance.now();
  const updates = [];
  let controller;
  const advance = milliseconds => {
    now += milliseconds;
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach(callback => callback(now));
  };
  try {
    controller = startBattle({ canvas, team: [specimen, { ...specimen, name: 'Second' }], enemies: [specimen], onUpdate: state => updates.push(state) });
    assert.equal(controller.cast(0), true);
    assert.equal(controller.cast(0), false);
    windowSurface.dispatchEvent(new Event('blur'));
    assert.equal(updates.at(-1).paused, true, 'Window blur publishes a paused state for the UI overlay');
    const stoppedAt = updates.at(-1).elapsed;
    for (let i = 0; i < 12; i++) advance(16);
    assert.equal(updates.at(-1).elapsed, stoppedAt);
    assert.equal(controller.cast(1), false);
    assert.equal(controller.switchTo(1), false);
    controller.resume();
    assert.equal(controller.switchTo(1), true);
    assert.equal(updates.at(-1).player.name, 'Second');
    assert.equal(controller.switchTo(0), false);
    for (let i = 0; i < 40; i++) advance(16);
    assert.ok(updates.at(-1).elapsed > 0);
    assert.equal(frames.size, 1);
    controller.destroy();
    controller.destroy();
    assert.equal(frames.size, 0);
    assert.equal(windowSurface.listeners.size, 0);
    assert.equal(documentSurface.listeners.size, 0);
    assert.equal(canvas.listeners.size, 0);
    assert.equal(controller.cast(0), false);
    const results = [];
    const callbackOrder = [];
    const fragile = { ...specimen, stats: { hp: 1, atk: 1, def: 1, spa: 1, spd: 1, spe: 1 } };
    const strong = { ...specimen, stats: { hp: 255, atk: 255, def: 255, spa: 255, spd: 255, spe: 255 } };
    controller = startBattle({
      canvas, team: [fragile], enemies: [strong], difficulty: 'hard',
      onUpdate: state => { updates.push(state); callbackOrder.push('update'); },
      onEnd: result => { results.push(result); callbackOrder.push('end'); }
    });
    for (let i = 0; i < 5000 && results.length === 0; i++) advance(33);
    assert.equal(results.length, 1, 'The CPU completes a match against an idle player');
    assert.equal(results[0].won, false);
    assert.ok(results[0].elapsed > 0);
    assert.equal(updates.at(-1).player.hp, 0);
    assert.equal(updates.at(-1).ended, true);
    assert.equal(callbackOrder.at(-1), 'end', 'The final state must be published before the result callback');
    assert.equal(frames.size, 0);
    const updateCount = updates.length;
    controller.resume();
    controller.cast(4);
    advance(100);
    assert.equal(updates.length, updateCount, 'An ended battle never continues simulation');
  } finally {
    controller?.destroy();
    for (const [key, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
