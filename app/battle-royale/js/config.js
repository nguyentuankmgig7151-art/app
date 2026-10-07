/**
 * 游戏基础配置：竞技场尺寸、玩家参数、武器与道具数据。
 * 所有数值集中在此，便于统一调平衡，避免散落在逻辑代码里形成魔法数字。
 */

/** 竞技场为正方形，边长（世界单位 ≈ 米） */
export const ARENA_SIZE = 60;

/** 玩家半径，用于与掩体的圆形碰撞检测 */
export const PLAYER_RADIUS = 0.45;

/** 玩家眼高（相机高度） */
export const EYE_HEIGHT = 1.7;

/** 玩家身体高度，用于命中判定与被遮挡检测 */
export const BODY_HEIGHT = 1.8;

/** 玩家初始与上限生命值 */
export const MAX_HEALTH = 100;

/** 移动速度（米/秒）：普通 / 冲刺 */
export const MOVE_SPEED = 5.2;
export const SPRINT_SPEED = 7.8;

/** 转向速度（弧度/秒） */
export const TURN_SPEED = 2.3;

/** 分钟：自动开火需要的瞄准容差（弧度），约 6 度 */
export const AIM_TOLERANCE = 0.105;

/** 复活/回血相关：医疗包拾取恢复的生命值 */
export const MEDKIT_HEAL = 40;

/** 出生点保护时间（毫秒），避免开局即被秒 */
export const SPAWN_PROTECT_MS = 1500;

/**
 * 武器数据表。
 * damage      单发（霰弹为单颗弹丸）伤害
 * pellets     一次射击发射的弹丸数量
 * fireInterval 两发之间的最短间隔（毫秒）
 * ammo        拾取时获得的弹药数
 * range       有效射程（米）
 * spread      弹道散布（弧度）；命中判定时按此概率模型判定是否脱靶
 * reloadCost  打空后移除武器的延迟（毫秒），交战中不会瞬间消失
 */
export const WEAPONS = {
  pistol: {
    id: 'pistol',
    name: '手枪',
    damage: 14,
    pellets: 1,
    fireInterval: 260,
    ammo: 60,
    range: 34,
    spread: 0.02,
    color: 0xd8d8d8,
  },
  rifle: {
    id: 'rifle',
    name: '步枪',
    damage: 11,
    pellets: 1,
    fireInterval: 120,
    ammo: 120,
    range: 48,
    spread: 0.014,
    color: 0xb98b47,
  },
  shotgun: {
    id: 'shotgun',
    name: '霰弹枪',
    damage: 9,
    pellets: 6,
    fireInterval: 850,
    ammo: 30,
    range: 16,
    spread: 0.02,
    color: 0x8c5a35,
  },
  sniper: {
    id: 'sniper',
    name: '狙击枪',
    damage: 62,
    pellets: 1,
    fireInterval: 1500,
    ammo: 15,
    range: 90,
    spread: 0.004,
    color: 0x4f7a4a,
  },
};

/** 地面补给箱中可能刷出的武器（重复出现用于控制刷新权重） */
export const WEAPON_SPAWN_POOL = [
  'pistol', 'pistol', 'pistol',
  'rifle', 'rifle', 'rifle',
  'shotgun', 'shotgun',
  'sniper',
];

/** 道具类型 */
export const PICKUP_TYPE = {
  WEAPON: 'weapon',
  MEDKIT: 'medkit',
};

/** 补给箱刷新间隔（毫秒） */
export const PICKUP_RESPAWN_MS = 9000;

/** 拾取半径（米） */
export const PICKUP_RADIUS = 1.5;

/**
 * 两名玩家的操作映射。
 * forward/backward 为前进后退，turnLeft/turnRight 为水平转向，sprint 为冲刺。
 * 使用 KeyboardEvent.code，避免受输入法/大小写影响。
 */
export const PLAYER_INPUTS = [
  {
    forward: 'KeyW',
    backward: 'KeyS',
    turnLeft: 'KeyA',
    turnRight: 'KeyD',
    sprint: ['ShiftLeft', 'ShiftRight'],
    label: '玩家 1',
  },
  {
    forward: 'ArrowUp',
    backward: 'ArrowDown',
    turnLeft: 'ArrowLeft',
    turnRight: 'ArrowRight',
    sprint: ['ControlLeft', 'ControlRight'],
    label: '玩家 2',
  },
];

/** 玩家配色（身体与 HUD 保持一致） */
export const PLAYER_COLORS = [0x3f7fd6, 0xd6543f];

/** 出生点（对称分布，位于竞技场对角） */
export const SPAWN_POINTS = [
  { x: -22, z: -22, yaw: Math.PI * 0.25 },
  { x: 22, z: 22, yaw: -Math.PI * 0.75 },
];
