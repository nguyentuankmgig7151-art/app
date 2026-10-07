import * as THREE from '../vendor/three.module.js';
import {
  BODY_HEIGHT,
  EYE_HEIGHT,
  MAX_HEALTH,
  MOVE_SPEED,
  PLAYER_RADIUS,
  SPAWN_PROTECT_MS,
  SPRINT_SPEED,
  TURN_SPEED,
  WEAPONS,
} from './config.js';

/**
 * 玩家：同时管理「第三人称可见的身体模型」和「第一人称相机」。
 * 相机没有俯仰角（操作方案为前进/后退 + 左右转向），因此枪口始终水平。
 */
export class Player {
  /**
   * @param {THREE.Scene} scene 场景
   * @param {number} index 玩家序号（0 或 1）
   * @param {number} color 身体配色（十六进制）
   * @param {{x:number,z:number,yaw:number}} spawnPoint 出生点
   */
  constructor(scene, index, color, spawnPoint) {
    this.index = index;
    this.scene = scene;
    this.color = color;
    this.spawnPoint = spawnPoint;

    this.camera = new THREE.PerspectiveCamera(78, 1, 0.1, 260);
    this.camera.rotation.order = 'YXZ';

    this.position = new THREE.Vector3(spawnPoint.x, 0, spawnPoint.z);
    this.yaw = spawnPoint.yaw;

    this.health = MAX_HEALTH;
    this.kills = 0;
    this.alive = true;

    this.weaponId = null;
    this.ammo = 0;
    this.nextFireAt = 0;
    this.protectedUntil = 0;

    this.mesh = this.#buildBody(color);
    this.scene.add(this.mesh);

    this.viewModel = this.#buildViewModel();
    this.camera.add(this.viewModel);
    this.scene.add(this.camera);

    this.beaconPulseUntil = 0;
    this.syncTransforms();
  }

  /* ------------------------------ 模型构建 ------------------------------ */

  #buildBody(color) {
    const group = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.34, BODY_HEIGHT - 0.68, 6, 14),
      new THREE.MeshLambertMaterial({ color }),
    );
    body.position.y = BODY_HEIGHT / 2;
    body.castShadow = true;
    group.add(body);

    // 头顶信标：便于远距离辨认对手方位
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 12, 12),
      new THREE.MeshBasicMaterial({ color }),
    );
    beacon.position.y = BODY_HEIGHT + 0.38;
    group.add(beacon);
    this.beacon = beacon;

    // 朝向指示（枪管），让对手能看出你面朝哪边
    const barrel = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.14, 0.9),
      new THREE.MeshLambertMaterial({ color: 0x22262e }),
    );
    barrel.position.set(0.24, 1.28, -0.5);
    group.add(barrel);

    return group;
  }

  /** 第一人称手持武器模型，挂在相机上 */
  #buildViewModel() {
    const group = new THREE.Group();

    this.viewModelBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.075, 0.095, 0.55),
      new THREE.MeshLambertMaterial({ color: 0x9aa4b4 }),
    );
    this.viewModelBody.position.set(0.3, -0.24, -0.78);
    group.add(this.viewModelBody);

    this.viewModelStock = new THREE.Mesh(
      new THREE.BoxGeometry(0.065, 0.085, 0.17),
      new THREE.MeshLambertMaterial({ color: 0x6c4b2c }),
    );
    this.viewModelStock.position.set(0.3, -0.26, -0.53);
    group.add(this.viewModelStock);

    this.muzzleFlash = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0 }),
    );
    this.muzzleFlash.position.set(0.3, -0.24, -1.04);
    group.add(this.muzzleFlash);

    group.position.copy(this.camera.position);
    this.#applyWeaponAppearance();
    return group;
  }

  #applyWeaponAppearance() {
    if (!this.viewModelBody) {
      return;
    }
    const weapon = this.weaponId ? WEAPONS[this.weaponId] : null;
    this.viewModelBody.material.color.setHex(weapon ? weapon.color : 0x8b93a1);
    // 空手时收短、下移，视觉上区分「没有武器」
    this.viewModelBody.scale.z = weapon ? 1 : 0.4;
    this.viewModelBody.position.set(0.3, weapon ? -0.24 : -0.32, weapon ? -0.78 : -0.66);
    this.viewModelStock.visible = Boolean(weapon);
    this.muzzleFlash.visible = Boolean(weapon);
  }

  /* ------------------------------ 状态查询 ------------------------------ */

  get eyePosition() {
    return new THREE.Vector3(this.position.x, EYE_HEIGHT, this.position.z);
  }

  get chestPosition() {
    return new THREE.Vector3(this.position.x, BODY_HEIGHT * 0.55, this.position.z);
  }

  /** 相机前方单位向量 */
  get aimDirection() {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  get isSpawnProtected() {
    return performance.now() < this.protectedUntil;
  }

  /** HUD 用的武器显示名 */
  get weaponName() {
    return this.weaponId ? WEAPONS[this.weaponId].name : '空手';
  }

  /* ------------------------------ 行为 ------------------------------ */

  /** 重置到出生点（开局 / 重新开始） */
  reset() {
    this.position.set(this.spawnPoint.x, 0, this.spawnPoint.z);
    this.yaw = this.spawnPoint.yaw;
    this.health = MAX_HEALTH;
    this.alive = true;
    this.weaponId = null;
    this.ammo = 0;
    this.nextFireAt = 0;
    this.protectedUntil = performance.now() + SPAWN_PROTECT_MS;
    this.mesh.visible = true;
    this.#applyWeaponAppearance();
    this.syncTransforms();
  }

  /**
   * 逐帧更新移动与相机。
   * @param {number} deltaSeconds 帧间隔
   * @param {{forward:boolean,backward:boolean,turnLeft:boolean,turnRight:boolean,sprint:boolean}} input
   * @param {import('./world.js').World} world 竞技场
   */
  update(deltaSeconds, input, world) {
    if (!this.alive) {
      return;
    }

    const turnDirection = (input.turnLeft ? 1 : 0) - (input.turnRight ? 1 : 0);
    this.yaw += turnDirection * TURN_SPEED * deltaSeconds;

    let moveDirection = (input.forward ? 1 : 0) - (input.backward ? 1 : 0);
    // 后退略慢，避免背身逃跑过于强势
    const speed = input.sprint && moveDirection > 0 ? SPRINT_SPEED : MOVE_SPEED;
    if (moveDirection < 0) {
      moveDirection *= 0.72;
    }

    if (moveDirection !== 0) {
      const direction = this.aimDirection;
      this.position.x += direction.x * moveDirection * speed * deltaSeconds;
      this.position.z += direction.z * moveDirection * speed * deltaSeconds;
      world.resolveCollision(this.position, PLAYER_RADIUS);
    }

    this.syncTransforms();
    this.#updateMuzzleFlash(deltaSeconds);
    this.#updateBeaconPulse();
  }

  syncTransforms() {
    this.mesh.position.set(this.position.x, 0, this.position.z);
    this.mesh.rotation.y = this.yaw;

    this.camera.position.set(this.position.x, EYE_HEIGHT, this.position.z);
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = 0;
    this.camera.updateMatrixWorld();
  }

  #updateMuzzleFlash(deltaSeconds) {
    if (this.muzzleFlash.material.opacity <= 0) {
      return;
    }
    this.muzzleFlash.material.opacity = Math.max(
      0,
      this.muzzleFlash.material.opacity - deltaSeconds * 12,
    );
  }

  /** 受击或被治疗时，头顶信标短暂放大，便于对手与本人察觉 */
  #updateBeaconPulse() {
    const isPulsing = performance.now() < this.beaconPulseUntil;
    this.beacon.scale.setScalar(isPulsing ? 1.9 : 1);
  }

  /** 触发枪口闪光 */
  flashMuzzle() {
    this.muzzleFlash.material.opacity = 1;
  }

  /**
   * 装备武器（满弹）或补充同型号弹药。
   * @returns {boolean} 是否改变了武器状态
   */
  equipWeapon(weaponId) {
    if (this.weaponId === weaponId) {
      this.ammo += WEAPONS[weaponId].ammo;
      return true;
    }
    this.weaponId = weaponId;
    this.ammo = WEAPONS[weaponId].ammo;
    this.#applyWeaponAppearance();
    return true;
  }

  /**
   * 治疗。
   * @returns {boolean} 是否实际生效
   */
  heal(amount) {
    if (this.health >= MAX_HEALTH) {
      return false;
    }
    this.health = Math.min(MAX_HEALTH, this.health + amount);
    this.beaconPulseUntil = performance.now() + 300;
    return true;
  }

  /** 是否满足开火条件（有枪、有弹、冷却结束、存活） */
  canFire(now) {
    if (!this.alive || !this.weaponId || this.ammo <= 0) {
      return false;
    }
    return now >= this.nextFireAt;
  }

  /** 开火后消耗弹药并进入冷却 */
  consumeShot(now) {
    const weapon = WEAPONS[this.weaponId];
    this.ammo -= 1;
    this.nextFireAt = now + weapon.fireInterval;
    this.flashMuzzle();

    if (this.ammo <= 0) {
      this.weaponId = null;
      this.ammo = 0;
      this.#applyWeaponAppearance();
    }
  }

  /**
   * 受到伤害。
   * @returns {'blocked'|'hit'|'dead'} 结算结果
   */
  takeDamage(amount) {
    if (!this.alive) {
      return 'blocked';
    }
    if (this.isSpawnProtected) {
      return 'blocked';
    }

    this.health = Math.max(0, this.health - amount);
    this.beaconPulseUntil = performance.now() + 200;

    if (this.health <= 0) {
      this.alive = false;
      this.mesh.visible = false;
      return 'dead';
    }
    return 'hit';
  }

  /** 击杀计数 +1 */
  addKill() {
    this.kills += 1;
  }
}
