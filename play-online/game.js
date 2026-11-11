import { startBattle } from './battle.js';
import { loadSave, writeSave, exportSave, importSave } from './save.js';
import { ONLINE_STATUS, createOfficialPlayLink } from '../online.js';

const screen = document.querySelector('#screen');
const notice = document.querySelector('#toast');
const TYPES = {
  Normal: '#8f8f71', Fire: '#c76c32', Water: '#447dca', Electric: '#b59a22', Grass: '#559a43',
  Ice: '#4dabae', Fighting: '#b94a40', Poison: '#9855b1', Ground: '#b59655', Flying: '#8a7cc9',
  Psychic: '#cb5079', Bug: '#889d32', Rock: '#9b8d44', Ghost: '#70609c', Dragon: '#7558bf',
  Dark: '#746252', Steel: '#8b8eaa', Fairy: '#c476ab',
};
const ARENAS = ['grass', 'forest', 'seaside', 'volcano', 'ice', 'ruins'];
const LOCAL_SPRITES = new Set([3, 6, 9, 25, 65, 68, 94, 123, 143, 149, 212, 448]);
const STAGES = [
  ['First steps', [1, 4, 7], 'grass'], ['Static field', [25, 81, 100], 'grass'],
  ['Among the trees', [12, 123, 214], 'forest'], ['Forest guardian', [3, 254, 389], 'forest'],
  ['Low tide', [54, 72, 90], 'seaside'], ['Open water', [9, 130, 131], 'seaside'],
  ['Cinder path', [37, 58, 126], 'volcano'], ['Firebreak', [6, 59, 467], 'volcano'],
  ['Snow drift', [86, 220, 361], 'ice'], ['Deep freeze', [91, 471, 473], 'ice'],
  ['Lost courtyard', [74, 95, 111], 'ruins'], ['Ancient sentries', [142, 248, 376], 'ruins'],
  ['Moonlit garden', [35, 196, 700], 'forest'], ['Ghost lights', [94, 354, 429], 'ruins'],
  ['Dragon road', [149, 373, 445], 'volcano'], ['Arena champion', [448, 6, 150], 'grass'],
];
let save = loadSave();
let roster = [];
let byId = new Map();
let battle = null;
let lastBattle = null;
let activeScreen = 'menu';
let selectedSlot = 0;
let rosterQuery = '';
let rosterType = '';
let rosterPage = 0;
let toastTimer;
let lastBattleState;
let inspectedId = 25;

const escape = (value) => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const title = (value) => value.charAt(0).toUpperCase() + value.slice(1);
const time = (seconds) => `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
const sprite = (id) => LOCAL_SPRITES.has(id) ? new URL(`../assets/sprites/${id}.png`, import.meta.url).href : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
const badges = (pokemon) => pokemon.types.map(type => `<span class="type" style="--type:${TYPES[type]}">${type}</span>`).join('');
const record = (id) => ({ ...byId.get(id), sprite: sprite(id) });

function toast(message) {
  clearTimeout(toastTimer);
  notice.textContent = message;
  notice.hidden = false;
  toastTimer = setTimeout(() => { notice.hidden = true; }, 4500);
}

function persist() {
  try {
    if (!writeSave(save)) toast('Storage is unavailable. Export your save before closing this tab.');
  } catch {
    toast('Your save could not be written. Export it before closing this tab.');
  }
}

function setScreen(name, html) {
  battle?.destroy();
  battle = null;
  lastBattleState = null;
  activeScreen = name;
  screen.innerHTML = html;
  screen.removeAttribute('aria-live');
  const heading = screen.querySelector('h1');
  if (heading) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
}

function panel(name, heading, content, small = false) {
  setScreen(name, `<div class="panel-screen"><section class="panel ${small ? 'small' : ''}">
    <header class="panel-header"><h1>${heading}</h1><button class="back-button" data-action="menu">← Back</button></header>
    <div class="panel-body">${content}</div></section></div>`);
}

function menu() {
  setScreen('menu', `<span class="build-label">Unofficial fan game · Community build</span><div class="game-menu">
    <div class="game-scene" aria-hidden="true"><div class="pokemon-formation">${[25,143,149,9,94,6,448,3,65].map(id => `<img src="${sprite(id)}" alt="">`).join('')}</div><div class="wordmark"><strong>POKE2D</strong><strong>ARENA</strong><span>REAL-TIME ARENA</span></div></div>
    <div><section class="menu-panel"><h1 class="panel-title">Main menu</h1><div class="menu-buttons">
      <button class="menu-button featured" data-action="quick"><strong>Quick Battle</strong><small>Your 3 vs rival 3</small></button>
      <button class="menu-button" data-action="cpu"><strong>Vs CPU</strong><small>Pick difficulty</small></button>
      <button class="menu-button" data-action="story"><strong>Story Mode</strong><small>Choose a challenge</small></button>
      <button class="menu-button" data-action="teams"><strong>Your Teams</strong><small>Build your team</small></button>
      <button class="menu-button" data-action="online"><strong>Online ↗</strong><small>Open the official game</small></button>
      <button class="menu-button" data-action="settings"><strong>Settings</strong><small>Audio &amp; controls</small></button>
      <div class="menu-tools"><button data-action="pokedex">Pokédex</button><button data-action="saves">Save code</button><button data-action="fullscreen">Full screen</button></div>
    </div></section><div class="menu-links"><a href="../">← Website</a><span>${save.wins} local wins</span><a href="../guides/">Controls</a></div></div>
  </div>`);
}

function teamSlots() {
  return save.teams[save.selectedTeam].map((id, index) => {
    const pokemon = byId.get(id);
    return `<button class="team-slot ${index === selectedSlot ? 'active' : ''}" data-action="slot" data-index="${index}" aria-pressed="${index === selectedSlot}"><span class="slot-key">${index + 1}</span><img src="${sprite(id)}" alt=""><strong>${escape(pokemon.name)}</strong><span>${badges(pokemon)}</span></button>`;
  }).join('');
}

function rosterControls() {
  return `<div class="toolbar"><input id="roster-search" type="search" placeholder="Name or Pokédex number…" value="${escape(rosterQuery)}" aria-label="Search Pokémon"><select id="type-filter" aria-label="Filter by type"><option value="">All types</option>${Object.keys(TYPES).map(type => `<option ${type === rosterType ? 'selected' : ''}>${type}</option>`).join('')}</select></div><div id="roster-results"></div>`;
}

function renderRoster() {
  const matches = roster.filter(pokemon => (!rosterType || pokemon.types.includes(rosterType)) &&
    (!rosterQuery || pokemon.name.toLowerCase().includes(rosterQuery.toLowerCase()) || String(pokemon.id) === rosterQuery.replace(/^#?0*/, '')));
  const totalPages = Math.max(1, Math.ceil(matches.length / 42));
  rosterPage = Math.min(rosterPage, totalPages - 1);
  const selected = save.teams[save.selectedTeam];
  const target = document.querySelector('#roster-results');
  if (!target) return;
  target.innerHTML = `<p class="roster-count" role="status">${matches.length} Pokémon · page ${rosterPage + 1} of ${totalPages}</p><div class="roster">${matches.slice(rosterPage * 42, (rosterPage + 1) * 42).map(pokemon => `<button class="pokemon-card ${activeScreen === 'teams' && selected.includes(pokemon.id) ? 'selected' : ''}" data-action="pokemon" data-id="${pokemon.id}" aria-label="${activeScreen === 'teams' ? 'Choose' : 'Inspect'} ${escape(pokemon.name)}"><small>#${String(pokemon.id).padStart(4, '0')}</small><img src="${sprite(pokemon.id)}" alt="" loading="lazy"><strong>${escape(pokemon.name)}</strong></button>`).join('')}</div>
    ${matches.length === 0 ? '<p class="prose">No Pokémon match this search. Try another name or type.</p>' : ''}
    <div class="pagination"><button class="pixel-button" data-action="page" data-offset="-1" ${rosterPage === 0 ? 'disabled' : ''}>← Prev</button><span>${rosterPage + 1} / ${totalPages}</span><button class="pixel-button" data-action="page" data-offset="1" ${rosterPage >= totalPages - 1 ? 'disabled' : ''}>Next →</button></div>`;
}

function teams() {
  panel('teams', 'Your teams', `<div class="tabs" role="tablist" aria-label="Saved teams">${[0,1,2].map(index => `<button class="pixel-button" role="tab" aria-selected="${index === save.selectedTeam}" data-action="team" data-index="${index}">Team ${index + 1}</button>`).join('')}</div>
    <div class="team-slots">${teamSlots()}</div>
    <div class="toolbar"><p class="prose">Choose a slot, then choose a Pokémon.</p><button class="pixel-button" data-action="random-team">Randomize</button><button class="pixel-button primary" data-action="quick">Battle with this team</button></div>
    ${rosterControls()}`);
  renderRoster();
}

function pokedex() {
  const pokemon = byId.get(inspectedId);
  panel('pokedex', 'Pokédex', `<div id="pokemon-detail" class="pokemon-detail"><img src="${sprite(pokemon.id)}" alt="${escape(pokemon.name)}" width="96" height="96" style="image-rendering:pixelated;float:left;margin-right:18px"><h2>${escape(pokemon.name)} <small>#${pokemon.id}</small></h2><p>${badges(pokemon)}</p><p class="subtle">${Object.entries(pokemon.stats).map(([name,value]) => `${name.toUpperCase()} ${value}`).join(' · ')}</p><div style="clear:both"></div></div>${rosterControls()}`);
  renderRoster();
}

function cpu() {
  panel('cpu', 'Vs CPU', `<h2>Choose your challenge</h2><div class="choice-grid">${['easy','normal','hard'].map(level => `<button class="pixel-button" data-action="difficulty" data-value="${level}" aria-pressed="${save.difficulty === level}">${title(level)}</button>`).join('')}</div>
    <h2>Choose your arena</h2><div class="choice-grid">${ARENAS.map(arena => `<button class="pixel-button arena-choice" data-action="arena" data-value="${arena}" aria-pressed="${save.arena === arena}">${title(arena)}</button>`).join('')}</div>
    <div class="team-slots">${teamSlots()}</div><div class="toolbar"><button class="pixel-button" data-action="teams">Change team</button><button class="pixel-button primary" data-action="start-cpu">Start battle ▶</button></div>`, true);
}

function story() {
  panel('story', 'Story challenges', `<p>Sixteen local arena challenges. Win to unlock the next stage, then return to beat your best time.</p><div class="story-grid">${STAGES.map(([name, , arena], index) => {
    const number = index + 1;
    const best = save.story.bestTimes[String(number)];
    return `<button class="story-stage ${best ? 'complete' : ''}" data-action="stage" data-number="${number}" ${number > save.story.unlocked ? 'disabled' : ''}><strong>${String(number).padStart(2,'0')}</strong><span>${name}</span><small>${best ? `Best ${time(best)}` : number > save.story.unlocked ? 'Locked' : title(arena)}</small></button>`;
  }).join('')}</div>`);
}

function online() {
  panel('online', 'Online', `<p>Play against friends in the official Poke2D Arena rooms.</p>
    <div class="online-status"><strong>Continue on poke2darena.com</strong><p>${ONLINE_STATUS.detail}</p></div>
    <a class="button primary" href="${createOfficialPlayLink()}">Open official online game ↗</a>
    <p>Choose <strong>ONLINE</strong> from its main menu to create or join a room.</p><p class="subtle">Your official teams and saves stay with the official game. Local teams and challenge progress from this build remain here.</p>
    <form class="invite-form" id="invite-form"><label for="invite-link">Already have a private invitation?</label><input type="url" id="invite-link" placeholder="https://poke2darena.com/play-online/…" autocomplete="off" spellcheck="false" required><button class="pixel-button" type="submit">Check invitation</button><p id="invite-error" class="field-error" role="status"></p><a id="invite-launch" class="button primary" hidden>Join on the official game ↗</a></form>`, true);
}

function settings() {
  panel('settings', 'Settings', `<div class="settings-row"><label for="sound">Battle sound effects</label><input type="checkbox" id="sound" data-setting="sound" ${save.settings.sound ? 'checked' : ''}></div>
    <div class="settings-row"><label for="reducedFlash">Reduce flashing effects</label><input type="checkbox" id="reducedFlash" data-setting="reducedFlash" ${save.settings.reducedFlash ? 'checked' : ''}></div>
    <div class="settings-row"><label for="largeButtons">Larger touch attack buttons</label><input type="checkbox" id="largeButtons" data-setting="largeButtons" ${save.settings.largeButtons ? 'checked' : ''}></div>
    <h2>Battle controls</h2><div class="controls-grid"><span><kbd>WASD</kbd> / <kbd>↑↓←→</kbd> Move</span><span><kbd>Mouse</kbd> Aim</span><span><kbd>Left click</kbd> Basic attack</span><span><kbd>Right click</kbd> Skill</span><span><kbd>Space</kbd> Dash</span><span><kbd>Q</kbd> Heavy attack</span><span><kbd>E</kbd> Ultimate</span><span><kbd>R</kbd> / <kbd>1–3</kbd> Switch</span><span><kbd>Esc</kbd> Pause / resume</span></div><p class="subtle">On touch screens, move with the left joystick, tap the arena to aim and use the attack buttons.</p>
    <h2>Your local progress</h2><div class="toolbar"><button class="pixel-button" data-action="saves">Save codes &amp; backup</button><button class="pixel-button" data-action="fullscreen">Toggle full screen</button></div><a class="prose" href="../about/">About this build &amp; credits →</a>`, true);
}

function saves() {
  panel('saves', 'Save code', `<p>Copy your local save to move teams, settings and challenge progress to another browser. This code works with this community build.</p>
    <label for="save-code">Your save code</label><textarea class="save-field" id="save-code" readonly spellcheck="false">${escape(exportSave(save))}</textarea>
    <div class="toolbar"><button class="pixel-button" data-action="copy-save">Copy code</button><button class="pixel-button" data-action="download-save">Download backup</button></div>
    <form id="import-form"><label for="import-code">Restore from a saved code</label><textarea id="import-code" class="save-field" maxlength="50000" placeholder="Paste a community save code…" spellcheck="false" required></textarea><p class="subtle">Restoring replaces the local teams, settings and progress in this browser.</p><button class="pixel-button primary" type="submit">Restore save</button><p id="save-error" class="field-error" role="status"></p></form>`, true);
}

function randomTeam() {
  const ids = new Set();
  while (ids.size < 3) ids.add(roster[Math.floor(Math.random() * roster.length)].id);
  return [...ids];
}

function launchBattle({ difficulty = 'normal', stage = null, enemies = randomTeam(), arena = save.arena } = {}) {
  lastBattle = { difficulty, stage, enemies, arena };
  const selected = save.teams[save.selectedTeam];
  setScreen('battle', `<section class="battle-screen"><header class="battle-header"><div class="fighter-info"><strong id="player-name">You</strong><div class="health-bar"><span id="player-hp-bar"></span></div><span class="health-text" id="player-hp"></span></div><div class="battle-center"><span class="battle-clock" id="battle-clock">0:00</span><button class="pixel-button" data-action="pause">Pause</button></div><div class="fighter-info enemy"><strong id="enemy-name">CPU</strong><div class="health-bar"><span id="enemy-hp-bar"></span></div><span class="health-text" id="enemy-hp"></span></div></header>
    <div class="canvas-wrap"><canvas id="battle-canvas" width="1000" height="625">Your browser needs canvas support to play arena battles.</canvas></div>
    <div class="battle-help">WASD move · Mouse aim · Click attack · Space dash · Q / E skills · R switch</div>
    <div class="joystick" id="joystick" aria-label="Touch movement joystick"><span></span></div>
    <footer class="battle-bottom ${save.settings.largeButtons ? 'large' : ''}"><div class="battle-team">${selected.map((id,index) => `<button data-action="switch" data-index="${index}" id="switch-${index}" aria-label="Switch to ${escape(byId.get(id).name)}"><small>${index+1}</small><img src="${sprite(id)}" alt=""><span class="mini-health"><i id="mini-health-${index}"></i></span></button>`).join('')}</div>
    <div class="skills">${[['LMB','Basic'],['RMB','Skill'],['Space','Dash'],['Q','Heavy'],['E','Ultimate']].map(([key,name],index) => `<button class="skill-button ${index === 4 ? 'ultimate' : ''}" data-action="cast" data-slot="${index}" id="skill-${index}" aria-label="${name}"><strong>${key}</strong>${name}<span class="cooldown" id="cooldown-${index}" hidden></span></button>`).join('')}</div></footer><div id="battle-overlay" class="battle-overlay" hidden></div></section>`);
  try {
    battle = startBattle({ canvas: document.querySelector('#battle-canvas'), team: selected.map(record), enemies: enemies.map(record), difficulty, arena, settings: save.settings, onUpdate: updateBattle, onEnd: endBattle });
    bindJoystick();
    document.querySelector('#battle-canvas').focus({ preventScroll: true });
  } catch (error) {
    menu();
    toast(error.message || 'This browser could not start the arena.');
  }
}

function updateBattle(state) {
  if (activeScreen !== 'battle') return;
  lastBattleState = state;
  for (const side of ['player','enemy']) {
    const fighter = state[side];
    document.querySelector(`#${side}-name`).textContent = fighter.name;
    document.querySelector(`#${side}-hp`).textContent = `${Math.ceil(fighter.hp)} / ${fighter.maxHp}`;
    document.querySelector(`#${side}-hp-bar`).style.width = `${100 * fighter.hp / fighter.maxHp}%`;
  }
  document.querySelector('#battle-clock').textContent = time(state.elapsed);
  state.player.team.forEach((pokemon,index) => {
    const button = document.querySelector(`#switch-${index}`);
    button.classList.toggle('active', index === state.player.index);
    button.disabled = pokemon.hp <= 0 || (index !== state.player.index && state.switchCooldown > 0);
    document.querySelector(`#mini-health-${index}`).style.width = `${100 * pokemon.hp / pokemon.maxHp}%`;
  });
  state.cooldowns.forEach(({ remaining }, index) => {
    const chargeNeeded = index === 4 && state.charge < 100;
    const cover = document.querySelector(`#cooldown-${index}`);
    cover.hidden = remaining <= 0 && !chargeNeeded;
    cover.textContent = chargeNeeded ? `${Math.floor(state.charge)}%` : remaining.toFixed(1);
    document.querySelector(`#skill-${index}`).disabled = remaining > 0 || chargeNeeded || state.paused;
  });
  if (state.paused) pauseOverlay();
  else if (!state.ended) document.querySelector('#battle-overlay').hidden = true;
}

function pauseOverlay() {
  const overlay = document.querySelector('#battle-overlay');
  if (!overlay || !overlay.hidden) return;
  overlay.hidden = false;
  overlay.innerHTML = `<section class="panel"><h2 class="panel-title">Paused</h2><div class="panel-body"><p>Your local battle is paused.</p><div class="toolbar"><button class="pixel-button primary" data-action="resume">Resume</button><button class="pixel-button" data-action="menu">Main menu</button></div></div></section>`;
  overlay.querySelector('button').focus();
}

function endBattle(result) {
  if (result.won) {
    save.wins++;
    if (lastBattle.stage) {
      save.story.unlocked = Math.min(16, Math.max(save.story.unlocked, lastBattle.stage + 1));
      const key = String(lastBattle.stage);
      save.story.bestTimes[key] = Math.min(save.story.bestTimes[key] ?? Infinity, result.elapsed);
    }
    persist();
  }
  const overlay = document.querySelector('#battle-overlay');
  overlay.hidden = false;
  overlay.innerHTML = `<section class="panel"><h2 class="panel-title">Battle complete</h2><div class="panel-body"><h2>${result.won ? 'Victory!' : 'Defeated'}</h2><p>${result.won ? 'Your team takes the arena.' : 'Try a different matchup and take the field again.'}</p><p>Battle time ${time(result.elapsed)}</p><div class="toolbar"><button class="pixel-button primary" data-action="rematch">Rematch</button>${lastBattle.stage ? '<button class="pixel-button" data-action="story">Challenges</button>' : ''}<button class="pixel-button" data-action="menu">Main menu</button></div></div></section>`;
  overlay.querySelector('button').focus();
}

function bindJoystick() {
  const joystick = document.querySelector('#joystick');
  const stick = joystick.querySelector('span');
  let pointerId = null;
  function move(event) {
    const bounds = joystick.getBoundingClientRect();
    let x = (event.clientX - bounds.left - bounds.width / 2) / (bounds.width / 2);
    let y = (event.clientY - bounds.top - bounds.height / 2) / (bounds.height / 2);
    const length = Math.max(1, Math.hypot(x,y));
    x /= length; y /= length;
    battle?.setMovement(x,y);
    stick.style.transform = `translate(${x * 22}px,${y * 22}px)`;
  }
  joystick.addEventListener('pointerdown', event => {
    event.preventDefault(); pointerId = event.pointerId;
    joystick.setPointerCapture(pointerId); move(event);
  });
  joystick.addEventListener('pointermove', event => { if (event.pointerId === pointerId) move(event); });
  function stop() { pointerId = null; battle?.setMovement(0,0); stick.style.transform = ''; }
  joystick.addEventListener('pointerup', stop);
  joystick.addEventListener('pointercancel', stop);
  joystick.addEventListener('lostpointercapture', stop);
}

async function fullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    else toast('Fullscreen is unavailable in this browser. Try landscape orientation.');
  } catch { toast('The browser could not enter full screen.'); }
}

screen.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const { action, index, id, value, number, offset, slot } = button.dataset;
  switch (action) {
    case 'menu': menu(); break;
    case 'quick': launchBattle(); break;
    case 'cpu': cpu(); break;
    case 'story': story(); break;
    case 'teams': teams(); break;
    case 'pokedex': pokedex(); break;
    case 'online': online(); break;
    case 'settings': settings(); break;
    case 'saves': saves(); break;
    case 'fullscreen': await fullscreen(); break;
    case 'start-cpu': launchBattle({ difficulty: save.difficulty }); break;
    case 'difficulty': save.difficulty = value; persist(); cpu(); break;
    case 'arena': save.arena = value; persist(); cpu(); break;
    case 'team': save.selectedTeam = Number(index); persist(); teams(); break;
    case 'slot': selectedSlot = Number(index); teams(); break;
    case 'random-team': save.teams[save.selectedTeam] = randomTeam(); persist(); teams(); break;
    case 'page': rosterPage += Number(offset); renderRoster(); document.querySelector('#roster-results').scrollIntoView({ block: 'start' }); break;
    case 'pokemon': {
      if (activeScreen === 'pokedex') { inspectedId = Number(id); pokedex(); break; }
      const team = save.teams[save.selectedTeam];
      const existing = team.indexOf(Number(id));
      if (existing !== -1 && existing !== selectedSlot) { toast('That Pokémon already has a place on this team.'); break; }
      team[selectedSlot] = Number(id); persist(); teams(); break;
    }
    case 'stage': {
      const stage = Number(number);
      if (stage < 1 || stage > save.story.unlocked) break;
      const [, enemies, arena] = STAGES[stage - 1];
      launchBattle({ stage, enemies, arena, difficulty: stage <= 4 ? 'easy' : stage <= 10 ? 'normal' : 'hard' }); break;
    }
    case 'pause': battle?.pause(); break;
    case 'resume': battle?.resume(); document.querySelector('#battle-canvas')?.focus(); break;
    case 'switch': battle?.switchTo(Number(index)); document.querySelector('#battle-canvas')?.focus(); break;
    case 'cast': battle?.cast(Number(slot)); document.querySelector('#battle-canvas')?.focus(); break;
    case 'rematch': launchBattle(lastBattle); break;
    case 'copy-save': {
      try { await navigator.clipboard.writeText(exportSave(save)); toast('Save code copied.'); }
      catch { document.querySelector('#save-code').select(); toast('Code selected. Copy it using your browser.'); }
      break;
    }
    case 'download-save': {
      const url = URL.createObjectURL(new Blob([exportSave(save)], { type: 'text/plain' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'poke2d-community-save.txt';
      document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); break;
    }
  }
});

screen.addEventListener('input', event => {
  if (event.target.id === 'roster-search') { rosterQuery = event.target.value.trim(); rosterPage = 0; renderRoster(); }
  if (event.target.id === 'invite-link') { document.querySelector('#invite-launch').hidden = true; document.querySelector('#invite-error').textContent = ''; }
});

screen.addEventListener('change', event => {
  if (event.target.id === 'type-filter') { rosterType = event.target.value; rosterPage = 0; renderRoster(); }
  const setting = event.target.dataset.setting;
  if (['sound','reducedFlash','largeButtons'].includes(setting)) { save.settings[setting] = event.target.checked; persist(); }
});

screen.addEventListener('submit', event => {
  event.preventDefault();
  if (event.target.id === 'invite-form') {
    const error = document.querySelector('#invite-error');
    const anchor = document.querySelector('#invite-launch');
    try {
      anchor.href = createOfficialPlayLink({ inviteUrl: document.querySelector('#invite-link').value });
      anchor.hidden = false; error.textContent = 'Invitation ready. Open it below to join.';
    } catch (problem) { anchor.hidden = true; error.textContent = problem.message; }
  }
  if (event.target.id === 'import-form') {
    try { save = importSave(document.querySelector('#import-code').value); persist(); saves(); toast('Local save restored.'); }
    catch (problem) { document.querySelector('#save-error').textContent = problem.message; }
  }
});

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (activeScreen === 'battle') {
    if (lastBattleState?.paused) {
      battle?.resume();
      document.querySelector('#battle-canvas')?.focus();
    }
    else battle?.pause();
  } else if (activeScreen !== 'menu') menu();
});

try {
  const response = await fetch(new URL('../data/roster.json', import.meta.url));
  if (!response.ok) throw new Error('The Pokémon roster could not be loaded. Refresh to try again.');
  roster = await response.json();
  byId = new Map(roster.map(pokemon => [pokemon.id,pokemon]));
  const mode = new URL(location.href).searchParams.get('mode');
  const views = { teams, cpu, story, online, settings, pokedex, saves };
  if (mode === 'quick') launchBattle();
  else if (Object.hasOwn(views, mode)) views[mode]();
  else menu();
} catch (error) {
  const errorText = document.querySelector('#load-error');
  if (errorText) errorText.textContent = error.message;
  else toast(error.message);
}
