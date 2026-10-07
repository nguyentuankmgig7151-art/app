import * as THREE from '../vendor/three.module.js';
import { ARENA_SIZE } from './config.js';

/**
 * 竞技场：负责搭建 3D 场景中的地面、边界、掩体，并提供
 *  - 圆形碰撞求解（玩家不能穿墙）
 *  - 射线遮挡查询（子弹/视线不会被掩体穿透）
 *  - 可用的补给刷新点位
 */

/** 掩体规格：x/z 为中心坐标，w/d 为完整宽深，h 为高度 */
const OBSTACLE_SPECS = [
  // 中央地标
  { x: 0, z: 0, w: 3.2, d: 3.2, h: 3.6, kind: 'pillar' },
  // 长墙（南北两侧）
  { x: 0, z: -14, w: 15, d: 1.2, h: 2.4, kind: 'wall' },
  { x: -10, z: 8, w: 1.2, d: 13, h: 2.6, kind: 'wall' },
  // 箱体掩体
  { x: -10, z: -6, w: 2.4, d: 2.4, h: 2.0, kind: 'crate' },
  { x: -13.5, z: -9.5, w: 2.4, d: 2.4, h: 1.6, kind: 'crate' },
  { x: 14, z: -4, w: 3.0, d: 3.0, h: 1.6, kind: 'crate' },
  { x: 8, z: -18, w: 2.0, d: 2.0, h: 3.2, kind: 'pillar' },
  { x: -18, z: 3, w: 2.6, d: 2.6, h: 2.2, kind: 'crate' },
  { x: 18, z: 9, w: 10, d: 1.2, h: 2.2, kind: 'wall' },
  { x: 6, z: 15, w: 2.6, d: 2.6, h: 1.8, kind: 'crate' },
  { x: -6, z: -20, w: 2.2, d: 2.2, h: 2.6, kind: 'pillar' },
  { x: 20, z: -12, w: 2.2, d: 2.2, h: 2.4, kind: 'crate' },
];

/** 各类掩体的外观参数 */
const MATERIAL_PRESET = {
  wall: { color: 0x6b6f78, roughness: 0.95 },
  crate: { color: 0x9a6b3d, roughness: 0.9 },
  pillar: { color: 0x565b66, roughness: 0.9 },
};

export class World {
  constructor(scene) {
    this.scene = scene;
    this.obstacles = [];
    this.colliderMeshes = [];
    this.boundary = ARENA_SIZE / 2;
    // 射线查询每帧都会调用，复用对象避免重复分配
    this.raycaster = new THREE.Raycaster();
    this.rayFrom = new THREE.Vector3();
    this.rayDirection = new THREE.Vector3();

    this.#buildSky();
    this.#buildGround();
    this.#buildBoundary();
    this.#buildObstacles();
  }

  /* ------------------------------ 场景搭建 ------------------------------ */

  #buildSky() {
    this.scene.background = new THREE.Color(0x0d1420);
    this.scene.fog = new THREE.Fog(0x0d1420, 34, 82);

    const hemisphereLight = new THREE.HemisphereLight(0xbcd4ff, 0x2b2418, 1.05);
    this.scene.add(hemisphereLight);

    const sunLight = new THREE.DirectionalLight(0xffe9c4, 1.5);
    sunLight.position.set(26, 40, 18);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 140;
    const shadowRange = ARENA_SIZE * 0.75;
    sunLight.shadow.camera.left = -shadowRange;
    sunLight.shadow.camera.right = shadowRange;
    sunLight.shadow.camera.top = shadowRange;
    sunLight.shadow.camera.bottom = -shadowRange;
    this.scene.add(sunLight);

    const ambientLight = new THREE.AmbientLight(0x404a5c, 0.7);
    this.scene.add(ambientLight);
  }

  /** 用程序生成的画布纹理铺地面，避免依赖外部贴图资源 */
  #buildGround() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');

    context.fillStyle = '#3c3a33';
    context.fillRect(0, 0, 256, 256);

    for (let index = 0; index < 2600; index += 1) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const tone = 40 + Math.random() * 45;
      context.fillStyle = `rgba(${tone + 20}, ${tone + 14}, ${tone}, ${0.35 + Math.random() * 0.4})`;
      context.fillRect(x, y, 2 + Math.random() * 3, 2 + Math.random() * 3);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(ARENA_SIZE / 6, ARENA_SIZE / 6);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(ARENA_SIZE, ARENA_SIZE),
      new THREE.MeshLambertMaterial({ map: texture }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  /** 四周高墙，既是视觉边界也是碰撞边界 */
  #buildBoundary() {
    const wallHeight = 4;
    const wallThickness = 1;
    const half = this.boundary;

    const specs = [
      { x: 0, z: -half - wallThickness / 2, w: ARENA_SIZE + wallThickness * 2, d: wallThickness },
      { x: 0, z: half + wallThickness / 2, w: ARENA_SIZE + wallThickness * 2, d: wallThickness },
      { x: -half - wallThickness / 2, z: 0, w: wallThickness, d: ARENA_SIZE + wallThickness * 2 },
      { x: half + wallThickness / 2, z: 0, w: wallThickness, d: ARENA_SIZE + wallThickness * 2 },
    ];

    for (const spec of specs) {
      this.#addBox({
        ...spec,
        h: wallHeight,
        kind: 'wall',
        color: 0x2f3541,
        blocksBullet: true,
      });
    }
  }

  /** 内部掩体：对每个规格额外生成 180° 旋转对称的一份，保证双方公平 */
  #buildObstacles() {
    for (const spec of OBSTACLE_SPECS) {
      this.#addBox(spec);
      this.#addBox({ ...spec, x: -spec.x, z: -spec.z });
    }
    this.#collectColliders();
  }

  #addBox({ x, z, w, d, h, kind, color, blocksBullet = true }) {
    const preset = MATERIAL_PRESET[kind] ?? MATERIAL_PRESET.crate;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color: color ?? preset.color }),
    );
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    this.obstacles.push({
      x,
      z,
      halfWidth: w / 2,
      halfDepth: d / 2,
      height: h,
      blocksBullet,
      mesh,
    });
  }

  #collectColliders() {
    this.colliderMeshes = this.obstacles
      .filter((obstacle) => obstacle.blocksBullet)
      .map((obstacle) => obstacle.mesh);
  }

  /* ------------------------------ 查询接口 ------------------------------ */

  get boundaryLimit() {
    return this.boundary;
  }

  /**
   * 把圆形实体推出所有重叠的掩体与边界。
   * @param {THREE.Vector3} position 实体位置（会被就地修改）
   * @param {number} radius 实体半径
   */
  resolveCollision(position, radius) {
    for (const obstacle of this.obstacles) {
      // 实体高度低于掩体时才需要阻挡（掩体目前均为落地实体，统一处理）
      const closestX = THREE.MathUtils.clamp(
        position.x,
        obstacle.x - obstacle.halfWidth,
        obstacle.x + obstacle.halfWidth,
      );
      const closestZ = THREE.MathUtils.clamp(
        position.z,
        obstacle.z - obstacle.halfDepth,
        obstacle.z + obstacle.halfDepth,
      );

      const deltaX = position.x - closestX;
      const deltaZ = position.z - closestZ;
      const distanceSquared = deltaX * deltaX + deltaZ * deltaZ;

      if (distanceSquared >= radius * radius) {
        continue;
      }

      if (distanceSquared > 1e-6) {
        // 位于掩体外侧：沿最近点方向推出
        const distance = Math.sqrt(distanceSquared);
        position.x = closestX + (deltaX / distance) * radius;
        position.z = closestZ + (deltaZ / distance) * radius;
      } else {
        // 圆心陷入掩体内部：沿穿透最浅的轴推出
        const overlapLeft = Math.abs(position.x - (obstacle.x - obstacle.halfWidth));
        const overlapRight = Math.abs(obstacle.x + obstacle.halfWidth - position.x);
        const overlapBack = Math.abs(position.z - (obstacle.z - obstacle.halfDepth));
        const overlapFront = Math.abs(obstacle.z + obstacle.halfDepth - position.z);
        const minOverlap = Math.min(overlapLeft, overlapRight, overlapBack, overlapFront);

        if (minOverlap === overlapLeft) {
          position.x = obstacle.x - obstacle.halfWidth - radius;
        } else if (minOverlap === overlapRight) {
          position.x = obstacle.x + obstacle.halfWidth + radius;
        } else if (minOverlap === overlapBack) {
          position.z = obstacle.z - obstacle.halfDepth - radius;
        } else {
          position.z = obstacle.z + obstacle.halfDepth + radius;
        }
      }
    }

    const limit = this.boundary - radius;
    position.x = THREE.MathUtils.clamp(position.x, -limit, limit);
    position.z = THREE.MathUtils.clamp(position.z, -limit, limit);
  }

  /**
   * 直线是否被掩体挡住（用于视线与子弹遮挡）。
   * @param {THREE.Vector3} from 起点
   * @param {THREE.Vector3} to 终点
   * @returns {boolean} 被遮挡返回 true
   */
  isLineBlocked(from, to) {
    this.rayDirection.subVectors(to, from);
    const distance = this.rayDirection.length();
    if (distance < 1e-4) {
      return false;
    }

    this.rayFrom.copy(from);
    this.rayDirection.normalize();
    this.raycaster.set(this.rayFrom, this.rayDirection);
    this.raycaster.far = distance;
    const hits = this.raycaster.intersectObjects(this.colliderMeshes, false);
    return hits.length > 0;
  }

  /** 补给刷新点位：均匀铺开在场地内且不压在掩体上 */
  buildPickupSpots(count) {
    const spots = [];
    const limit = this.boundary - 4;
    const gridStep = (limit * 2) / Math.ceil(Math.sqrt(count));

    for (let x = -limit + gridStep / 2; x <= limit && spots.length < count; x += gridStep) {
      for (let z = -limit + gridStep / 2; z <= limit && spots.length < count; z += gridStep) {
        if (this.#isPointFree(x, z, 1.6)) {
          spots.push({ x, z });
        }
      }
    }

    return spots;
  }

  #isPointFree(x, z, clearance) {
    for (const obstacle of this.obstacles) {
      const insideX = Math.abs(x - obstacle.x) < obstacle.halfWidth + clearance;
      const insideZ = Math.abs(z - obstacle.z) < obstacle.halfDepth + clearance;
      if (insideX && insideZ) {
        return false;
      }
    }
    return true;
  }
}
