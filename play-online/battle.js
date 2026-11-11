const WIDTH = 1000;
const HEIGHT = 625;
const BOUNDS = { left: 54, top: 54, right: 946, bottom: 571 };
const COOLDOWNS = [0.48, 3.6, 4.5, 7, 12];
const PILLARS = [{ x: 326, y: 224, radius: 24 }, { x: 674, y: 401, radius: 24 }];

const TYPE_CHART = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 }
};

const TYPE_COLORS = {
  normal: '#e0d6b8', fire: '#ff8b58', water: '#5acaff', electric: '#ffe966',
  grass: '#96ec6c', ice: '#a2eeed', fighting: '#eea16e', poison: '#d495f3',
  ground: '#d9b971', flying: '#b4d5ff', psychic: '#fb8db7', bug: '#d0dd6a',
  rock: '#c9b98b', ghost: '#b7a0ef', dragon: '#9e9cff', dark: '#b5a0bc',
  steel: '#d5dfec', fairy: '#f6b5e3'
};

export function typeMultiplier(attackType, defenderTypes = []) {
  const chart = TYPE_CHART[String(attackType).toLowerCase()] || {};
  return defenderTypes.reduce((multiplier, type) => multiplier * (chart[String(type).toLowerCase()] ?? 1), 1);
}

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const distance = (first, second) => Math.hypot(first.x - second.x, first.y - second.y);

export function canvasPoint(rect, clientX, clientY) {
  if (rect.width <= 0 || rect.height <= 0 || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
  const scale = Math.min(rect.width / WIDTH, rect.height / HEIGHT);
  const left = rect.left + (rect.width - WIDTH * scale) / 2;
  const top = rect.top + (rect.height - HEIGHT * scale) / 2;
  const x = (clientX - left) / scale;
  const y = (clientY - top) / scale;
  if (x < 0 || x > WIDTH || y < 0 || y > HEIGHT) return null;
  return { x, y };
}

function stat(record, name, fallback = 70) {
  const value = Number(record.stats?.[name]);
  return Number.isFinite(value) ? clamp(value, 1, 255) : fallback;
}

export function createFighter(record, index = 0) {
  const maxHp = Math.round(170 + stat(record, 'hp') * 1.4);
  return {
    id: record.id, name: record.name || 'Pokémon', index,
    types: record.types?.length ? record.types.map(type => String(type).toLowerCase()) : ['normal'],
    sprite: record.sprite || '', moves: record.moves || [],
    maxHp, hp: maxHp, attack: stat(record, 'atk'), specialAttack: stat(record, 'spa'),
    defense: stat(record, 'def'), specialDefense: stat(record, 'spd'),
    speed: 145 + stat(record, 'spe') * 0.45,
    charge: 50, cooldowns: COOLDOWNS.map(() => 0), invulnerable: 0, flash: 0,
    x: 0, y: 0, radius: 20, facing: 1
  };
}

export function calculateDamage(attacker, defender, power, attackType, special = false) {
  const offense = special ? attacker.specialAttack : attacker.attack;
  const defense = special ? defender.specialDefense : defender.defense;
  const effectiveness = typeMultiplier(attackType, defender.types);
  if (effectiveness === 0) return 0;
  return Math.max(1, Math.round(power * (0.65 + offense / (defense + 110)) * effectiveness));
}

export function moveFighter(fighter, dx, dy, obstacles = PILLARS, bounds = BOUNDS) {
  fighter.x = clamp(fighter.x + dx, bounds.left + fighter.radius, bounds.right - fighter.radius);
  fighter.y = clamp(fighter.y + dy, bounds.top + fighter.radius, bounds.bottom - fighter.radius);
  for (const pillar of obstacles) {
    const gap = distance(fighter, pillar);
    const minimum = fighter.radius + pillar.radius;
    if (gap >= minimum) continue;
    const angle = gap > 0 ? Math.atan2(fighter.y - pillar.y, fighter.x - pillar.x) : 0;
    fighter.x = pillar.x + Math.cos(angle) * minimum;
    fighter.y = pillar.y + Math.sin(angle) * minimum;
  }
  fighter.x = clamp(fighter.x, bounds.left + fighter.radius, bounds.right - fighter.radius);
  fighter.y = clamp(fighter.y, bounds.top + fighter.radius, bounds.bottom - fighter.radius);
}

/**
 * Independent solo arena. Cooldowns in onUpdate are { remaining, max } objects.
 * cast slots are basic, special, dash, heavy, ultimate. setAim uses canvas coordinates.
 */
export function startBattle({ canvas, team, enemies, difficulty = 'normal', arena = 'grass', settings = {}, onUpdate = () => {}, onEnd = () => {} }) {
  if (!canvas?.getContext) throw new Error('A canvas is required to start a battle.');
  if (!team?.length || !enemies?.length) throw new Error('Both teams need at least one Pokémon.');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('The browser could not create the arena canvas.');
  const playerTeam = team.slice(0, 3).map(createFighter);
  const enemyTeam = enemies.slice(0, 3).map(createFighter);
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'Battle arena. Move with WASD or arrow keys. Aim with the mouse.');
  let playerIndex = 0;
  let enemyIndex = 0;
  let elapsed = 0;
  let paused = false;
  let destroyed = false;
  let ended = false;
  let switchCooldown = 0;
  let frame = 0;
  let previousTime = performance.now();
  let updateDelay = 0;
  let aiDelay = 0.65;
  let pointerHeld = false;
  let moveStick = { x: 0, y: 0 };
  let aim = { x: 770, y: 312 };
  const pressed = new Set();
  const projectiles = [];
  const particles = [];
  const popups = [];
  const listeners = [];
  const spriteImages = new Map();
  const level = String(difficulty).toLowerCase();
  const cpu = level === 'hard' ? { interval: 0.15, accuracy: 0.05, speed: 1 } :
    level === 'easy' ? { interval: 0.7, accuracy: 0.35, speed: 0.7 } : { interval: 0.3, accuracy: 0.15, speed: 0.88 };
  let audioContext;
  let soundVolume = !settings.sound || settings.muted ? 0 : (typeof settings.sound === 'number' ? clamp(settings.sound, 0, 1) : 0.15);
  const reducedFlash = Boolean(settings.reducedFlash || settings.reducedFlashing);
  const background = new Image();
  background.src = new URL('../assets/arena.png', import.meta.url).href;

  for (const fighter of [...playerTeam, ...enemyTeam]) {
    if (!fighter.sprite || spriteImages.has(fighter.sprite)) continue;
    const picture = new Image();
    picture.src = fighter.sprite;
    spriteImages.set(fighter.sprite, picture);
  }
  const player = () => playerTeam[playerIndex];
  const enemy = () => enemyTeam[enemyIndex];
  player().x = 230;
  player().y = HEIGHT / 2;
  enemy().x = 770;
  enemy().y = HEIGHT / 2;
  enemy().facing = -1;

  function listen(target, event, listener, options) {
    target.addEventListener(event, listener, options);
    listeners.push(() => target.removeEventListener(event, listener, options));
  }

  function beep(frequency, duration = 0.05) {
    if (!soundVolume) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      audioContext ||= new AudioContextClass();
      if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(80, frequency / 2), audioContext.currentTime + duration);
      gain.gain.setValueAtTime(soundVolume * 0.12, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
    } catch {
      soundVolume = 0;
    }
  }

  function burst(x, y, color, amount = 9) {
    for (let i = 0; i < amount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 35 + Math.random() * 100;
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.3 + Math.random() * 0.2, color });
    }
  }

  function teamSnapshot(roster, activeIndex) {
    const active = roster[activeIndex];
    return {
      id: active.id, name: active.name, hp: active.hp, maxHp: active.maxHp, index: activeIndex,
      team: roster.map(fighter => ({ id: fighter.id, name: fighter.name, hp: fighter.hp, maxHp: fighter.maxHp }))
    };
  }

  function publish() {
    if (destroyed) return;
    onUpdate({
      elapsed, player: teamSnapshot(playerTeam, playerIndex), enemy: teamSnapshot(enemyTeam, enemyIndex),
      cooldowns: player().cooldowns.map((remaining, index) => ({ remaining, max: COOLDOWNS[index] })),
      charge: player().charge, paused, ended, switchCooldown
    });
  }

  function finish(won) {
    if (ended || destroyed) return;
    ended = true;
    pointerHeld = false;
    pressed.clear();
    publish();
    onEnd({ won, elapsed });
  }

  function transfer(roster, current, next) {
    const previous = roster[current];
    const incoming = roster[next];
    incoming.x = previous.x;
    incoming.y = previous.y;
    incoming.facing = previous.facing;
    incoming.invulnerable = 0.6;
    burst(previous.x, previous.y, '#e9f8ff', 15);
  }

  function checkFaint(side) {
    const roster = side === 'player' ? playerTeam : enemyTeam;
    const current = side === 'player' ? playerIndex : enemyIndex;
    if (roster[current].hp > 0) return;
    const next = roster.findIndex(fighter => fighter.hp > 0);
    if (next < 0) {
      finish(side === 'enemy');
      return;
    }
    transfer(roster, current, next);
    if (side === 'player') playerIndex = next;
    else enemyIndex = next;
  }

  function switchTo(index) {
    if (destroyed || ended || paused || switchCooldown > 0) return false;
    if (!Number.isInteger(index) || !playerTeam[index] || index === playerIndex || playerTeam[index].hp <= 0) return false;
    transfer(playerTeam, playerIndex, index);
    playerIndex = index;
    switchCooldown = 2.5;
    beep(530, 0.1);
    publish();
    return true;
  }

  function fire(fighter, side, slot, target) {
    if (slot < 0 || slot >= COOLDOWNS.length || fighter.cooldowns[slot] > 0 || fighter.hp <= 0) return false;
    if (slot === 4 && fighter.charge < 100) return false;
    const angle = Math.atan2(target.y - fighter.y, target.x - fighter.x);
    fighter.facing = Math.cos(angle) >= 0 ? 1 : -1;
    fighter.cooldowns[slot] = COOLDOWNS[slot];
    if (slot === 2) {
      fighter.invulnerable = 0.35;
      // Small increments keep a dash from crossing a solid pillar.
      for (let i = 0; i < 10; i++) moveFighter(fighter, Math.cos(angle) * 12, Math.sin(angle) * 12);
      burst(fighter.x, fighter.y, '#e2f8f2', 10);
      beep(180, 0.06);
      return true;
    }
    // The neutral basic strike keeps every matchup playable. Skills use typing.
    const attackType = slot === 0 ? 'neutral' : fighter.types[0];
    const color = TYPE_COLORS[attackType] || '#e5f6ff';
    const count = slot === 4 ? 7 : slot === 3 ? 3 : 1;
    const spread = slot === 4 ? 0.14 : 0.1;
    const power = slot === 0 ? 17 : slot === 1 ? 38 : slot === 3 ? 32 : 43;
    const speed = slot === 0 ? 460 : slot === 4 ? 390 : 355;
    for (let i = 0; i < count; i++) {
      const heading = angle + (i - (count - 1) / 2) * spread;
      projectiles.push({
        x: fighter.x + Math.cos(heading) * 25, y: fighter.y + Math.sin(heading) * 25,
        vx: Math.cos(heading) * speed, vy: Math.sin(heading) * speed,
        radius: slot === 4 ? 13 : slot === 0 ? 5 : 9,
        life: slot === 0 ? 1.2 : 1.8, side, owner: fighter, type: attackType,
        power, special: slot > 0, color
      });
    }
    if (slot === 4) fighter.charge = 0;
    burst(fighter.x, fighter.y, color, 4);
    if (side === 'player') beep(slot === 4 ? 110 : slot === 0 ? 580 : 330, slot === 4 ? 0.25 : 0.055);
    return true;
  }

  function cast(slot) {
    if (destroyed || ended || paused || !Number.isInteger(slot)) return false;
    return fire(player(), 'player', slot, aim);
  }

  function setMovement(x, y) {
    if (destroyed || ended) return;
    const length = Math.hypot(x, y);
    moveStick = Number.isFinite(length) && length > 0 ? { x: x / Math.max(1, length), y: y / Math.max(1, length) } : { x: 0, y: 0 };
  }

  function setAim(x, y) {
    if (destroyed || ended || !Number.isFinite(x) || !Number.isFinite(y)) return;
    aim = { x: clamp(x, 0, WIDTH), y: clamp(y, 0, HEIGHT) };
  }

  function movePlayer(dt) {
    let dx = moveStick.x + (pressed.has('d') || pressed.has('arrowright') ? 1 : 0) - (pressed.has('a') || pressed.has('arrowleft') ? 1 : 0);
    let dy = moveStick.y + (pressed.has('s') || pressed.has('arrowdown') ? 1 : 0) - (pressed.has('w') || pressed.has('arrowup') ? 1 : 0);
    const length = Math.hypot(dx, dy);
    if (length > 1) { dx /= length; dy /= length; }
    moveFighter(player(), dx * player().speed * dt, dy * player().speed * dt);
    if (Math.abs(dx) > 0.05) player().facing = dx > 0 ? 1 : -1;
  }

  function moveCpu(dt) {
    const foe = enemy();
    const human = player();
    const separation = distance(foe, human);
    const angle = Math.atan2(human.y - foe.y, human.x - foe.x);
    const approach = separation > 320 ? 1 : separation < 185 ? -1 : 0;
    const strafe = Math.sin(elapsed * 0.7) > 0 ? 0.55 : -0.55;
    let dx = Math.cos(angle) * approach + Math.cos(angle + Math.PI / 2) * strafe;
    let dy = Math.sin(angle) * approach + Math.sin(angle + Math.PI / 2) * strafe;
    for (const pillar of PILLARS) {
      if (distance(foe, pillar) < 90) {
        dx += (foe.x - pillar.x) / 50;
        dy += (foe.y - pillar.y) / 50;
      }
    }
    const length = Math.max(1, Math.hypot(dx, dy));
    moveFighter(foe, dx / length * foe.speed * cpu.speed * dt, dy / length * foe.speed * cpu.speed * dt);
    foe.facing = human.x > foe.x ? 1 : -1;
    aiDelay -= dt;
    if (aiDelay > 0) return;
    aiDelay = cpu.interval;
    const error = (Math.random() - 0.5) * cpu.accuracy * separation;
    const target = { x: human.x + error, y: human.y - error };
    fire(foe, 'enemy', 0, target);
    if (separation < 480) {
      fire(foe, 'enemy', 1, target);
      fire(foe, 'enemy', 3, target);
      fire(foe, 'enemy', 4, target);
    }
    if (level === 'hard' && separation < 110) {
      fire(foe, 'enemy', 2, { x: foe.x - Math.cos(angle) * 100, y: foe.y - Math.sin(angle) * 100 });
    }
  }

  function hit(projectile, target) {
    if (target.invulnerable > 0) return;
    let damage = calculateDamage(projectile.owner, target, projectile.power, projectile.type, projectile.special);
    if (projectile.side === 'enemy' && level === 'easy') damage = Math.round(damage * 0.75);
    target.hp = Math.max(0, target.hp - damage);
    target.flash = reducedFlash ? 0 : 0.08;
    projectile.owner.charge = Math.min(100, projectile.owner.charge + damage * 0.12);
    target.charge = Math.min(100, target.charge + damage * 0.08);
    burst(projectile.x, projectile.y, projectile.color);
    const effective = typeMultiplier(projectile.type, target.types);
    popups.push({ x: target.x, y: target.y - 26, text: damage === 0 ? 'IMMUNE' : String(damage), color: effective > 1 ? '#ffec76' : '#fff', life: 0.85 });
    if (projectile.side === 'player' && damage > 0) beep(effective > 1 ? 760 : 430, 0.04);
    checkFaint(projectile.side === 'player' ? 'enemy' : 'player');
  }

  function stepProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const projectile = projectiles[i];
      projectile.life -= dt;
      const target = projectile.side === 'player' ? enemy() : player();
      // Substeps avoid thin projectiles skipping collisions on a slow frame.
      const steps = Math.max(1, Math.ceil(Math.hypot(projectile.vx, projectile.vy) * dt / 10));
      for (let step = 0; step < steps; step++) {
        projectile.x += projectile.vx * dt / steps;
        projectile.y += projectile.vy * dt / steps;
        if (distance(projectile, target) < projectile.radius + target.radius) {
          hit(projectile, target);
          projectile.life = 0;
          break;
        }
        if (PILLARS.some(pillar => distance(projectile, pillar) < projectile.radius + pillar.radius)) {
          burst(projectile.x, projectile.y, '#b5c0a7', 4);
          projectile.life = 0;
          break;
        }
      }
      if (projectile.life <= 0 || projectile.x < BOUNDS.left || projectile.x > BOUNDS.right || projectile.y < BOUNDS.top || projectile.y > BOUNDS.bottom) projectiles.splice(i, 1);
      if (ended) break;
    }
  }

  function update(dt) {
    elapsed += dt;
    switchCooldown = Math.max(0, switchCooldown - dt);
    for (const fighter of [player(), enemy()]) {
      fighter.charge = Math.min(100, fighter.charge + dt * 2.5);
      fighter.invulnerable = Math.max(0, fighter.invulnerable - dt);
      fighter.flash = Math.max(0, fighter.flash - dt);
      fighter.cooldowns = fighter.cooldowns.map(remaining => Math.max(0, remaining - dt));
    }
    movePlayer(dt);
    moveCpu(dt);
    if (pointerHeld) cast(0);
    stepProjectiles(dt);
    if (ended || destroyed) return;
    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i];
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      if (particle.life <= 0) particles.splice(i, 1);
    }
    for (let i = popups.length - 1; i >= 0; i--) {
      popups[i].life -= dt;
      popups[i].y -= dt * 30;
      if (popups[i].life <= 0) popups.splice(i, 1);
    }
    updateDelay -= dt;
    if (updateDelay <= 0) { updateDelay = 0.1; publish(); }
  }

  function drawFighter(fighter, isPlayer) {
    const color = isPlayer ? '#91f3ff' : '#ff978e';
    context.fillStyle = '#132a2755';
    context.beginPath();
    context.ellipse(fighter.x, fighter.y + 18, 26, 10, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = color;
    context.lineWidth = 3;
    context.beginPath();
    context.ellipse(fighter.x, fighter.y + 15, 28, 12, 0, 0, Math.PI * 2);
    context.stroke();
    const picture = spriteImages.get(fighter.sprite);
    context.save();
    context.translate(fighter.x, fighter.y - 10);
    context.globalAlpha = fighter.invulnerable > 0 ? 0.65 : 1;
    if (picture?.complete && picture.naturalWidth > 0) {
      context.scale(fighter.facing < 0 ? -1 : 1, 1);
      context.imageSmoothingEnabled = false;
      context.drawImage(picture, -48, -43, 96, 96);
    } else {
      context.fillStyle = TYPE_COLORS[fighter.types[0]] || '#e5e4cd';
      context.beginPath();
      context.arc(0, 8, 22, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#263e42';
      context.lineWidth = 3;
      context.stroke();
      context.fillStyle = '#1c2934';
      context.font = 'bold 16px sans-serif';
      context.textAlign = 'center';
      context.fillText(fighter.name.slice(0, 2).toUpperCase(), 0, 13);
    }
    if (fighter.flash > 0) {
      context.fillStyle = '#ffffff50';
      context.beginPath();
      context.arc(0, 8, 25, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
    context.fillStyle = '#152c38e6';
    context.fillRect(fighter.x - 32, fighter.y - 47, 64, 6);
    context.fillStyle = fighter.hp / fighter.maxHp > 0.3 ? color : '#ffd26c';
    context.fillRect(fighter.x - 31, fighter.y - 46, 62 * fighter.hp / fighter.maxHp, 4);
    context.font = 'bold 13px sans-serif';
    context.textAlign = 'center';
    context.lineWidth = 3;
    context.strokeStyle = '#1f3548';
    context.strokeText(fighter.name, fighter.x, fighter.y - 55);
    context.fillStyle = '#fff';
    context.fillText(fighter.name, fighter.x, fighter.y - 55);
  }

  function render() {
    context.globalAlpha = 1;
    context.fillStyle = '#638e43';
    context.fillRect(0, 0, WIDTH, HEIGHT);
    if (background.complete && background.naturalWidth > 0) context.drawImage(background, 0, 0, WIDTH, HEIGHT);
    const tint = { volcano: '#7b301b55', ice: '#b4e5f075', seaside: '#3e9aa747', ruins: '#5c5b6655', forest: '#194b3540' }[String(arena).toLowerCase()];
    if (tint) { context.fillStyle = tint; context.fillRect(0, 0, WIDTH, HEIGHT); }
    for (const pillar of PILLARS) {
      context.fillStyle = '#19352c66';
      context.beginPath();
      context.ellipse(pillar.x + 4, pillar.y + 10, pillar.radius + 4, pillar.radius * 0.7, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#718173';
      context.strokeStyle = '#364c43';
      context.lineWidth = 4;
      context.fillRect(pillar.x - 20, pillar.y - 20, 40, 40);
      context.strokeRect(pillar.x - 20, pillar.y - 20, 40, 40);
      context.fillStyle = '#a3af94';
      context.fillRect(pillar.x - 17, pillar.y - 23, 34, 9);
    }
    drawFighter(enemy(), false);
    drawFighter(player(), true);
    for (const projectile of projectiles) {
      context.fillStyle = projectile.color;
      context.beginPath();
      context.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#fff9';
      context.fillRect(projectile.x - 2, projectile.y - 2, 4, 4);
    }
    for (const particle of particles) {
      context.globalAlpha = Math.min(1, particle.life * 3);
      context.fillStyle = particle.color;
      context.fillRect(particle.x - 2, particle.y - 2, 4, 4);
    }
    context.globalAlpha = 1;
    context.strokeStyle = '#ffffffb0';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(aim.x, aim.y, 8, 0, Math.PI * 2);
    context.moveTo(aim.x - 13, aim.y);
    context.lineTo(aim.x - 4, aim.y);
    context.moveTo(aim.x + 4, aim.y);
    context.lineTo(aim.x + 13, aim.y);
    context.stroke();
    for (const popup of popups) {
      context.globalAlpha = Math.min(1, popup.life * 2);
      context.font = 'bold 19px sans-serif';
      context.textAlign = 'center';
      context.strokeStyle = '#253240';
      context.lineWidth = 4;
      context.strokeText(popup.text, popup.x, popup.y);
      context.fillStyle = popup.color;
      context.fillText(popup.text, popup.x, popup.y);
    }
    context.globalAlpha = 1;
    if (paused) {
      context.fillStyle = '#0c1826a6';
      context.fillRect(0, 0, WIDTH, HEIGHT);
      context.fillStyle = '#fff';
      context.font = 'bold 38px sans-serif';
      context.textAlign = 'center';
      context.fillText('PAUSED', WIDTH / 2, HEIGHT / 2);
    }
  }

  function loop(now) {
    if (destroyed) return;
    const dt = Math.min(0.033, Math.max(0, (now - previousTime) / 1000));
    previousTime = now;
    if (!paused && !ended) update(dt);
    if (destroyed) return;
    render();
    if (!ended) frame = requestAnimationFrame(loop);
  }

  function pause() {
    if (destroyed || ended || paused) return;
    paused = true;
    pressed.clear();
    pointerHeld = false;
    moveStick = { x: 0, y: 0 };
    publish();
    render();
  }

  function resume() {
    if (destroyed || ended || !paused) return;
    paused = false;
    previousTime = performance.now();
    publish();
  }

  function pointFromEvent(event) {
    const point = canvasPoint(canvas.getBoundingClientRect(), event.clientX, event.clientY);
    if (!point) return false;
    setAim(point.x, point.y);
    return true;
  }

  const controlledKeys = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright', ' ', 'q', 'e', 'r', '1', '2', '3']);
  listen(window, 'keydown', event => {
    if (destroyed || ended || paused || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    const key = event.key.toLowerCase();
    if (key === ' ' && event.target instanceof Element && event.target.closest('button, a')) return;
    if (!controlledKeys.has(key)) return;
    event.preventDefault();
    pressed.add(key);
    if (event.repeat) return;
    if (key === ' ') cast(2);
    if (key === 'q') cast(3);
    if (key === 'e') cast(4);
    if (['1', '2', '3'].includes(key)) switchTo(Number(key) - 1);
    if (key === 'r') {
      for (let offset = 1; offset < playerTeam.length; offset++) {
        if (switchTo((playerIndex + offset) % playerTeam.length)) break;
      }
    }
  });
  listen(window, 'keyup', event => pressed.delete(event.key.toLowerCase()));
  listen(window, 'blur', pause);
  listen(document, 'visibilitychange', () => { if (document.hidden) pause(); });
  listen(canvas, 'pointermove', pointFromEvent);
  listen(canvas, 'pointerdown', event => {
    if (event.button !== 0 && event.button !== 2) return;
    if (!pointFromEvent(event)) return;
    event.preventDefault();
    event.stopPropagation();
    canvas.focus({ preventScroll: true });
    if (event.button === 0) { pointerHeld = true; cast(0); }
    if (event.button === 2) cast(1);
  });
  listen(window, 'pointerup', () => { pointerHeld = false; });
  listen(window, 'pointercancel', () => { pointerHeld = false; });
  listen(canvas, 'contextmenu', event => event.preventDefault());
  publish();
  render();
  frame = requestAnimationFrame(loop);

  return {
    pause, resume, cast, switchTo, setMovement, setAim,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(frame);
      listeners.forEach(remove => remove());
      pressed.clear();
      if (audioContext && audioContext.state !== 'closed') audioContext.close().catch(() => {});
    }
  };
}
