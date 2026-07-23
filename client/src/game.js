import { findMonsterSpawn, hash } from "./world.js";

const TILE = 56;
const MAP_SIZE = 48;
const SERVER_URL = import.meta.env.VITE_SERVER_URL || "";
const ICONS = {
  sword: "⚔", shield: "◆", bow: "➶", staff: "✦", herb: "❧", potion: "◆",
  coin: "●", fang: "⌁", cloth: "▰", helm: "♜", boots: "⌑", ring: "○",
  scroll: "▤", ore: "⬙", food: "◒"
};

const VOCATIONS = {
  warden: { label: "Warden", color: "#d5aa63", hp: 180, mana: 70, atk: 18, def: 12, spell: "Whirlwind" },
  ranger: { label: "Ranger", color: "#79b884", hp: 135, mana: 105, atk: 21, def: 7, spell: "Piercing shot" },
  arcanist: { label: "Arcanist", color: "#7ca8dc", hp: 100, mana: 190, atk: 25, def: 4, spell: "Ember bolt" },
  druid: { label: "Druid", color: "#86c1a0", hp: 115, mana: 175, atk: 19, def: 6, spell: "Verdant touch" }
};

const MONSTER_KINDS = {
  rat: { name: "Ash Rat", hp: 34, atk: 5, xp: 14, color: "#806756", size: .48, speed: 56 },
  wolf: { name: "Gloom Wolf", hp: 68, atk: 9, xp: 31, color: "#697173", size: .66, speed: 74 },
  skeleton: { name: "Hollow Guard", hp: 110, atk: 14, xp: 58, color: "#c1b9a1", size: .75, speed: 48 },
  wraith: { name: "Cinder Wraith", hp: 155, atk: 19, xp: 94, color: "#8e6cac", size: .82, speed: 61 }
};

const ITEMS = {
  rusty_sword: { name: "Stalowy miecz", icon: "sword", slot: "weapon", power: 4, rarity: "common", value: 35 },
  oak_bow: { name: "Łuk z czarnego dębu", icon: "bow", slot: "weapon", power: 5, rarity: "rare", value: 66 },
  rune_staff: { name: "Kostur żaru", icon: "staff", slot: "weapon", power: 7, rarity: "epic", value: 120 },
  iron_helm: { name: "Żelazny hełm", icon: "helm", slot: "head", armor: 3, rarity: "common", value: 28 },
  hide_armor: { name: "Pancerz tropiciela", icon: "cloth", slot: "armor", armor: 5, rarity: "rare", value: 75 },
  trail_boots: { name: "Buty wędrowca", icon: "boots", slot: "boots", armor: 2, rarity: "common", value: 24 },
  ember_ring: { name: "Pierścień iskry", icon: "ring", slot: "ring", power: 3, rarity: "epic", value: 140 },
  health_potion: { name: "Mikstura zdrowia", icon: "potion", consumable: true, heal: 75, rarity: "common", value: 18 },
  mana_potion: { name: "Mikstura many", icon: "potion", consumable: true, mana: 75, rarity: "rare", value: 22 },
  wolf_fang: { name: "Kieł mrocznego wilka", icon: "fang", quest: true, rarity: "common", value: 7 },
  cinder_ore: { name: "Ruda popiołu", icon: "ore", quest: true, rarity: "rare", value: 12 },
  old_scroll: { name: "Zapieczętowany zwój", icon: "scroll", quest: true, rarity: "epic", value: 45 }
};

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function defaultState(name, vocation) {
  const job = VOCATIONS[vocation];
  return {
    player: {
      id: crypto.randomUUID(), name, vocation, x: 23.5 * TILE, y: 23.5 * TILE,
      level: 1, xp: 0, nextXp: 100, hp: job.hp, maxHp: job.hp, mana: job.mana,
      maxMana: job.mana, attack: job.atk, defense: job.def, gold: 85,
      skills: { melee: 10, distance: 10, magic: 10, shielding: 10 },
      skillXp: { melee: 0, distance: 0, magic: 0, shielding: 0 },
      equipment: { head: "iron_helm", weapon: vocation === "ranger" ? "oak_bow" : vocation === "arcanist" || vocation === "druid" ? "rune_staff" : "rusty_sword", armor: null, boots: "trail_boots", ring: null },
      inventory: [
        { id: "health_potion", count: 3 }, { id: "mana_potion", count: 2 },
        { id: "wolf_fang", count: 0 }, { id: "cinder_ore", count: 0 }
      ],
      quests: [
        { id: "fangs", name: "Zęby ciemności", text: "Przynieś Maeve 5 kłów Gloom Wolf.", progress: 0, goal: 5, done: false },
        { id: "ruins", name: "Szept pod kamieniem", text: "Odnajdź wejście do ruin na północy.", progress: 0, goal: 1, done: false }
      ]
    },
    discovered: [],
    playtime: 0
  };
}

export class AshfallGame {
  constructor(root, options) {
    this.root = root;
    this.options = options;
    this.state = defaultState(options.name, options.vocation);
    this.player = this.state.player;
    this.keys = new Set();
    this.monsters = [];
    this.particles = [];
    this.floaters = [];
    this.remotePlayers = new Map();
    this.logs = [];
    this.cooldowns = [0, 0, 0, 0];
    this.target = null;
    this.camera = { x: 0, y: 0, shake: 0 };
    this.last = performance.now();
    this.saveTimer = 0;
    this.networkTimer = 0;
    this.zone = "Emberwatch";
    this.tileMap = this.generateMap();
    this.npcs = [
      { id: "maeve", name: "Maeve", role: "Strażniczka", x: 21.5 * TILE, y: 21.5 * TILE, color: "#9f724b" },
      { id: "orrin", name: "Orrin", role: "Kupiec", x: 26.5 * TILE, y: 23.5 * TILE, color: "#627f8c" }
    ];
  }

  start() {
    this.restore(this.options.account.loadLocal?.());
    this.mount();
    this.spawnMonsters();
    this.bind();
    this.connect();
    this.log("Witaj w Ashfall. Strażniczka Maeve czeka przy placu.", "loot");
    requestAnimationFrame((time) => this.loop(time));
    this.restoreCloudSave();
  }

  restore(saved) {
    if (!saved?.player || saved.player.name !== this.options.name) return false;
    this.state = saved;
    this.player = saved.player;
    return true;
  }

  async restoreCloudSave() {
    try {
      const saved = await this.options.account.load();
      if ((saved?.playtime || 0) <= (this.state.playtime || 0)) return;
      if (!this.restore(saved)) return;
      this.renderPanel();
      this.updateUI();
    } catch {
      this.log("Zapis w chmurze jest chwilowo niedostępny. Gra działa lokalnie.");
    }
  }

  mount() {
    this.root.innerHTML = `
      <div class="game-layout">
        <div class="viewport">
          <canvas id="world"></canvas>
          <div class="topbar">
            <div class="player-plate">
              <div class="portrait">${this.player.name[0].toUpperCase()}</div>
              <div>
                <div class="plate-name"><span>${this.player.name}</span><small>LVL <b id="level">${this.player.level}</b></small></div>
                <div class="bar hp"><i id="hp-bar"></i><span id="hp-text"></span></div>
                <div class="bar mp"><i id="mp-bar"></i><span id="mp-text"></span></div>
              </div>
            </div>
            <div class="zone-title"><span id="zone">EMBERWATCH</span><small>THE ASHEN FRONTIER</small></div>
            <div id="online-pill" class="online-pill offline">● TRYB SAMOTNY</div>
          </div>
          <div id="quest-tracker" class="quest-tracker"></div>
          <div id="combat-log" class="combat-log"></div>
          <form id="chat-form" class="chat-form"><input id="chat-input" maxlength="100" placeholder="Naciśnij Enter, aby rozmawiać…"/></form>
          <div class="hotbar">
            <button class="hotkey" data-action="0"><small>1</small><b>⚔</b><em>ATAK</em></button>
            <button class="hotkey" data-action="1"><small>2</small><b>✦</b><em>${VOCATIONS[this.player.vocation].spell.split(" ")[0]}</em></button>
            <button class="hotkey" data-action="2"><small>3</small><b>◆</b><em>LECZENIE</em></button>
            <button class="hotkey" data-action="3"><small>4</small><b>❧</b><em>FALA</em></button>
          </div>
          <div class="mobile-pad">
            <button data-dir="up">▲</button><button data-dir="left">◀</button>
            <button data-dir="down">▼</button><button data-dir="right">▶</button>
          </div>
          <div id="toast" class="toast"></div>
        </div>
        <aside class="side-panel">
          <div class="minimap-wrap"><canvas id="minimap"></canvas><span class="minimap-caption">EMBERWATCH VALLEY</span></div>
          <nav class="tabs">
            <button class="active" data-tab="inventory">PLECAK</button>
            <button data-tab="equipment">POSTAĆ</button>
            <button data-tab="skills">UMIEJ.</button>
            <button data-tab="quests">ZADANIA</button>
          </nav>
          <div id="panel-content"></div>
        </aside>
        <div id="tooltip" class="tooltip hidden"></div>
      </div>`;
    this.canvas = this.root.querySelector("#world");
    this.ctx = this.canvas.getContext("2d");
    this.minimap = this.root.querySelector("#minimap");
    this.minimapCtx = this.minimap.getContext("2d");
    this.resize();
    this.activeTab = "inventory";
    this.renderPanel();
    this.updateUI();
  }

  generateMap() {
    const map = [];
    for (let y = 0; y < MAP_SIZE; y++) {
      const row = [];
      for (let x = 0; x < MAP_SIZE; x++) {
        const edge = Math.min(x, y, MAP_SIZE - x - 1, MAP_SIZE - y - 1);
        const n = (hash(Math.floor(x / 3), Math.floor(y / 3), 3) + hash(x, y, 9) * .42) / 1.42;
        let type = edge < 2 || n < .14 ? "water" : n < .21 ? "sand" : n > .87 ? "rock" : "grass";
        if (x >= 18 && x <= 29 && y >= 18 && y <= 28) type = "town";
        if ((x >= 23 && x <= 24 && y > 5 && y < 43) || (y >= 23 && y <= 24 && x > 6 && x < 42)) type = "road";
        if (x >= 19 && x <= 28 && y >= 19 && y <= 27 && (x === 23 || x === 24 || y === 23 || y === 24)) type = "road";
        row.push({ type, detail: hash(x, y), blocked: type === "water" || type === "rock" });
      }
      map.push(row);
    }
    const buildings = [[19,19,3,3],[26,19,3,3],[19,26,3,2],[26,26,3,2]];
    buildings.forEach(([bx, by, w, h]) => {
      for (let y = by; y < by + h; y++) for (let x = bx; x < bx + w; x++) map[y][x] = { type: "roof", detail: hash(x,y), blocked: true };
    });
    return map;
  }

  spawnMonsters() {
    const kinds = ["rat", "rat", "wolf", "wolf", "skeleton", "wraith"];
    let id = 0;
    for (let i = 0; i < 34; i++) {
      const spawn = findMonsterSpawn(this.tileMap, i);
      if (!spawn) continue;
      const { x, y } = spawn;
      const ring = Math.hypot(x - 24, y - 24);
      const kind = ring > 17 ? kinds[3 + Math.floor(hash(i, 12) * 3)] : kinds[Math.floor(hash(i, 13) * 4)];
      const spec = MONSTER_KINDS[kind];
      this.monsters.push({ id: `m${id++}`, kind, x: (x + .5) * TILE, y: (y + .5) * TILE, hp: spec.hp, maxHp: spec.hp, cooldown: 0, wander: hash(i, 20) * 6, dead: false, respawn: 0 });
    }
  }

  bind() {
    addEventListener("resize", () => this.resize());
    addEventListener("keydown", (e) => {
      if (document.activeElement?.tagName === "INPUT") return;
      this.keys.add(e.key.toLowerCase());
      if (["1","2","3","4"].includes(e.key)) this.action(Number(e.key) - 1);
      if (e.key === " ") { e.preventDefault(); this.action(0); }
      if (e.key.toLowerCase() === "e") this.interact();
      if (e.key === "Enter") this.root.querySelector("#chat-input").focus();
    });
    addEventListener("keyup", (e) => this.keys.delete(e.key.toLowerCase()));
    this.canvas.addEventListener("pointerdown", (e) => this.selectAt(e.clientX, e.clientY));
    this.root.querySelectorAll(".hotkey").forEach((button) => button.addEventListener("click", () => this.action(Number(button.dataset.action))));
    this.root.querySelectorAll("[data-dir]").forEach((button) => {
      const key = { up: "w", down: "s", left: "a", right: "d" }[button.dataset.dir];
      button.addEventListener("pointerdown", () => this.keys.add(key));
      button.addEventListener("pointerup", () => this.keys.delete(key));
      button.addEventListener("pointercancel", () => this.keys.delete(key));
    });
    this.root.querySelectorAll("[data-tab]").forEach((button) => button.addEventListener("click", () => {
      this.activeTab = button.dataset.tab;
      this.root.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("active", b === button));
      this.renderPanel();
    }));
    this.root.querySelector("#chat-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const input = this.root.querySelector("#chat-input");
      if (!input.value.trim()) { input.blur(); return; }
      this.send({ type: "chat", text: input.value.trim() });
      this.log(`${this.player.name}: ${input.value.trim()}`);
      input.value = "";
      input.blur();
    });
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const ratio = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, rect.width * ratio);
    this.canvas.height = Math.max(1, rect.height * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.width = rect.width;
    this.height = rect.height;
    this.minimap.width = 520;
    this.minimap.height = 330;
    this.drawMinimap();
  }

  connect() {
    if (!SERVER_URL || SERVER_URL.includes("YOUR-")) return;
    const wsUrl = SERVER_URL.replace(/^http/, "ws") + "/world";
    try {
      this.socket = new WebSocket(wsUrl);
      this.socket.addEventListener("open", () => {
        this.send({ type: "join", player: this.publicPlayer() });
        const pill = this.root.querySelector("#online-pill");
        pill.textContent = "● ŚWIAT ONLINE";
        pill.classList.remove("offline");
      });
      this.socket.addEventListener("message", (event) => this.onMessage(JSON.parse(event.data)));
      this.socket.addEventListener("close", () => {
        const pill = this.root.querySelector("#online-pill");
        pill.textContent = "● TRYB SAMOTNY";
        pill.classList.add("offline");
      });
    } catch { /* offline demo remains playable */ }
  }

  onMessage(message) {
    if (message.type === "snapshot") {
      this.remotePlayers.clear();
      message.players.filter((p) => p.id !== this.player.id).forEach((p) => this.remotePlayers.set(p.id, p));
    }
    if (message.type === "player:update" && message.player.id !== this.player.id) this.remotePlayers.set(message.player.id, message.player);
    if (message.type === "player:left") this.remotePlayers.delete(message.id);
    if (message.type === "chat") this.log(`${message.name}: ${message.text}`);
  }

  send(payload) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(payload));
  }

  publicPlayer() {
    return { id: this.player.id, name: this.player.name, vocation: this.player.vocation, level: this.player.level, x: this.player.x, y: this.player.y };
  }

  loop(time) {
    const dt = Math.min((time - this.last) / 1000, .05);
    this.last = time;
    this.update(dt);
    this.render();
    requestAnimationFrame((next) => this.loop(next));
  }

  update(dt) {
    this.state.playtime += dt;
    this.saveTimer += dt;
    this.networkTimer += dt;
    this.cooldowns = this.cooldowns.map((v) => Math.max(0, v - dt));
    this.updatePlayer(dt);
    this.updateMonsters(dt);
    this.updateParticles(dt);
    this.updateZone();
    if (this.saveTimer > 8) {
      this.saveTimer = 0;
      this.options.account.save(this.state);
    }
    if (this.networkTimer > .12) {
      this.networkTimer = 0;
      this.send({ type: "move", player: this.publicPlayer() });
    }
    this.camera.x += (this.player.x - this.width / 2 - this.camera.x) * Math.min(1, dt * 8);
    this.camera.y += (this.player.y - this.height / 2 - this.camera.y) * Math.min(1, dt * 8);
    this.camera.x = clamp(this.camera.x, 0, MAP_SIZE * TILE - this.width);
    this.camera.y = clamp(this.camera.y, 0, MAP_SIZE * TILE - this.height);
    this.camera.shake *= Math.pow(.04, dt);
    this.updateUI();
  }

  updatePlayer(dt) {
    let dx = 0, dy = 0;
    if (this.keys.has("w") || this.keys.has("arrowup")) dy--;
    if (this.keys.has("s") || this.keys.has("arrowdown")) dy++;
    if (this.keys.has("a") || this.keys.has("arrowleft")) dx--;
    if (this.keys.has("d") || this.keys.has("arrowright")) dx++;
    if (dx || dy) {
      const len = Math.hypot(dx, dy);
      const speed = 176;
      this.tryMove(this.player, dx / len * speed * dt, dy / len * speed * dt);
      this.player.facing = Math.atan2(dy, dx);
      this.player.walk = (this.player.walk || 0) + dt * 9;
    }
    this.player.mana = Math.min(this.player.maxMana, this.player.mana + dt * 1.6);
  }

  tryMove(entity, dx, dy) {
    const radius = 13;
    const can = (x, y) => {
      const points = [[x-radius,y-radius],[x+radius,y-radius],[x-radius,y+radius],[x+radius,y+radius]];
      return points.every(([px,py]) => {
        const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
        return this.tileMap[ty]?.[tx] && !this.tileMap[ty][tx].blocked;
      });
    };
    if (can(entity.x + dx, entity.y)) entity.x += dx;
    if (can(entity.x, entity.y + dy)) entity.y += dy;
  }

  updateMonsters(dt) {
    for (const m of this.monsters) {
      if (m.dead) {
        m.respawn -= dt;
        if (m.respawn <= 0) { m.dead = false; m.hp = m.maxHp; }
        continue;
      }
      const spec = MONSTER_KINDS[m.kind];
      const d = dist(m, this.player);
      m.cooldown -= dt;
      if (d < 280 && d > 32) {
        this.tryMove(m, (this.player.x - m.x) / d * spec.speed * dt, (this.player.y - m.y) / d * spec.speed * dt);
      } else if (d >= 280) {
        m.wander -= dt;
        if (m.wander <= 0) { m.wander = 2 + hash(m.x, m.y, Date.now() % 100) * 4; m.angle = hash(m.y, m.x) * Math.PI * 2; }
        this.tryMove(m, Math.cos(m.angle || 0) * spec.speed * .25 * dt, Math.sin(m.angle || 0) * spec.speed * .25 * dt);
      }
      if (d < 38 && m.cooldown <= 0) {
        m.cooldown = 1.25;
        const damage = Math.max(1, spec.atk + Math.floor(Math.random() * 5) - this.totalDefense() * .35);
        this.player.hp -= damage;
        this.floater(this.player.x, this.player.y - 24, `-${Math.round(damage)}`, "#e06a58");
        this.camera.shake = 5;
        if (this.player.hp <= 0) this.die();
      }
    }
  }

  action(index) {
    if (this.cooldowns[index] > 0) return;
    if (index === 0) {
      const target = this.validTarget(80);
      if (!target) { this.toast("Wybierz cel w zasięgu"); return; }
      this.cooldowns[0] = .7;
      const damage = this.totalAttack() + Math.floor(Math.random() * 7);
      this.hit(target, damage, "#e7c077");
      this.train(this.player.vocation === "ranger" ? "distance" : "melee", 4);
    }
    if (index === 1) {
      const target = this.validTarget(290);
      if (!target) { this.toast("Brak celu w zasięgu"); return; }
      if (this.player.mana < 22) { this.toast("Za mało many"); return; }
      this.player.mana -= 22; this.cooldowns[1] = 2.1;
      const damage = 18 + this.player.level * 3 + this.player.skills.magic * 1.25;
      this.projectile(this.player, target, VOCATIONS[this.player.vocation].color);
      setTimeout(() => !target.dead && this.hit(target, damage, "#8fc5ee"), 180);
      this.train("magic", 6);
    }
    if (index === 2) {
      if (this.player.mana < 28) { this.toast("Za mało many"); return; }
      this.player.mana -= 28; this.cooldowns[2] = 4;
      const heal = 38 + this.player.level * 5;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
      this.floater(this.player.x, this.player.y - 26, `+${heal}`, "#63d589");
      this.burst(this.player.x, this.player.y, "#62bf83", 16);
    }
    if (index === 3) {
      if (this.player.mana < 38) { this.toast("Za mało many"); return; }
      this.player.mana -= 38; this.cooldowns[3] = 5.5;
      this.monsters.filter((m) => !m.dead && dist(m, this.player) < 125).forEach((m) => this.hit(m, 22 + this.player.level * 4, "#d79c58"));
      this.burst(this.player.x, this.player.y, "#dc8e4d", 28);
      this.camera.shake = 7;
    }
  }

  validTarget(range) {
    if (this.target && !this.target.dead && dist(this.player, this.target) <= range) return this.target;
    const nearest = this.monsters.filter((m) => !m.dead && dist(this.player, m) <= range).sort((a,b) => dist(this.player,a)-dist(this.player,b))[0];
    this.target = nearest || null;
    return nearest;
  }

  hit(target, amount, color) {
    const damage = Math.round(amount);
    target.hp -= damage;
    this.floater(target.x, target.y - 28, `-${damage}`, color);
    this.burst(target.x, target.y, color, 8);
    if (target.hp <= 0) this.kill(target);
  }

  kill(monster) {
    monster.dead = true;
    monster.respawn = 18 + Math.random() * 14;
    const spec = MONSTER_KINDS[monster.kind];
    this.gainXp(spec.xp);
    const gold = 2 + Math.floor(Math.random() * (spec.xp / 4));
    this.player.gold += gold;
    let loot = null;
    if (monster.kind === "wolf" && Math.random() < .78) loot = "wolf_fang";
    if (monster.kind === "skeleton" && Math.random() < .34) loot = "cinder_ore";
    if (monster.kind === "wraith" && Math.random() < .12) loot = "old_scroll";
    if (Math.random() < .08) loot = "health_potion";
    if (loot) this.addItem(loot, 1);
    this.log(`Pokonano ${spec.name}: +${spec.xp} XP, +${gold} złota${loot ? `, ${ITEMS[loot].name}` : ""}.`, "loot");
    this.target = null;
  }

  gainXp(amount) {
    this.player.xp += amount;
    while (this.player.xp >= this.player.nextXp) {
      this.player.xp -= this.player.nextXp;
      this.player.level++;
      this.player.nextXp = Math.floor(this.player.nextXp * 1.42);
      this.player.maxHp += this.player.vocation === "warden" ? 18 : 11;
      this.player.maxMana += this.player.vocation === "warden" ? 7 : 16;
      this.player.hp = this.player.maxHp; this.player.mana = this.player.maxMana;
      this.toast(`Poziom ${this.player.level}!`);
      this.burst(this.player.x, this.player.y, "#f2cf76", 35);
    }
  }

  train(skill, amount) {
    this.player.skillXp[skill] += amount;
    const needed = this.player.skills[skill] * 8;
    if (this.player.skillXp[skill] >= needed) {
      this.player.skillXp[skill] -= needed;
      this.player.skills[skill]++;
      this.toast(`${skill.toUpperCase()} wzrasta do ${this.player.skills[skill]}`);
      if (this.activeTab === "skills") this.renderPanel();
    }
  }

  die() {
    this.player.hp = this.player.maxHp;
    this.player.mana = this.player.maxMana;
    this.player.x = 23.5 * TILE; this.player.y = 23.5 * TILE;
    this.player.xp = Math.floor(this.player.xp * .9);
    this.player.gold = Math.floor(this.player.gold * .94);
    this.toast("Płomień przywrócił Cię w Emberwatch");
    this.log("Upadasz. Strażniczy płomień odradza Cię w mieście.", "damage");
  }

  interact() {
    const npc = this.npcs.find((n) => dist(n, this.player) < 90);
    if (!npc) { this.toast("Podejdź do postaci lub obiektu"); return; }
    if (npc.id === "maeve") {
      const quest = this.player.quests.find((q) => q.id === "fangs");
      const fangs = this.itemCount("wolf_fang");
      quest.progress = Math.min(fangs, quest.goal);
      if (fangs >= 5 && !quest.done) {
        quest.done = true; this.removeItem("wolf_fang", 5); this.player.gold += 150; this.gainXp(220);
        this.toast("Zadanie ukończone: Zęby ciemności");
      } else this.toast(quest.done ? "Maeve: Dolina jest dziś bezpieczniejsza." : `Maeve: Potrzebuję 5 kłów. Masz ${fangs}.`);
    } else {
      if (this.player.gold >= 18) {
        this.player.gold -= 18; this.addItem("health_potion", 1); this.toast("Kupiono miksturę zdrowia za 18 złota");
      } else this.toast("Orrin: Wróć, gdy zdobędziesz 18 złota.");
    }
    this.renderPanel();
  }

  selectAt(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const wx = clientX - rect.left + this.camera.x;
    const wy = clientY - rect.top + this.camera.y;
    const candidates = this.monsters.filter((m) => !m.dead && Math.hypot(m.x - wx, m.y - wy) < 36);
    this.target = candidates.sort((a,b) => Math.hypot(a.x-wx,a.y-wy)-Math.hypot(b.x-wx,b.y-wy))[0] || null;
  }

  addItem(id, count) {
    const existing = this.player.inventory.find((item) => item.id === id);
    if (existing) existing.count += count;
    else this.player.inventory.push({ id, count });
    const quest = this.player.quests.find((q) => q.id === "fangs");
    if (id === "wolf_fang") quest.progress = Math.min(quest.goal, this.itemCount(id));
    this.renderPanel();
  }

  removeItem(id, count) {
    const item = this.player.inventory.find((entry) => entry.id === id);
    if (!item) return;
    item.count -= count;
    if (item.count <= 0) this.player.inventory = this.player.inventory.filter((entry) => entry !== item);
  }

  itemCount(id) { return this.player.inventory.find((entry) => entry.id === id)?.count || 0; }
  totalAttack() { return this.player.attack + (ITEMS[this.player.equipment.weapon]?.power || 0) + (ITEMS[this.player.equipment.ring]?.power || 0); }
  totalDefense() { return this.player.defense + Object.values(this.player.equipment).reduce((sum,id) => sum + (ITEMS[id]?.armor || 0), 0); }

  updateZone() {
    const x = this.player.x / TILE, y = this.player.y / TILE;
    const previous = this.zone;
    this.zone = x > 17 && x < 31 && y > 17 && y < 30 ? "Emberwatch" : y < 13 ? "Hollow Ruins" : x < 13 ? "Mossfen Wilds" : x > 36 ? "Cinder Ridge" : "Ashen Frontier";
    if (this.zone === "Hollow Ruins") {
      const quest = this.player.quests.find((q) => q.id === "ruins");
      if (!quest.done) { quest.progress = 1; quest.done = true; this.gainXp(120); this.toast("Odkryto Hollow Ruins"); }
    }
    if (previous !== this.zone) this.root.querySelector("#zone").textContent = this.zone.toUpperCase();
  }

  render() {
    const ctx = this.ctx;
    const shakeX = (Math.random() - .5) * this.camera.shake;
    const shakeY = (Math.random() - .5) * this.camera.shake;
    ctx.save();
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.translate(-this.camera.x + shakeX, -this.camera.y + shakeY);
    this.drawWorld(ctx);
    this.npcs.forEach((n) => this.drawNpc(ctx, n));
    this.monsters.forEach((m) => !m.dead && this.drawMonster(ctx, m));
    this.remotePlayers.forEach((p) => this.drawCharacter(ctx, p, true));
    this.drawCharacter(ctx, this.player, false);
    this.drawParticles(ctx);
    ctx.restore();
    this.drawLighting(ctx);
  }

  drawWorld(ctx) {
    const startX = Math.max(0, Math.floor(this.camera.x / TILE) - 1);
    const startY = Math.max(0, Math.floor(this.camera.y / TILE) - 1);
    const endX = Math.min(MAP_SIZE, Math.ceil((this.camera.x + this.width) / TILE) + 1);
    const endY = Math.min(MAP_SIZE, Math.ceil((this.camera.y + this.height) / TILE) + 1);
    for (let y = startY; y < endY; y++) for (let x = startX; x < endX; x++) this.drawTile(ctx, x, y, this.tileMap[y][x]);
  }

  drawTile(ctx, x, y, tile) {
    const px = x * TILE, py = y * TILE;
    const colors = {
      water: ["#14323a", "#1d4850"], sand: ["#73664a", "#857653"], grass: ["#263d2f", "#304936"],
      town: ["#4a4940", "#57554a"], road: ["#5a503d", "#665a43"], rock: ["#30383a", "#404849"], roof: ["#392b27", "#51342c"]
    }[tile.type];
    const g = ctx.createLinearGradient(px, py, px + TILE, py + TILE);
    g.addColorStop(0, colors[0]); g.addColorStop(1, colors[1]);
    ctx.fillStyle = g; ctx.fillRect(px, py, TILE + .6, TILE + .6);
    ctx.strokeStyle = "rgba(0,0,0,.09)"; ctx.strokeRect(px, py, TILE, TILE);
    if (tile.type === "water") {
      ctx.strokeStyle = `rgba(123,190,194,${.08 + tile.detail * .13})`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px + 8, py + 17 + tile.detail * 12); ctx.quadraticCurveTo(px + 25, py + 12, px + 46, py + 19); ctx.stroke();
    }
    if (tile.type === "grass" && tile.detail > .48) {
      ctx.strokeStyle = "rgba(115,148,94,.27)"; ctx.beginPath();
      for (let i = 0; i < 3; i++) { const gx = px + 9 + hash(x,i+y) * 38, gy = py + 12 + hash(y,i+x) * 34; ctx.moveTo(gx,gy); ctx.lineTo(gx+2,gy-5); }
      ctx.stroke();
      if (tile.detail > .9) this.drawTree(ctx, px + TILE * .5, py + TILE * .5);
    }
    if (tile.type === "road" || tile.type === "town") {
      ctx.strokeStyle = "rgba(214,197,153,.1)";
      ctx.strokeRect(px + 4 + tile.detail * 5, py + 6, 26, 19);
      ctx.strokeRect(px + 30, py + 28 + tile.detail * 4, 22, 23);
    }
    if (tile.type === "rock") {
      ctx.fillStyle = "#4b5150"; ctx.beginPath(); ctx.moveTo(px+6,py+43); ctx.lineTo(px+14,py+15); ctx.lineTo(px+35,py+6); ctx.lineTo(px+51,py+29); ctx.lineTo(px+45,py+51); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#626a67"; ctx.stroke();
    }
    if (tile.type === "roof") {
      ctx.fillStyle = "rgba(15,11,10,.42)";
      for (let i=0;i<4;i++) ctx.fillRect(px, py+i*15, TILE, 2);
      ctx.strokeStyle = "#77503b"; ctx.lineWidth=2; ctx.strokeRect(px+2,py+2,TILE-4,TILE-4);
    }
  }

  drawTree(ctx, x, y) {
    ctx.save(); ctx.shadowColor = "rgba(0,0,0,.4)"; ctx.shadowBlur = 9; ctx.shadowOffsetY = 7;
    ctx.fillStyle = "#152b20"; ctx.beginPath(); ctx.arc(x,y-6,17,0,Math.PI*2); ctx.arc(x-10,y+2,12,0,Math.PI*2); ctx.arc(x+11,y+2,13,0,Math.PI*2); ctx.fill();
    ctx.shadowColor="transparent"; ctx.fillStyle="#3c6847"; ctx.beginPath(); ctx.arc(x-5,y-11,10,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  drawCharacter(ctx, p, remote) {
    const job = VOCATIONS[p.vocation] || VOCATIONS.warden;
    const bob = Math.sin(p.walk || 0) * 1.5;
    ctx.save(); ctx.translate(p.x, p.y + bob);
    ctx.fillStyle = "rgba(0,0,0,.38)"; ctx.beginPath(); ctx.ellipse(0,13,15,7,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = remote ? "#5e7384" : job.color; ctx.beginPath(); ctx.moveTo(-11,9); ctx.quadraticCurveTo(-12,-8,0,-16); ctx.quadraticCurveTo(12,-8,11,9); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#1a1713"; ctx.lineWidth=3; ctx.stroke();
    ctx.fillStyle="#d3b493"; ctx.beginPath(); ctx.arc(0,-17,7,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=job.color; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(-7,-20);ctx.lineTo(0,-27);ctx.lineTo(8,-20);ctx.stroke();
    if (p.vocation === "warden") { ctx.strokeStyle="#d5c3a0";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(10,-10);ctx.lineTo(17,12);ctx.stroke(); }
    if (p.vocation === "ranger") { ctx.strokeStyle="#9b754b";ctx.lineWidth=2;ctx.beginPath();ctx.arc(-9,-3,12,-1.5,1.5);ctx.stroke(); }
    if (p.vocation === "arcanist" || p.vocation === "druid") { ctx.fillStyle=job.color;ctx.beginPath();ctx.arc(12,-12,4,0,7);ctx.fill(); }
    ctx.font="600 10px Inter";ctx.textAlign="center";ctx.fillStyle=remote?"#9fc0d2":"#f0e9d8";ctx.shadowColor="#000";ctx.shadowBlur=3;ctx.fillText(p.name,0,-34);
    ctx.restore();
  }

  drawMonster(ctx, m) {
    const spec = MONSTER_KINDS[m.kind];
    const selected = this.target === m;
    ctx.save(); ctx.translate(m.x,m.y);
    if (selected) { ctx.strokeStyle="#e6b85d";ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,13,22,10,0,0,7);ctx.stroke(); }
    ctx.fillStyle="rgba(0,0,0,.4)";ctx.beginPath();ctx.ellipse(0,12,19*spec.size,7,0,0,7);ctx.fill();
    ctx.fillStyle=spec.color; ctx.strokeStyle="#17191a";ctx.lineWidth=3;
    if (m.kind === "skeleton") {
      ctx.beginPath();ctx.arc(0,-12,9,0,7);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(0,-3);ctx.lineTo(0,14);ctx.moveTo(-10,3);ctx.lineTo(10,3);ctx.moveTo(0,14);ctx.lineTo(-8,22);ctx.moveTo(0,14);ctx.lineTo(8,22);ctx.strokeStyle="#bbb49e";ctx.stroke();
      ctx.fillStyle="#392319";ctx.fillRect(-5,-14,3,3);ctx.fillRect(3,-14,3,3);
    } else if (m.kind === "wraith") {
      const g=ctx.createRadialGradient(0,-5,2,0,0,24);g.addColorStop(0,"#c798dd");g.addColorStop(1,"rgba(71,47,86,.22)");ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,-4,19,Math.PI,0);ctx.quadraticCurveTo(16,18,7,11);ctx.quadraticCurveTo(0,24,-7,11);ctx.quadraticCurveTo(-16,18,-19,-4);ctx.fill();
      ctx.fillStyle="#eee0a7";ctx.fillRect(-7,-7,3,4);ctx.fillRect(4,-7,3,4);
    } else {
      ctx.beginPath();ctx.ellipse(0,1,22*spec.size,14*spec.size,0,0,7);ctx.fill();ctx.stroke();
      ctx.beginPath();ctx.moveTo(-13*spec.size,-8);ctx.lineTo(-9*spec.size,-20*spec.size);ctx.lineTo(-3,-10);ctx.moveTo(13*spec.size,-8);ctx.lineTo(9*spec.size,-20*spec.size);ctx.lineTo(3,-10);ctx.fill();ctx.stroke();
      ctx.fillStyle="#e0b453";ctx.fillRect(-8,-4,4,3);ctx.fillRect(4,-4,4,3);
    }
    if (m.hp < m.maxHp || selected) {
      ctx.fillStyle="#171b1d";ctx.fillRect(-20,-33,40,5);ctx.fillStyle="#b54234";ctx.fillRect(-19,-32,38*(m.hp/m.maxHp),3);
      ctx.fillStyle="#d4d2c9";ctx.font="8px Inter";ctx.textAlign="center";ctx.fillText(spec.name,0,-38);
    }
    ctx.restore();
  }

  drawNpc(ctx, npc) {
    this.drawCharacter(ctx, { ...npc, vocation: "warden", walk: 0 }, true);
    ctx.save();ctx.translate(npc.x,npc.y);ctx.fillStyle="#dfbd6f";ctx.font="700 13px Cinzel";ctx.textAlign="center";ctx.fillText("!",0,-51);ctx.fillStyle="#a8a49b";ctx.font="7px Inter";ctx.fillText(`${npc.role} · E`,0,-42);ctx.restore();
  }

  drawLighting(ctx) {
    const hour = (this.state.playtime / 45) % 1;
    const darkness = .10 + Math.max(0, Math.sin(hour * Math.PI * 2)) * .25;
    ctx.fillStyle = `rgba(8,13,24,${darkness})`; ctx.fillRect(0,0,this.width,this.height);
    const vignette = ctx.createRadialGradient(this.width/2,this.height/2,this.height*.25,this.width/2,this.height/2,Math.max(this.width,this.height)*.7);
    vignette.addColorStop(0,"transparent");vignette.addColorStop(1,"rgba(0,0,0,.5)");ctx.fillStyle=vignette;ctx.fillRect(0,0,this.width,this.height);
  }

  projectile(from, to, color) {
    this.particles.push({ x:from.x,y:from.y-12, tx:to.x,ty:to.y, life:.25,max:.25,color, projectile:true });
  }

  burst(x,y,color,count) {
    for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,s=20+Math.random()*90;this.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.35+Math.random()*.45,max:.8,color,size:1+Math.random()*3});}
  }

  floater(x,y,text,color){this.floaters.push({x,y,text,color,life:1,max:1});}

  updateParticles(dt) {
    this.particles.forEach((p)=>{p.life-=dt;if(p.projectile){const n=dt/.25;p.x+=(p.tx-p.x)*n*6;p.y+=(p.ty-p.y)*n*6;}else{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=30*dt;}});
    this.floaters.forEach((f)=>{f.life-=dt;f.y-=28*dt;});
    this.particles=this.particles.filter((p)=>p.life>0);this.floaters=this.floaters.filter((f)=>f.life>0);
  }

  drawParticles(ctx) {
    for(const p of this.particles){ctx.globalAlpha=p.life/p.max;ctx.fillStyle=p.color;ctx.shadowColor=p.color;ctx.shadowBlur=p.projectile?15:5;ctx.beginPath();ctx.arc(p.x,p.y,p.projectile?5:p.size,0,7);ctx.fill();}
    ctx.shadowBlur=0;
    for(const f of this.floaters){ctx.globalAlpha=f.life/f.max;ctx.fillStyle=f.color;ctx.font="700 13px Inter";ctx.textAlign="center";ctx.fillText(f.text,f.x,f.y);}
    ctx.globalAlpha=1;
  }

  drawMinimap() {
    const ctx=this.minimapCtx,w=this.minimap.width/MAP_SIZE,h=this.minimap.height/MAP_SIZE;
    const colors={water:"#1d4650",sand:"#74674d",grass:"#314b38",town:"#777165",road:"#9a8259",rock:"#4a5050",roof:"#3e2926"};
    for(let y=0;y<MAP_SIZE;y++)for(let x=0;x<MAP_SIZE;x++){ctx.fillStyle=colors[this.tileMap[y][x].type];ctx.fillRect(x*w,y*h,w+.5,h+.5);}
    ctx.fillStyle="#f0c66d";ctx.beginPath();ctx.arc(this.player.x/TILE*w,this.player.y/TILE*h,5,0,7);ctx.fill();
  }

  updateUI() {
    const p=this.player;
    this.root.querySelector("#hp-bar").style.width=`${p.hp/p.maxHp*100}%`;
    this.root.querySelector("#mp-bar").style.width=`${p.mana/p.maxMana*100}%`;
    this.root.querySelector("#hp-text").textContent=`${Math.ceil(p.hp)} / ${p.maxHp}`;
    this.root.querySelector("#mp-text").textContent=`${Math.floor(p.mana)} / ${p.maxMana}`;
    this.root.querySelector("#level").textContent=p.level;
    this.root.querySelectorAll(".hotkey").forEach((el,i)=>el.classList.toggle("cooldown",this.cooldowns[i]>0));
    const quest=p.quests.find((q)=>!q.done)||p.quests.at(-1);
    this.root.querySelector("#quest-tracker").innerHTML=`<h4>${quest.done?"✓ ":""}${quest.name}</h4><p>${quest.text}<br/><b>${quest.progress} / ${quest.goal}</b></p>`;
    if (Math.floor(this.state.playtime*2)%4===0) this.drawMinimap();
  }

  renderPanel() {
    const p=this.player, panel=this.root.querySelector("#panel-content");
    if (!panel) return;
    if (this.activeTab==="inventory") {
      const slots=p.inventory.filter((i)=>i.count>0).map((entry,index)=>this.itemSlot(entry.id,entry.count,index)).join("");
      panel.innerHTML=`<section class="panel-section"><h3><span>PLECAK</span><span>${p.gold} ●</span></h3><div class="inventory-grid">${slots}${Array.from({length:Math.max(0,20-p.inventory.length)},()=>'<div class="slot"></div>').join("")}</div><div class="action-row"><button class="tiny-button" data-use="health_potion">UŻYJ HP</button><button class="tiny-button" data-use="mana_potion">UŻYJ MANY</button></div></section><section class="panel-section"><h3><span>DOŚWIADCZENIE</span><span>${p.xp}/${p.nextXp}</span></h3><div class="bar"><i style="width:${p.xp/p.nextXp*100}%;background:#a48142"></i></div></section>`;
    }
    if (this.activeTab==="equipment") {
      panel.innerHTML=`<section class="panel-section"><h3><span>EKWIPUNEK</span><span>${VOCATIONS[p.vocation].label}</span></h3><div class="equipment">${["head","weapon","armor","boots","ring"].map((slot)=>this.itemSlot(p.equipment[slot],1,slot,slot)).join("")}<div class="slot"></div></div></section><section class="panel-section"><h3>STATYSTYKI</h3><div class="stat-list"><div class="stat"><span>Atak</span><div class="track"><i style="width:${Math.min(100,this.totalAttack()*3)}%"></i></div><b>${this.totalAttack()}</b></div><div class="stat"><span>Obrona</span><div class="track"><i style="width:${Math.min(100,this.totalDefense()*4)}%"></i></div><b>${this.totalDefense()}</b></div><div class="stat"><span>Poziom</span><div class="track"><i style="width:${p.xp/p.nextXp*100}%"></i></div><b>${p.level}</b></div></div></section>`;
    }
    if (this.activeTab==="skills") {
      const labels={melee:"Walka wręcz",distance:"Dystans",magic:"Magia",shielding:"Obrona"};
      panel.innerHTML=`<section class="panel-section"><h3>UMIEJĘTNOŚCI</h3><div class="stat-list">${Object.entries(p.skills).map(([id,value])=>`<div class="stat"><span>${labels[id]}</span><div class="track"><i style="width:${p.skillXp[id]/(value*8)*100}%"></i></div><b>${value}</b></div>`).join("")}</div></section><section class="panel-section"><h3>PROFESJA</h3><p class="muted">${VOCATIONS[p.vocation].label} rozwija się przez aktywne używanie broni, czarów i tarczy.</p></section>`;
    }
    if (this.activeTab==="quests") {
      panel.innerHTML=`<section class="panel-section"><h3>DZIENNIK ZADAŃ</h3><div class="quest-list">${p.quests.map((q)=>`<div class="quest ${q.done?"done":""}"><b>${q.done?"✓ ":""}${q.name}</b><br/>${q.text}<br/><span>${q.progress}/${q.goal}</span></div>`).join("")}</div></section>`;
    }
    panel.querySelectorAll("[data-use]").forEach((button)=>button.addEventListener("click",()=>this.useItem(button.dataset.use)));
    panel.querySelectorAll("[data-item]").forEach((slot)=>{
      slot.addEventListener("mouseenter",(e)=>this.showTooltip(e,slot.dataset.item));
      slot.addEventListener("mouseleave",()=>this.root.querySelector("#tooltip").classList.add("hidden"));
      slot.addEventListener("click",()=>this.equipOrUse(slot.dataset.item));
    });
  }

  itemSlot(id,count,key,label="") {
    if(!id||!ITEMS[id])return `<div class="slot" title="${label}"></div>`;
    const item=ITEMS[id];return `<div class="slot rarity-${item.rarity}" data-item="${id}" title="${label}">${ICONS[item.icon]||"◆"}${count>1?`<small>${count}</small>`:""}</div>`;
  }

  showTooltip(event,id) {
    const item=ITEMS[id],tip=this.root.querySelector("#tooltip");if(!item)return;
    tip.innerHTML=`<b>${item.name}</b>${item.power?`Atak +${item.power}<br/>`:""}${item.armor?`Pancerz +${item.armor}<br/>`:""}<small>${item.rarity.toUpperCase()} · wartość ${item.value} złota</small>`;
    tip.style.left=`${event.clientX-220}px`;tip.style.top=`${event.clientY+12}px`;tip.classList.remove("hidden");
  }

  equipOrUse(id) {
    const item=ITEMS[id];if(item.consumable)return this.useItem(id);
    if(!item.slot)return;
    const current=this.player.equipment[item.slot];this.player.equipment[item.slot]=id;
    this.removeItem(id,1);if(current)this.addItem(current,1);this.renderPanel();this.toast(`Założono: ${item.name}`);
  }

  useItem(id) {
    if(this.itemCount(id)<1){this.toast("Nie masz tego przedmiotu");return;}
    const item=ITEMS[id];this.removeItem(id,1);
    if(item.heal)this.player.hp=Math.min(this.player.maxHp,this.player.hp+item.heal);
    if(item.mana)this.player.mana=Math.min(this.player.maxMana,this.player.mana+item.mana);
    this.burst(this.player.x,this.player.y,item.heal?"#67c985":"#679bd3",12);this.renderPanel();
  }

  log(text,type="") {
    this.logs.push({text,type});this.logs=this.logs.slice(-6);
    const el=this.root.querySelector("#combat-log");if(el)el.innerHTML=this.logs.map((l)=>`<p class="${l.type}">${l.text}</p>`).join("");
  }

  toast(text) {
    const el=this.root.querySelector("#toast");el.textContent=text;el.classList.add("show");clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>el.classList.remove("show"),2100);
  }
}
