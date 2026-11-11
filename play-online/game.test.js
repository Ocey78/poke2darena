import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseHTML } from 'linkedom';
import { DEFAULT_SAVE, exportSave, importSave } from './save.js';

test('game menus connect teams, save codes, online links and battle controls', async t => {
  const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
  const rosterUrl = new URL('../data/roster.json', import.meta.url);
  const roster = JSON.parse(await readFile(rosterUrl, 'utf8'));
  const { window, document } = parseHTML(html);
  const globalNames = ['window', 'document', 'location', 'Element', 'Image', 'localStorage', 'fetch', 'requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout'];
  const originalGlobals = new Map(globalNames.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const savedValues = new Map();
  const frames = new Map();
  const timers = new Map();
  const fetches = [];
  let nextFrame = 0;
  let nextTimer = 0;
  let now = performance.now();
  const context = new Proxy({}, { get: (target, key) => target[key] ?? (() => {}) });
  window.HTMLCanvasElement.prototype.getContext = () => context;

  Object.assign(globalThis, {
    window,
    document,
    location: new URL('https://community.example/play-online/'),
    Element: window.Element,
    Image: class { complete = false; },
    localStorage: {
      getItem: key => savedValues.get(key) ?? null,
      setItem: (key, value) => savedValues.set(key, value),
    },
    fetch: async url => {
      fetches.push(String(url));
      assert.equal(String(url), rosterUrl.href, 'The UI loads only the local roster');
      return { ok: true, json: async () => structuredClone(roster) };
    },
    requestAnimationFrame: callback => { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame: id => frames.delete(id),
    setTimeout: callback => { timers.set(++nextTimer, callback); return nextTimer; },
    clearTimeout: id => timers.delete(id),
  });

  function element(selector) {
    const found = document.querySelector(selector);
    assert.ok(found, `Expected ${selector} to be present`);
    return found;
  }

  function click(selector) {
    const target = element(selector);
    assert.equal(Boolean(target.disabled), false, `${selector} must be enabled`);
    target.dispatchEvent(new window.Event('click', { bubbles: true, cancelable: true }));
  }

  function enter(selector, value) {
    const target = element(selector);
    target.value = value;
    target.dispatchEvent(new window.Event('input', { bubbles: true }));
  }

  function chooseType(type) {
    const select = element('#type-filter');
    const option = [...select.options].find(item => item.textContent === type);
    assert.ok(option);
    // Linkedom omits the browser's fallback from an option's text to its value.
    option.value = option.getAttribute('value') ?? option.textContent;
    option.selected = true;
    select.dispatchEvent(new window.Event('change', { bubbles: true }));
  }

  function submit(selector) {
    element(selector).dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  }

  function advance(milliseconds) {
    now += milliseconds;
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach(callback => callback(now));
  }

  function pressEscape() {
    const event = new window.Event('keydown', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'key', { value: 'Escape' });
    document.dispatchEvent(event);
  }

  const persisted = () => JSON.parse(savedValues.get('poke2d-community-v1'));

  try {
    await import('./game.js');
    assert.equal(element('#screen h1').textContent, 'Main menu');
    assert.equal(fetches.length, 1);

    await t.test('typing and type filters select a unique Pokémon in the chosen team slot', () => {
      click('[data-action="teams"] strong');
      assert.equal(element('#screen h1').textContent, 'Your teams');
      assert.match(element('.roster-count').textContent, /1025 Pokémon/);
      click('[data-action="slot"][data-index="1"]');
      assert.equal(element('[data-action="slot"][data-index="1"]').getAttribute('aria-pressed'), 'true');
      const search = element('#roster-search');
      enter('#roster-search', 'squirt');
      assert.equal(element('#roster-search'), search, 'Typing keeps the same input mounted');
      assert.equal(document.querySelectorAll('.pokemon-card').length, 1);
      assert.equal(element('.pokemon-card').dataset.id, '7');
      chooseType('Fire');
      assert.equal(document.querySelectorAll('.pokemon-card').length, 0);
      assert.match(element('#roster-results').textContent, /No Pokémon match/);
      chooseType('Water');
      click('[data-action="pokemon"][data-id="7"]');
      assert.deepEqual(persisted().teams[0], [25, 7, 9]);
      assert.match(element('[data-action="slot"][data-index="1"]').textContent, /Squirtle/);
      enter('#roster-search', '#0009');
      click('[data-action="pokemon"][data-id="9"]');
      assert.deepEqual(persisted().teams[0], [25, 7, 9], 'An existing teammate cannot fill a second slot');
      assert.match(element('#toast').textContent, /already has a place/);
      click('[data-action="team"][data-index="2"]');
      assert.equal(persisted().selectedTeam, 2);
      assert.equal(element('[data-action="team"][data-index="2"]').getAttribute('aria-selected'), 'true');
      click('[data-action="menu"]');
    });

    await t.test('save-code export and restore update the live UI and preserve invalid-import recovery', () => {
      click('[data-action="saves"]');
      const existing = importSave(element('#save-code').value);
      assert.deepEqual(existing.teams[0], [25, 7, 9]);
      assert.equal(existing.selectedTeam, 2);
      const restored = structuredClone(DEFAULT_SAVE);
      restored.teams[0] = [1, 4, 7];
      restored.arena = 'ice';
      restored.difficulty = 'hard';
      restored.story = { unlocked: 3, bestTimes: { 1: 42.125, 2: 67.5 } };
      restored.wins = 5;
      enter('#import-code', exportSave(restored));
      submit('#import-form');
      assert.deepEqual(persisted(), restored);
      assert.deepEqual(importSave(element('#save-code').value), restored);
      enter('#import-code', 'P2DA1.broken');
      submit('#import-form');
      assert.match(element('#save-error').textContent, /damaged|incomplete/);
      assert.deepEqual(persisted(), restored, 'A bad code leaves the current save usable');
      click('[data-action="menu"]');
      assert.match(element('.menu-links').textContent, /5 local wins/);
      click('[data-action="teams"]');
      assert.match(element('[data-action="slot"][data-index="0"]').textContent, /Bulbasaur/);
      click('[data-action="menu"]');
      click('[data-action="story"]');
      assert.equal(element('[data-action="stage"][data-number="3"]').disabled, false);
      assert.equal(element('[data-action="stage"][data-number="4"]').disabled, true);
      assert.match(element('[data-action="stage"][data-number="1"]').textContent, /Best 0:42/);
      click('[data-action="menu"]');
    });

    await t.test('online handoff validates the official origin and retains the full private invitation', () => {
      click('[data-action="online"]');
      assert.equal(element('a[href="https://poke2darena.com/play-online/"]').getAttribute('href'), 'https://poke2darena.com/play-online/');
      const invitation = 'https://poke2darena.com/play-online/?online=1&keep=%2B#room=ABC234&k=private%2Bkey%3D';
      enter('#invite-link', invitation);
      submit('#invite-form');
      assert.equal(element('#invite-launch').hidden, false);
      assert.equal(element('#invite-launch').getAttribute('href'), invitation);
      enter('#invite-link', 'https://poke2darena.com.evil.example/play-online/#room=ABC234');
      assert.equal(element('#invite-launch').hidden, true, 'Editing a checked invitation invalidates the launch button');
      submit('#invite-form');
      assert.equal(element('#invite-launch').hidden, true);
      assert.match(element('#invite-error').textContent, /Use an invitation/);
      assert.equal(fetches.length, 1, 'Invitation handling performs no server requests');
      click('[data-action="menu"]');
    });

    await t.test('CPU battles honor setup, show pause state, resume and stop when returning to the menu', () => {
      click('[data-action="cpu"]');
      assert.equal(element('[data-action="difficulty"][data-value="hard"]').getAttribute('aria-pressed'), 'true');
      click('[data-action="difficulty"][data-value="easy"]');
      click('[data-action="arena"][data-value="forest"]');
      assert.equal(persisted().difficulty, 'easy');
      assert.equal(persisted().arena, 'forest');
      click('[data-action="start-cpu"]');
      assert.ok(element('#battle-canvas'));
      assert.equal(element('#player-name').textContent, 'Bulbasaur');
      assert.equal(frames.size, 1, 'The normal menu entry starts one animation loop');
      for (let frame = 0; frame < 40; frame++) advance(33);
      assert.notEqual(element('#battle-clock').textContent, '0:00');
      click('[data-action="pause"]');
      assert.equal(element('#battle-overlay').hidden, false);
      assert.match(element('#battle-overlay').textContent, /Paused/);
      const pausedAt = element('#battle-clock').textContent;
      for (let frame = 0; frame < 40; frame++) advance(33);
      assert.equal(element('#battle-clock').textContent, pausedAt);
      click('[data-action="resume"]');
      assert.equal(element('#battle-overlay').hidden, true);
      pressEscape();
      assert.equal(element('#battle-overlay').hidden, false);
      pressEscape();
      assert.equal(element('#battle-overlay').hidden, true);
      click('[data-action="pause"]');
      click('#battle-overlay [data-action="menu"]');
      assert.equal(element('#screen h1').textContent, 'Main menu');
      assert.equal(frames.size, 0, 'Returning to the menu destroys the battle loop');
      assert.equal(document.querySelector('#battle-canvas'), null);
      advance(500);
      assert.equal(element('#screen h1').textContent, 'Main menu');
    });
  } finally {
    frames.clear();
    timers.clear();
    for (const [name, descriptor] of originalGlobals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});
