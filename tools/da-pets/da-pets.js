/* eslint-disable import/no-unresolved */
import DA_SDK from 'https://da.live/nx/utils/sdk.js';

// Resolve GIF paths relative to this module (not the HTML document)
const MEDIA = new URL('./media/', import.meta.url).href;

const ANIMALS = {
  'cat-ginger': { color: 'ginger', label: 'Ginger Cat', canLie: true },
  'cat-grey': { color: 'grey', label: 'Grey Cat', canLie: true },
  'cat-grey-white': { color: 'grey_white', label: 'Grey & White Cat', canLie: true },
  dog: { color: 'brown', label: 'Dog', canLie: true },
  'rubber-duck': { color: 'yellow', label: 'Rubber Duck', canLie: false },
  chicken: { color: 'white', label: 'Chicken', canLie: false },
  dino: { color: 'green', label: 'Dino', canLie: false },
  'ew-mascot': { color: 'red', label: 'EW Mascot', canLie: false },
};

const SPEECH = [
  'Hello!', '*purr*', 'Feed me', 'Pet me', 'zzzz', '...', '!', 'Hmm?',
  'Bork!', 'Quack', 'bawk!', 'Rawr', ':3', 'UwU', 'nom nom',
  'Let\'s build!', 'How can I help you?', 'I love AI!', 'Let\'s write some prompts!',
];

const MEETING_SPEECH = [
  'Oh hi!', 'Hey!', '👋', 'frend!', '!!', '❤️', 'omg!', '*sniff*', 'hewwo', 'hi hi!',
];

const PET_W = 32; // px, matches width in CSS
const TICK = 100; // ms
const MEET_COOLDOWN = 100; // ticks (~10 s) before the same pair can greet again

// State definitions: vx = px per tick (positive = right)
const STATES = {
  idle: { sprite: 'idle', vx: 0 },
  'walk-right': { sprite: 'walk', vx: 1.5 },
  'walk-left': { sprite: 'walk', vx: -1.5 },
  'run-right': { sprite: 'walk_fast', vx: 2.8 },
  'run-left': { sprite: 'walk_fast', vx: -2.8 },
  swipe: { sprite: 'swipe', vx: 0 },
  lie: { sprite: 'lie', vx: 0 },
};

// Weighted next-state tables; lie injected at runtime for eligible animals
const NEXT_BASE = {
  idle: [['walk-right', 28], ['walk-left', 28], ['run-right', 14], ['run-left', 14], ['swipe', 8]],
  'walk-right': [['idle', 28], ['walk-left', 18], ['run-right', 40], ['swipe', 8]],
  'walk-left': [['idle', 28], ['walk-right', 18], ['run-left', 40], ['swipe', 8]],
  'run-right': [['idle', 38], ['walk-right', 32], ['walk-left', 24]],
  'run-left': [['idle', 38], ['walk-left', 32], ['walk-right', 24]],
  swipe: [['idle', 50], ['walk-right', 25], ['walk-left', 25]],
  lie: [['idle', 50], ['walk-right', 30], ['walk-left', 20]],
};

// Ticks (×TICK ms) to stay in each state
const DURATION = {
  idle: [15, 40],
  'walk-right': [10, 28],
  'walk-left': [10, 28],
  'run-right': [5, 14],
  'run-left': [5, 14],
  swipe: [4, 4],
  lie: [20, 50],
};

// ── Helpers ────────────────────────────────────────────

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function pick(table) {
  const total = table.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  const entry = table.find(([, w]) => { r -= w; return r <= 0; });
  return entry ? entry[0] : table[table.length - 1][0];
}

function gifUrl(type, sprite) {
  const { color } = ANIMALS[type];
  return `${MEDIA}${type}/${color}_${sprite}_8fps.gif`;
}

function nextTable(type, fromState) {
  const table = [...NEXT_BASE[fromState]];
  if (ANIMALS[type].canLie && fromState === 'idle') table.push(['lie', 8]);
  return table;
}

// ── State machine ──────────────────────────────────────

function applyState(pet, state) {
  pet.state = state;
  pet.ticks = rand(...DURATION[state]);
  const { sprite, vx } = STATES[state];
  pet.el.src = gifUrl(pet.type, sprite);
  if (vx > 0) pet.el.style.transform = 'scaleX(1)';
  if (vx < 0) pet.el.style.transform = 'scaleX(-1)';
}

// ── Pet lifecycle ──────────────────────────────────────

let pets = [];
let nextId = 0;
let stage;

// ── UI helpers ─────────────────────────────────────────

function showEmpty() {
  if (stage.querySelector('.empty-state')) return;
  const el = document.createElement('div');
  el.className = 'empty-state';
  el.innerHTML = '<span>🐾</span><p>No pets yet — add one above!</p>';
  stage.appendChild(el);
}

function updateCount() {
  const n = pets.length;
  document.getElementById('pet-count').textContent = n ? `${n} pet${n !== 1 ? 's' : ''}` : '';
}

// ── Speech bubbles ─────────────────────────────────────

function showBubble(pet, msg) {
  stage.querySelector(`.bubble[data-pet="${pet.id}"]`)?.remove();
  const b = document.createElement('div');
  b.className = 'bubble';
  b.dataset.pet = pet.id;
  b.textContent = msg;
  b.style.left = `${pet.x + PET_W / 2}px`;
  b.style.bottom = `${PET_W + 10}px`;
  stage.appendChild(b);
  b.addEventListener('animationend', () => b.remove());
}

function greet(pet) {
  showBubble(pet, SPEECH[Math.floor(Math.random() * SPEECH.length)]);
}

function removePet(pet) {
  pet.el.remove();
  pets = pets.filter((p) => p !== pet);
  updateCount();
  if (!pets.length) showEmpty();
}

function addPet(type) {
  nextId += 1;
  const id = nextId;
  const x = rand(0, Math.max(0, stage.clientWidth - PET_W));

  const el = document.createElement('img');
  el.className = 'pet';
  el.alt = ANIMALS[type].label;
  el.style.left = `${x}px`;
  el.src = gifUrl(type, 'idle');

  const pet = {
    id, type, x, el, state: 'idle', ticks: rand(...DURATION.idle), meetCooldown: 0,
  };
  pets.push(pet);

  el.addEventListener('click', () => greet(pet));

  stage.querySelector('.empty-state')?.remove();
  stage.appendChild(el);
  updateCount();
}

// ── Animation tick ─────────────────────────────────────

function tickPet(pet) {
  const { vx } = STATES[pet.state];

  if (vx !== 0) {
    pet.x += vx;
    const maxX = stage.clientWidth - PET_W;

    if (pet.x <= 0) {
      pet.x = 0;
      applyState(pet, pet.state.startsWith('run') ? 'run-right' : 'walk-right');
      return;
    }
    if (pet.x >= maxX) {
      pet.x = maxX;
      applyState(pet, pet.state.startsWith('run') ? 'run-left' : 'walk-left');
      return;
    }
    pet.el.style.left = `${pet.x}px`;
  }

  pet.ticks -= 1;
  if (pet.ticks <= 0) applyState(pet, pick(nextTable(pet.type, pet.state)));
}

// ── Meeting detection ──────────────────────────────────

function checkMeetings() {
  pets.forEach((a, i) => {
    pets.slice(i + 1).forEach((b) => {
      if (a.meetCooldown === 0 && b.meetCooldown === 0 && Math.abs(a.x - b.x) < PET_W) {
        const randMsg = () => MEETING_SPEECH[Math.floor(Math.random() * MEETING_SPEECH.length)];
        showBubble(a, randMsg());
        showBubble(b, randMsg());
        a.meetCooldown = MEET_COOLDOWN;
        b.meetCooldown = MEET_COOLDOWN;
      }
    });
  });
  pets.forEach((p) => { if (p.meetCooldown > 0) p.meetCooldown -= 1; });
}

// ── Bootstrap ──────────────────────────────────────────

async function init() {
  // Initialise DA SDK (provides context / token / actions for DA integration)
  try { await DA_SDK; } catch { /* allow offline / local dev */ }

  stage = document.getElementById('stage');

  document.getElementById('btn-add').addEventListener('click', () => {
    addPet(document.getElementById('animal-select').value);
  });

  document.getElementById('btn-clear').addEventListener('click', () => {
    [...pets].forEach(removePet);
  });

  showEmpty();
  setInterval(() => { pets.forEach(tickPet); checkMeetings(); }, TICK);

  document.body.removeAttribute('style'); // reveal after init
}

init();
