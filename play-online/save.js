const STORAGE_KEY = 'poke2d-community-v1';
const SAVE_PREFIX = 'P2DA1.';
const MAX_SAVE_LENGTH = 50_000;
const ARENAS = new Set(['grass', 'forest', 'seaside', 'volcano', 'ice', 'ruins']);
const DIFFICULTIES = new Set(['easy', 'normal', 'hard']);

function freezeTree(value) {
  for (const child of Object.values(value)) {
    if (child && typeof child === 'object') freezeTree(child);
  }
  return Object.freeze(value);
}

export const DEFAULT_SAVE = freezeTree({
  version: 1,
  teams: [[25, 6, 9], [3, 94, 143], [149, 212, 448]],
  selectedTeam: 0,
  arena: 'grass',
  difficulty: 'normal',
  settings: { sound: false, reducedFlash: false, largeButtons: false },
  story: { unlocked: 1, bestTimes: {} },
  wins: 0,
});

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${label} must contain plain save data.`);
  }
}

function requireFields(value, fields, label) {
  requireObject(value, label);
  const keys = Reflect.ownKeys(value);
  if (keys.length !== fields.length || !fields.every(field => Object.hasOwn(value, field))) {
    throw new TypeError(`${label} has missing or unsupported fields.`);
  }
}

function requireInteger(value, minimum, maximum, label) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(`${label} must be an integer from ${minimum} to ${maximum}.`);
  }
}

function validateSave(save) {
  requireFields(save, ['version', 'teams', 'selectedTeam', 'arena', 'difficulty', 'settings', 'story', 'wins'], 'Save');
  if (save.version !== 1) throw new TypeError('This save version is unsupported.');
  if (!Array.isArray(save.teams) || save.teams.length !== 3) {
    throw new TypeError('Save must contain exactly three teams.');
  }
  const teams = Array.from(save.teams, team => {
    if (!Array.isArray(team) || team.length !== 3 || new Set(team).size !== 3) {
      throw new TypeError('Each team must contain three different Pokémon.');
    }
    return Array.from(team, id => {
      requireInteger(id, 1, 1025, 'Pokémon number');
      return id;
    });
  });
  requireInteger(save.selectedTeam, 0, 2, 'Selected team');
  if (!ARENAS.has(save.arena)) throw new TypeError('The arena is unsupported.');
  if (!DIFFICULTIES.has(save.difficulty)) throw new TypeError('The difficulty is unsupported.');
  requireFields(save.settings, ['sound', 'reducedFlash', 'largeButtons'], 'Settings');
  if (['sound', 'reducedFlash', 'largeButtons'].some(key => typeof save.settings[key] !== 'boolean')) {
    throw new TypeError('Settings must use true or false values.');
  }
  requireFields(save.story, ['unlocked', 'bestTimes'], 'Story progress');
  requireInteger(save.story.unlocked, 1, 16, 'Unlocked story stage');
  requireObject(save.story.bestTimes, 'Story best times');
  const bestTimes = {};
  for (const key of Reflect.ownKeys(save.story.bestTimes)) {
    if (typeof key !== 'string' || !/^(?:[1-9]|1[0-6])$/u.test(key)) {
      throw new TypeError('Story best times must refer to stages 1 through 16.');
    }
    const seconds = save.story.bestTimes[key];
    if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0 || seconds > 86_400) {
      throw new TypeError('Story best times must be positive seconds within one day.');
    }
    bestTimes[key] = seconds;
  }
  requireInteger(save.wins, 0, 1_000_000_000, 'Wins');
  return {
    version: 1,
    teams,
    selectedTeam: save.selectedTeam,
    arena: save.arena,
    difficulty: save.difficulty,
    settings: {
      sound: save.settings.sound,
      reducedFlash: save.settings.reducedFlash,
      largeButtons: save.settings.largeButtons,
    },
    story: { unlocked: save.story.unlocked, bestTimes },
    wins: save.wins,
  };
}

/** Corrupt data and unavailable browser storage both recover to a fresh save. */
export function loadSave(storage) {
  try {
    const saved = (storage ?? globalThis.localStorage).getItem(STORAGE_KEY);
    if (typeof saved === 'string' && saved.length <= MAX_SAVE_LENGTH) {
      return validateSave(JSON.parse(saved));
    }
  } catch {
    // A fresh copy also lets the current session run when storage is disabled.
  }
  return validateSave(DEFAULT_SAVE);
}

/** Invalid data throws. A storage failure returns false for the caller's status UI. */
export function writeSave(save, storage) {
  const serialized = JSON.stringify(validateSave(save));
  try {
    (storage ?? globalThis.localStorage).setItem(STORAGE_KEY, serialized);
    return true;
  } catch {
    return false;
  }
}

export function exportSave(save) {
  const serialized = JSON.stringify(validateSave(save));
  const bytes = new TextEncoder().encode(serialized);
  const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
  const code = SAVE_PREFIX + btoa(binary);
  if (code.length > MAX_SAVE_LENGTH) throw new TypeError('The save code is too large.');
  return code;
}

export function importSave(text) {
  if (typeof text !== 'string' || text.length > MAX_SAVE_LENGTH) {
    throw new TypeError('Paste a save code of at most 50,000 characters.');
  }
  const code = text.trim();
  if (!code.startsWith(SAVE_PREFIX)) {
    throw new TypeError('This save code must start with P2DA1.');
  }
  let parsed;
  try {
    const encoded = code.slice(SAVE_PREFIX.length);
    const binary = atob(encoded);
    if (btoa(binary) !== encoded) throw new Error('Invalid base64');
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new TypeError('This save code is damaged or incomplete.');
  }
  return validateSave(parsed);
}
