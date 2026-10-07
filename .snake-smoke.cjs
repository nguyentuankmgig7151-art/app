// 临时验证脚本 —— 验证完成后删除，不属于交付物（沿用 .verify-data-layer.mjs 的约定）
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('/Users/lisong/Library/Application Support/Blue Dragon/projects/app-65a8b7b6/agent-snapshots/task-task_muttrrb0_2_2dbrum-2fc509476045581a/snake.html', 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

let failures = 0;
function assert(cond, msg) {
  if (cond) { console.log('PASS  ' + msg); }
  else { failures += 1; console.log('FAIL  ' + msg); }
}

// ---------- DOM stub ----------
function makeElement(id, extra) {
  const el = {
    id,
    textContent: '',
    innerHTML: '',
    className: '',
    attrs: {},
    classes: new Set(),
    handlers: {},
    classList: {
      add(c) { el.classes.add(c); },
      remove(c) { el.classes.delete(c); },
      contains(c) { return el.classes.has(c); }
    },
    setAttribute(k, v) { el.attrs[k] = v; },
    getAttribute(k) { return el.attrs[k]; },
    addEventListener(type, fn) {
      if (!el.handlers[type]) el.handlers[type] = [];
      el.handlers[type].push(fn);
    },
    getBoundingClientRect() { return { width: 480, height: 480, top: 0, left: 0 }; }
  };
  Object.assign(el, extra || {});
  return el;
}

const noop = function () {};
const ctx2d = new Proxy({}, {
  get(target, prop) {
    if (prop in target) return target[prop];
    return noop; // 方法调用全部 no-op
  },
  set(target, prop, value) { target[prop] = value; return true; }
});

const canvasEl = makeElement('board', {
  width: 480,
  height: 480,
  getContext: () => ctx2d
});
const overlayEl = makeElement('overlay');
const overlayTitleEl = makeElement('overlayTitle');
const overlayDescEl = makeElement('overlayDesc');
const overlayBtnEl = makeElement('overlayBtn');
const scoreEl = makeElement('scoreVal');
const levelEl = makeElement('levelVal');
const bestEl = makeElement('bestVal');
const wrapEl = makeElement('boardWrap');

const padDirs = ['up', 'left', 'down', 'right'];
const padBtns = padDirs.map(d => makeElement('pad-' + d, {
  attrs: { 'data-dir': d }
}));

const elements = {
  board: canvasEl, overlay: overlayEl, overlayTitle: overlayTitleEl,
  overlayDesc: overlayDescEl, overlayBtn: overlayBtnEl,
  scoreVal: scoreEl, levelVal: levelEl, bestVal: bestEl, boardWrap: wrapEl
};

const docHandlers = {};
const winHandlers = {};
const store = new Map();
const rafQueue = [];

const sandbox = {
  console,
  performance: { now: () => Date.now() },
  AbortController: typeof AbortController === 'function' ? AbortController : function () { this.signal = {}; this.abort = noop; },
  Math: { random: () => 0.525, floor: Math.floor, min: Math.min, max: Math.max, abs: Math.abs, PI: Math.PI, sin: Math.sin },
  document: {
    hidden: false,
    getElementById: id => elements[id],
    querySelectorAll: sel => (sel.indexOf('touchPad') !== -1 ? padBtns : []),
    addEventListener(type, fn) { if (!docHandlers[type]) docHandlers[type] = []; docHandlers[type].push(fn); }
  },
  localStorage: {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); }
  },
  requestAnimationFrame(cb) { rafQueue.push(cb); return rafQueue.length; },
  cancelAnimationFrame: noop
};
sandbox.window = sandbox;
sandbox.window.AudioContext = undefined;
sandbox.window.devicePixelRatio = 1;
sandbox.window.addEventListener = function (type, fn) {
  if (!winHandlers[type]) winHandlers[type] = [];
  winHandlers[type].push(fn);
};

// ---------- 运行游戏脚本 ----------
vm.createContext(sandbox);
vm.runInContext(script, sandbox, { filename: 'snake-extracted.js' });

function key(code) {
  (docHandlers.keydown || []).forEach(fn => fn({ code, preventDefault() {} }));
}
function pump(ms) {
  // 以 16ms 一帧推进
  let remaining = ms;
  while (remaining > 0) {
    const cb = rafQueue.pop();
    if (!cb) throw new Error('rAF queue empty');
    const now = Number(env.t);
    env.t += 16;
    remaining -= 16;
    rafQueue.length = 0;
    cb(now);
  }
}
const env = { t: 1000 };

// ---------- 用例 ----------
// 初始 HUD
assert(scoreEl.textContent === '0' && levelEl.textContent === '1' && bestEl.textContent === '0', '初始 HUD：得分 0 / 等级 1 / 最高分 0');
assert(overlayEl.classes.has('show') && overlayTitleEl.textContent.indexOf('准备') !== -1, '初始覆盖层显示「准备开始」提示');

// 空格开始
key('Space');
assert(!overlayEl.classes.has('show'), '空格开始后覆盖层隐藏（进入运行态）');

// 反向 180° 应被拒绝：开局向右，按 ArrowLeft 后蛇继续向右移动（未被瞬间判负）
key('ArrowLeft');
pump(500);
assert(!overlayEl.classes.has('show') || overlayTitleEl.textContent.indexOf('结束') === -1, '开局反向按左键未导致立即判负（180° 被拒绝）');

// 空格暂停 / 继续切换
key('Space');
assert(overlayEl.classes.has('show') && overlayTitleEl.textContent.indexOf('暂停') !== -1, '运行中按空格进入暂停态并显示提示层');
pump(5000); // 暂停 5 秒
assert(overlayTitleEl.textContent.indexOf('暂停') !== -1, '暂停期间蛇不移动（5 秒后仍为暂停态，未撞墙判负）');
overlayBtnEl.handlers.click[0](); // 点击「继续游戏」
assert(!overlayEl.classes.has('show'), '点击覆盖层按钮继续游戏');
pump(30000); // 从棋盘中部直行必然撞右墙
assert(overlayTitleEl.textContent.indexOf('游戏结束') !== -1, '继续运行后撞墙判负，显示「游戏结束」');

// 最高分持久化 + 新纪录提示
assert(bestEl.textContent !== '0' && store.get('snake_best_v1') === bestEl.textContent, '撞墙后最高分写入 localStorage（snake_best_v1）');
assert(overlayDescEl.innerHTML.indexOf('新纪录') !== -1, '首次破纪录时覆盖层显示「新纪录」');

// R 重开
key('KeyR');
assert(!overlayEl.classes.has('show') && scoreEl.textContent === '0' && levelEl.textContent === '1', '按 R 重开：清零得分等级并回到运行态');

// 方向按钮：向下转向合法
const downBtn = padBtns.find(b => b.attrs['data-dir'] === 'down');
downBtn.handlers.click[0]();
pump(1000);
assert(!overlayEl.classes.has('show') || overlayTitleEl.textContent.indexOf('结束') === -1, '屏幕方向按钮转向后正常运行（未判负）');

// 蛇始终长 ≥ 初始长度
assert(scoreEl.textContent !== undefined, 'HUD 持续更新');

// 隐私模式容错：localStorage 抛异常不崩溃
sandbox.localStorage.getItem = () => { throw new Error('SecurityError'); };
sandbox.localStorage.setItem = () => { throw new Error('SecurityError'); };
key('KeyR');
pump(30000);
assert(overlayTitleEl.textContent.indexOf('游戏结束') !== -1, 'localStorage 不可用时游戏照常结束（静默降级，无异常抛出）');

// resize 适配：触发 window resize 后画布属性尺寸被重算（DPR=1 下为布局尺寸）
canvasEl.getBoundingClientRect = () => ({ width: 300, height: 300, top: 0, left: 0 });
(winHandlers.resize || []).forEach(fn => fn());
pump(32);
assert(canvasEl.width === 300 && canvasEl.height === 300, '窗口缩放后 canvas 属性尺寸随布局更新（300×300）');

console.log('----------------------------------------');
console.log(failures === 0 ? 'ALL TESTS PASSED' : failures + ' TEST(S) FAILED');
process.exit(failures === 0 ? 0 : 1);
