import * as THREE from '../vendor/three.module.js';
import {
  PICKUP_TYPE,
  PICKUP_RADIUS,
  PICKUP_RESPAWN_MS,
  WEAPONS,
  WEAPON_SPAWN_POOL,
} from './config.js';

/**
 * 地面补给管理：生成武器与医疗包，处理拾取、自动刷新与视觉表现。
 * 位置由 World 提供的可用点位决定，保证不会刷进掩体里。
 */
export class PickupManager {
  /**
   * @param {THREE.Scene} scene 场景
   * @param {{x:number,z:number}[]} spots 可用刷新点位
   */
  constructor(scene, spots) {
    this.scene = scene;
    this.spots = spots;
    this.items = [];
    this.respawnQueue = [];
    this.#createItems();
  }

  #createItems() {
    this.spots.forEach((spot, index) => {
      // 每第 4 个点位放置医疗包，其余放武器，保证交战节奏与续航
      const isMedkit = index % 4 === 3;
      const item = isMedkit
        ? this.#createMedkitItem(spot)
        : this.#createWeaponItem(spot, WEAPON_SPAWN_POOL[index % WEAPON_SPAWN_POOL.length]);
      this.items.push(item);
    });
  }

  #createWeaponItem(spot, weaponId) {
    const weapon = WEAPONS[weaponId];
    const group = new THREE.Group();
    group.position.set(spot.x, 0, spot.z);

    // 地面光圈，方便远处辨认补给点
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.72, 24),
      new THREE.MeshBasicMaterial({
        color: weapon.color,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
      }),
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.03;
    group.add(halo);

    // 悬浮的武器箱
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.3, 0.34),
      new THREE.MeshLambertMaterial({ color: weapon.color }),
    );
    box.position.y = 0.8;
    box.castShadow = true;
    group.add(box);

    const barrel = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.09, 0.09),
      new THREE.MeshLambertMaterial({ color: 0x2c313a }),
    );
    barrel.position.set(0.45, 0.82, 0);
    group.add(barrel);

    this.scene.add(group);

    return {
      type: PICKUP_TYPE.WEAPON,
      weaponId,
      group,
      halo,
      baseY: 0,
      x: spot.x,
      z: spot.z,
      active: true,
      respawnAt: 0,
      phase: Math.random() * Math.PI * 2,
    };
  }

  #createMedkitItem(spot) {
    const group = new THREE.Group();
    group.position.set(spot.x, 0, spot.z);

    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.72, 24),
      new THREE.MeshBasicMaterial({
        color: 0x35d07f,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
      }),
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.03;
    group.add(halo);

    const caseMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.42, 0.42),
      new THREE.MeshLambertMaterial({ color: 0xf2f4f8 }),
    );
    caseMesh.position.y = 0.85;
    caseMesh.castShadow = true;
    group.add(caseMesh);

    const crossMaterial = new THREE.MeshLambertMaterial({ color: 0xd6343f });
    const crossVertical = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.28, 0.06), crossMaterial);
    crossVertical.position.set(0, 0.85, 0.22);
    group.add(crossVertical);
    const crossHorizontal = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.06), crossMaterial);
    crossHorizontal.position.set(0, 0.85, 0.22);
    group.add(crossHorizontal);

    this.scene.add(group);

    return {
      type: PICKUP_TYPE.MEDKIT,
      weaponId: null,
      group,
      halo,
      baseY: 0,
      x: spot.x,
      z: spot.z,
      active: true,
      respawnAt: 0,
      phase: Math.random() * Math.PI * 2,
    };
  }

  /**
   * 每帧更新：悬浮动画、刷新计时。
   * @param {number} deltaSeconds 帧间隔（秒）
   * @param {number} now 当前时间戳（毫秒）
   */
  update(deltaSeconds, now) {
    this.time = (this.time ?? 0) + deltaSeconds;

    for (const item of this.items) {
      if (!item.active) {
        continue;
      }
      item.group.rotation.y += deltaSeconds * 0.9;
      item.group.position.y = Math.sin(this.time * 2 + item.phase) * 0.08;
    }

    const stillWaiting = [];
    for (const pending of this.respawnQueue) {
      if (now >= pending.respawnAt) {
        pending.item.active = true;
        pending.item.group.visible = true;
      } else {
        stillWaiting.push(pending);
      }
    }
    this.respawnQueue = stillWaiting;
  }

  /**
   * 检测玩家是否踩到补给并完成拾取。
   * @param {THREE.Vector3} position 玩家脚底位置
   * @returns {{type:string, weaponId:string|null}|null} 拾取结果
   */
  tryCollect(position) {
    for (const item of this.items) {
      if (!item.active) {
        continue;
      }
      const deltaX = position.x - item.x;
      const deltaZ = position.z - item.z;
      if (deltaX * deltaX + deltaZ * deltaZ > PICKUP_RADIUS * PICKUP_RADIUS) {
        continue;
      }

      item.active = false;
      item.group.visible = false;
      this.respawnQueue.push({ item, respawnAt: performance.now() + PICKUP_RESPAWN_MS });
      return { type: item.type, weaponId: item.weaponId };
    }
    return null;
  }

  /** 重置为开局状态：全部补给立即生效，清空刷新队列 */
  reset() {
    this.respawnQueue = [];
    for (const item of this.items) {
      item.active = true;
      item.group.visible = true;
    }
  }
}
