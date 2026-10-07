import * as THREE from '../vendor/three.module.js';
import {
  AIM_TOLERANCE,
  ARENA_SIZE,
  MEDKIT_HEAL,
  PICKUP_TYPE,
  PLAYER_COLORS,
  PLAYER_INPUTS,
  SPAWN_POINTS,
  WEAPONS,
} from './config.js';
import { World } from './world.js';
import { PickupManager } from './weapons.js';
import { Player } from './player.js';

/** 回合结束后的自动重开延迟（毫秒） */
const ROUND_RESTART_DELAY_MS = 2600;

/** 子弹曳光与弹着点特效的存活时间（毫秒） */
const TRACER_LIFE_MS = 70;

/* ------------------------------------------------------------------ */
/*                          键盘输入                                   */
/* ------------------------------------------------------------------ */

class InputManager {
  constructor() {
    this.pressed = new Set();
    window.addEventListener('keydown', (event) => {
      this.pressed.add(event.code);
      // 方向键与空格会滚动页面，需阻止默认行为
      if (event.code.startsWith('Arrow') || event.code === 'Space') {
        event.preventDefault();
      }
    });
    window.addEventListener('keyup', (event) => this.pressed.delete(event.code));
    window.addEventListener('blur', () => this.pressed.clear());
  }

  /** 是否按住某个键 */
  has(code) {
    return this.pressed.has(code);
  }

  /** 冲刺键支持配置多个（左/右 Shift、左/右 Ctrl） */
  #hasAny(codes) {
    return codes.some((code) => this.pressed.has(code));
  }

  /** 按玩家映射整理出移动指令 */
  getPlayerInput(mapping) {
    return {
      forward: this.has(mapping.forward),
      backward: this.has(mapping.backward),
      turnLeft: this.has(mapping.turnLeft),
      turnRight: this.has(mapping.turnRight),
      sprint: this.#hasAny(mapping.sprint),
    };
  }
}

/* ------------------------------------------------------------------ */
/*                          音效（纯合成）                             */
/* ------------------------------------------------------------------ */

class AudioEngine {
  constructor() {
    this.context = null;
  }

  /** 需在用户手势中调用，浏览器才允许播放声音 */
  unlock() {
    if (this.context) {
      return;
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }
    this.context = new AudioContextClass();
  }

  #noiseBurst({ duration, filterFrequency, gain }) {
    const context = this.context;
    const sampleCount = Math.floor(context.sampleRate * duration);
    const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < sampleCount; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / sampleCount);
    }

    const source = context.createBufferSource();
    source.buffer = buffer;

    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFrequency;

    const volume = context.createGain();
    volume.gain.value = gain;

    source.connect(filter).connect(volume).connect(context.destination);
    source.start();
  }

  #tone({ frequency, endFrequency, duration, type = 'square', gain = 0.08 }) {
    const context = this.context;
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    oscillator.frequency.linearRampToValueAtTime(endFrequency, context.currentTime + duration);

    const volume = context.createGain();
    volume.gain.setValueAtTime(gain, context.currentTime);
    volume.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);

    oscillator.connect(volume).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  }

  shoot(weaponId) {
    if (!this.context) {
      return;
    }
    const isHeavy = weaponId === 'sniper' || weaponId === 'shotgun';
    this.#noiseBurst({
      duration: isHeavy ? 0.22 : 0.09,
      filterFrequency: isHeavy ? 900 : 1800,
      gain: isHeavy ? 0.28 : 0.16,
    });
  }

  hit() {
    if (!this.context) {
      return;
    }
    this.#tone({ frequency: 900, endFrequency: 420, duration: 0.09, gain: 0.06 });
  }

  pickup() {
    if (!this.context) {
      return;
    }
    this.#tone({ frequency: 520, endFrequency: 1080, duration: 0.14, type: 'triangle', gain: 0.07 });
  }

  knockDown() {
    if (!this.context) {
      return;
    }
    this.#tone({ frequency: 320, endFrequency: 70, duration: 0.5, type: 'sawtooth', gain: 0.12 });
  }
}

/* ------------------------------------------------------------------ */
/*                        瞬态特效（曳光/弹着点）                       */
/* ------------------------------------------------------------------ */

class EffectLayer {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
  }

  /** 画一条从枪口到落点的曳光 */
  addTracer(from, to, color) {
    const geometry = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
    const line = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }),
    );
    this.scene.add(line);
    this.items.push({ object: line, expiresAt: performance.now() + TRACER_LIFE_MS, kind: 'fade' });
  }

  /** 弹着点火花 */
  addImpact(point, color) {
    const spark = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 8, 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 }),
    );
    spark.position.copy(point);
    this.scene.add(spark);
    this.items.push({ object: spark, expiresAt: performance.now() + 190, kind: 'spark' });
  }

  update() {
    const now = performance.now();
    const remaining = [];
    for (const item of this.items) {
      if (now >= item.expiresAt) {
        this.#dispose(item);
        continue;
      }
      if (item.kind === 'spark') {
        const scale = 1 + (1 - (item.expiresAt - now) / 190) * 1.4;
        item.object.scale.setScalar(scale);
      } else {
        item.object.material.opacity = Math.max(
          0,
          ((item.expiresAt - now) / TRACER_LIFE_MS) * 0.9,
        );
      }
      remaining.push(item);
    }
    this.items = remaining;
  }

  #dispose(item) {
    this.scene.remove(item.object);
    item.object.geometry.dispose();
    item.object.material.dispose();
  }

  clear() {
    for (const item of this.items) {
      this.#dispose(item);
    }
    this.items = [];
  }
}

/* ------------------------------------------------------------------ */
/*                             游戏主体                                */
/* ------------------------------------------------------------------ */

class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.world = new World(this.scene);
    this.pickups = new PickupManager(this.scene, this.world.buildPickupSpots(16));
    this.effects = new EffectLayer(this.scene);
    this.audio = new AudioEngine();
    this.input = new InputManager();

    this.players = PLAYER_COLORS.map(
      (color, index) => new Player(this.scene, index, color, SPAWN_POINTS[index]),
    );

    this.state = 'menu';
    this.roundEndsAt = 0;
    this.lastFrameTime = 0;
    this.hurtTimers = [0, 0];

    this.#cacheDomElements();
    this.#bindUiEvents();
    this.#bindResize();
    this.resize();
    this.prepareMenuState();
    this.updateHud();

    this.canvasFrame = this.canvasFrame.bind(this);
  }

  #cacheDomElements() {
    this.dom = {
      overlay: document.getElementById('overlay'),
      overlayTitle: document.querySelector('#overlay .overlay__title'),
      overlaySub: document.querySelector('#overlay .overlay__sub'),
      overlayTip: document.querySelector('#overlay .overlay__tip'),
      pauseOverlay: document.getElementById('pause-overlay'),
      startButton: document.getElementById('btn-start'),
      resumeButton: document.getElementById('btn-resume'),
      killfeed: document.getElementById('killfeed'),
      divider: document.getElementById('divider'),
      hud: [
        {
          panel: document.getElementById('hud-left'),
          hpBar: document.getElementById('hp-bar-1'),
          hpText: document.getElementById('hp-text-1'),
          weapon: document.getElementById('weapon-1'),
          ammo: document.getElementById('ammo-1'),
          kills: document.getElementById('kills-1'),
          crosshair: document.getElementById('crosshair-1'),
          hurt: document.getElementById('hurt-1'),
          radar: document.getElementById('radar-1'),
        },
        {
          panel: document.getElementById('hud-right'),
          hpBar: document.getElementById('hp-bar-2'),
          hpText: document.getElementById('hp-text-2'),
          weapon: document.getElementById('weapon-2'),
          ammo: document.getElementById('ammo-2'),
          kills: document.getElementById('kills-2'),
          crosshair: document.getElementById('crosshair-2'),
          hurt: document.getElementById('hurt-2'),
          radar: document.getElementById('radar-2'),
        },
      ],
    };
  }

  #bindUiEvents() {
    this.dom.startButton.addEventListener('click', () => this.startMatch());
    this.dom.resumeButton.addEventListener('click', () => this.togglePause(false));
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Escape') {
        if (this.state === 'playing') {
          this.togglePause(true);
        } else if (this.state === 'paused') {
          this.togglePause(false);
        }
      }
      if (event.code === 'KeyR' && this.state === 'over') {
        this.startMatch();
      }
    });
  }

  #bindResize() {
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height, false);

    const halfWidth = width / 2;
    for (const player of this.players) {
      player.camera.aspect = halfWidth / height;
      player.camera.updateProjectionMatrix();
    }
  }

  /* ---------------------------- 回合控制 ---------------------------- */

  /** 开始新一场对战（清空比分与场上状态） */
  startMatch() {
    for (const player of this.players) {
      player.kills = 0;
    }
    this.beginRound();
    this.audio.unlock();
  }

  /** 菜单状态下的初始摆放：玩家就位、补给齐全，但逻辑暂不推进 */
  prepareMenuState() {
    for (const player of this.players) {
      player.reset();
    }
    this.pickups.reset();
    this.effects.clear();
    this.lastFrameTime = performance.now();
  }

  /** 开始新一回合 */
  beginRound() {
    for (const player of this.players) {
      player.reset();
    }
    this.pickups.reset();
    this.effects.clear();
    this.hurtTimers = [0, 0];
    this.dom.killfeed.innerHTML = '';
    this.dom.overlay.classList.add('overlay--hidden');
    this.dom.pauseOverlay.classList.add('overlay--hidden');
    this.dom.overlayTitle.className = 'overlay__title';
    this.state = 'playing';
    this.lastFrameTime = performance.now();
    this.updateHud();
  }

  togglePause(paused) {
    if (paused && this.state === 'playing') {
      this.state = 'paused';
      this.dom.pauseOverlay.classList.remove('overlay--hidden');
    } else if (!paused && this.state === 'paused') {
      this.state = 'playing';
      this.lastFrameTime = performance.now();
      this.dom.pauseOverlay.classList.add('overlay--hidden');
    }
  }

  endRound(winnerIndex) {
    const winner = this.players[winnerIndex];
    winner.addKill();
    this.state = 'over';
    this.roundEndsAt = performance.now() + ROUND_RESTART_DELAY_MS;

    const loserIndex = winnerIndex === 0 ? 1 : 0;
    this.#pushKillfeed(`${winner.index + 1} 号玩家 淘汰了 ${loserIndex + 1} 号玩家`);
    this.audio.knockDown();

    const scores = this.players.map((player) => player.kills);
    this.dom.overlayTitle.textContent = `玩家 ${winnerIndex + 1} 获胜`;
    this.dom.overlayTitle.className = `overlay__title win-p${winnerIndex + 1}`;
    this.dom.overlaySub.textContent = `比分 ${scores[0]} : ${scores[1]}`;
    this.dom.overlayTip.textContent =
      '回合结束后 2.6 秒自动开始下一回合，也可以按 R 立即重开。';
    this.dom.startButton.textContent = '再来一局';
    this.dom.overlay.classList.remove('overlay--hidden');
    this.updateHud();
  }

  #pushKillfeed(text) {
    const entry = document.createElement('div');
    entry.className = 'killfeed__item';
    entry.textContent = text;
    this.dom.killfeed.prepend(entry);
    setTimeout(() => entry.remove(), 4000);
  }

  /* ---------------------------- 主循环 ---------------------------- */

  canvasFrame(timestamp) {
    this.frameHandle = requestAnimationFrame(this.canvasFrame);

    const deltaSeconds = Math.min((timestamp - this.lastFrameTime) / 1000, 0.05);
    this.lastFrameTime = timestamp;

    if (this.state === 'playing') {
      this.#updatePlayers(deltaSeconds);
      this.#resolvePickups();
      this.#updateShooting(timestamp);
      this.pickups.update(deltaSeconds, timestamp);
      this.effects.update();
    }

    // 回合计时与状态无关，否则结算界面会永远停住
    if (this.state === 'over' && performance.now() >= this.roundEndsAt) {
      this.beginRound();
    }

    this.#decayHurtFlashes(deltaSeconds);
    this.updateHud();
    this.#renderSplitScreen();
  }

  #updatePlayers(deltaSeconds) {
    this.players.forEach((player, index) => {
      player.update(deltaSeconds, this.input.getPlayerInput(PLAYER_INPUTS[index]), this.world);
    });
  }

  /** 拾取补给：武器换枪补弹，医疗包回血 */
  #resolvePickups() {
    for (const player of this.players) {
      if (!player.alive) {
        continue;
      }
      const collected = this.pickups.tryCollect(player.position);
      if (!collected) {
        continue;
      }

      if (collected.type === PICKUP_TYPE.WEAPON) {
        const previous = player.weaponId;
        player.equipWeapon(collected.weaponId);
        this.audio.pickup();
        this.#pushKillfeed(
          `${player.index + 1} 号玩家 拾取 ${WEAPONS[collected.weaponId].name}` +
            (previous && previous !== collected.weaponId ? '（替换旧武器）' : ''),
        );
      } else if (player.heal(MEDKIT_HEAL)) {
        this.audio.pickup();
        this.#pushKillfeed(`${player.index + 1} 号玩家 使用医疗包 +${MEDKIT_HEAL}`);
      }
    }
  }

  /**
   * 自动射击：准星套住对手、在射程内、视线未被遮挡时开火。
   * 命中概率随距离与武器散布衰减，霰弹枪按弹丸数逐颗结算。
   */
  #updateShooting(now) {
    for (const shooter of this.players) {
      if (!shooter.canFire(now)) {
        continue;
      }
      const target = this.players[shooter.index === 0 ? 1 : 0];
      if (!target.alive) {
        continue;
      }

      const weapon = WEAPONS[shooter.weaponId];
      const toTarget = new THREE.Vector3().subVectors(target.chestPosition, shooter.eyePosition);
      const distance = toTarget.length();
      if (distance > weapon.range) {
        continue;
      }

      // 准星必须大致套住对手才自动开火
      const aimOffset = shooter.aimDirection.angleTo(toTarget.clone().normalize());
      if (aimOffset > AIM_TOLERANCE) {
        continue;
      }

      if (this.world.isLineBlocked(shooter.eyePosition, target.chestPosition)) {
        continue;
      }

      this.#fire(shooter, target, weapon, distance, aimOffset, now);
    }
  }

  #fire(shooter, target, weapon, distance, aimOffset, now) {
    shooter.consumeShot(now);
    this.audio.shoot(weapon.id);

    const muzzle = shooter.eyePosition.add(shooter.aimDirection.clone().multiplyScalar(0.9));
    // 距离越远、瞄准偏差越大，越容易脱靶
    const missChance = Math.min(
      0.8,
      weapon.spread * distance * 0.6 + (aimOffset / AIM_TOLERANCE) * 0.25,
    );

    let landedHits = 0;
    let blockedHits = 0;
    for (let pellet = 0; pellet < weapon.pellets; pellet += 1) {
      if (Math.random() < missChance) {
        continue;
      }
      const result = target.takeDamage(weapon.damage);
      if (result === 'blocked') {
        // 出生保护生效：不算命中，也不给受击反馈
        blockedHits += 1;
        continue;
      }
      landedHits += 1;
      if (result === 'dead') {
        break;
      }
    }

    const targetPoint = target.chestPosition;
    this.effects.addTracer(muzzle, targetPoint, weapon.color);

    if (landedHits > 0) {
      this.effects.addImpact(targetPoint, 0xff9d5c);
      this.audio.hit();
      this.hurtTimers[target.index] = 1;
    } else if (blockedHits > 0) {
      // 用护盾色区分「打中但被保护」
      this.effects.addImpact(targetPoint, 0x8fd0ff);
    }

    if (!target.alive) {
      this.endRound(shooter.index);
    }
  }

  #decayHurtFlashes(deltaSeconds) {
    this.hurtTimers = this.hurtTimers.map((value) => Math.max(0, value - deltaSeconds * 2.4));
  }

  /* ---------------------------- 画面渲染 ---------------------------- */

  #renderSplitScreen() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const halfWidth = width / 2;

    this.renderer.setScissorTest(true);

    this.players.forEach((player, index) => {
      // 第一人称视角里不应看到自己的身体模型（否则枪管会糊在屏幕下方）
      const wasVisible = player.mesh.visible;
      player.mesh.visible = false;

      this.renderer.setViewport(index * halfWidth, 0, halfWidth, height);
      this.renderer.setScissor(index * halfWidth, 0, halfWidth, height);
      this.renderer.render(this.scene, player.camera);

      player.mesh.visible = wasVisible;
    });

    this.renderer.setScissorTest(false);
  }

  /* ------------------------------ HUD ------------------------------ */

  updateHud() {
    for (const player of this.players) {
      const dom = this.dom.hud[player.index];
      const healthRatio = Math.max(0, player.health / 100);

      dom.hpBar.style.width = `${healthRatio * 100}%`;
      dom.hpBar.style.backgroundColor = this.#healthColor(healthRatio);
      dom.hpText.textContent = player.alive ? Math.round(player.health) : '淘汰';
      dom.kills.textContent = player.kills;
      dom.weapon.textContent = player.weaponName;

      if (!player.alive) {
        dom.ammo.textContent = '阵亡';
      } else if (player.isSpawnProtected) {
        dom.ammo.textContent = '出生保护中';
      } else if (player.weaponId) {
        dom.ammo.textContent = `${player.ammo} 发`;
      } else {
        dom.ammo.textContent = '无弹药';
      }

      const locked = this.#isTargetLocked(player);
      dom.crosshair.classList.toggle('is-locked', locked);
      dom.hurt.style.opacity = this.hurtTimers[player.index] > 0 ? '1' : '0';
      dom.panel.style.opacity = '1';

      this.#drawRadar(dom.radar, player);
    }
  }

  #healthColor(ratio) {
    if (ratio > 0.6) {
      return '#35d07f';
    }
    if (ratio > 0.3) {
      return '#f5c542';
    }
    return '#ff4d4d';
  }

  /** 当前是否已锁定对手（用于准星变红提示） */
  #isTargetLocked(player) {
    if (!player.alive || !player.weaponId) {
      return false;
    }
    const target = this.players[player.index === 0 ? 1 : 0];
    if (!target.alive) {
      return false;
    }
    const toTarget = new THREE.Vector3().subVectors(target.chestPosition, player.eyePosition);
    if (toTarget.length() > WEAPONS[player.weaponId].range) {
      return false;
    }
    if (player.aimDirection.angleTo(toTarget.normalize()) > AIM_TOLERANCE) {
      return false;
    }
    return !this.world.isLineBlocked(player.eyePosition, target.chestPosition);
  }

  /** 雷达：绘制场地掩体、自身朝向、对手方位 */
  #drawRadar(canvas, player) {
    const context = canvas.getContext('2d');
    const size = canvas.width;
    const half = size / 2;
    const scale = size / ARENA_SIZE;

    context.clearRect(0, 0, size, size);
    context.fillStyle = 'rgba(8, 12, 20, 0.75)';
    context.fillRect(0, 0, size, size);

    // 以玩家为中心，只显示一定范围内的信息
    const range = 34;
    const rangeScale = half / range;

    const toRadar = (worldX, worldZ) => ({
      x: half + (worldX - player.position.x) * rangeScale,
      y: half + (worldZ - player.position.z) * rangeScale,
    });

    context.fillStyle = 'rgba(150, 165, 190, 0.55)';
    for (const obstacle of this.world.obstacles) {
      if (obstacle.height < 4) {
        const width = obstacle.halfWidth * 2 * rangeScale;
        const depth = obstacle.halfDepth * 2 * rangeScale;
        const center = toRadar(obstacle.x, obstacle.z);
        context.fillRect(center.x - width / 2, center.y - depth / 2, width, depth);
      }
    }

    // 对手
    const target = this.players[player.index === 0 ? 1 : 0];
    if (target.alive) {
      const point = toRadar(target.position.x, target.position.z);
      const inside = Math.hypot(point.x - half, point.y - half) < half - 4;
      if (inside) {
        context.fillStyle = player.index === 0 ? '#ff6b57' : '#4da3ff';
        context.beginPath();
        context.arc(point.x, point.y, 4, 0, Math.PI * 2);
        context.fill();
      }
    }

    // 自身（三角形指示朝向）
    context.save();
    context.translate(half, half);
    context.rotate(-player.yaw);
    context.fillStyle = player.index === 0 ? '#4da3ff' : '#ff6b57';
    context.beginPath();
    context.moveTo(0, -7);
    context.lineTo(5, 6);
    context.lineTo(-5, 6);
    context.closePath();
    context.fill();
    context.restore();

    // 视野扇形
    context.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    context.lineWidth = 1;
    context.beginPath();
    context.arc(half, half, half - 2, 0, Math.PI * 2);
    context.stroke();

    void scale;
  }

  /** 启动主循环（菜单状态下也会持续渲染，作为动态背景） */
  run() {
    this.lastFrameTime = performance.now();
    this.frameHandle = requestAnimationFrame(this.canvasFrame);
  }
}

const game = new Game();
game.run();

// 便于在浏览器控制台调试
window.__game = game;
