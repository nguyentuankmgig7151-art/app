/**
 * 离线断言：验证 Review 修复项
 *  - 首页（仅 data.js + main.js）回退版 addToCart 必须按库存封顶（防超卖）
 *  - 首页引入 cart.js 后统一走购物车模块，行为与购物车页一致
 *  - getCart/normalize 过滤目录中不存在的商品 id
 *  - 未知商品加购被拒绝
 * 纯 Node，无第三方依赖；不修改任何源文件。
 */
"use strict";

const fs = require("fs");
const vm = require("vm");
const path = require("path");

const ROOT = path.join(__dirname, "snack-shop");
const failures = [];
function assert(cond, msg) {
  if (cond) {
    console.log("PASS - " + msg);
  } else {
    console.log("FAIL - " + msg);
    failures.push(msg);
  }
}

function makeEl(tag) {
  const el = {
    tagName: tag,
    children: [],
    style: {},
    attributes: {},
    _text: "",
    hidden: false,
    disabled: false,
    value: "",
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute(k, v) { this.attributes[k] = v; },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null; },
    appendChild(c) { this.children.push(c); return c; },
    removeChild() {},
    addEventListener() {},
    querySelector() { return null; },
    set innerHTML(_v) { this.children = []; },
    get innerHTML() { return ""; },
    set textContent(v) { this._text = v; },
    get textContent() { return this._text; },
    get parentNode() { return null; }
  };
  return el;
}

function makeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear()
  };
}

function makeContext(page) {
  const doc = {
    readyState: "loading", // 只执行模块级代码，不触发 DOMContentLoaded 初始化
    addEventListener() {},
    createElement: (t) => makeEl(t),
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementById() { return null; }
  };
  doc.body = makeEl("body");
  doc.body.getAttribute = () => page;

  const ctx = {};
  ctx.window = ctx;
  ctx.document = doc;
  ctx.console = console;
  ctx.setTimeout = () => 0;
  ctx.clearTimeout = () => {};
  ctx.requestAnimationFrame = (fn) => { if (fn) fn(); return 0; };
  ctx.localStorage = makeStorage();
  ctx.URLSearchParams = URLSearchParams;
  ctx.location = { search: "" };
  return ctx;
}

function loadScript(ctx, rel) {
  const code = fs.readFileSync(path.join(ROOT, rel), "utf8");
  vm.runInNewContext(code, ctx, { filename: rel });
}

const CART_KEY = "snack_cart";

/* ============ 场景 A：首页仅 data.js + main.js（回退实现）必须封顶 ============ */
(function scenarioA() {
  console.log("\n--- 场景 A：main.js 回退版 addToCart（无 cart.js）---");
  const ctx = makeContext("home");
  loadScript(ctx, "js/data.js");
  loadScript(ctx, "js/main.js");

  const products = ctx.PRODUCTS;
  const low = products
    .filter((p) => p.stock > 0)
    .sort((a, b) => a.stock - b.stock)[0];
  assert(!!low, "存在库存 <=5 的可购商品用于超卖测试");

  const ok = ctx.window.addToCart(low.id, 999);
  const item = ctx.window.getCart().find((x) => x.id === low.id);
  assert(ok === true, "首次超量加购返回 true");
  assert(item && item.qty === low.stock, `回退版按库存封顶：qty=${item && item.qty} === stock=${low.stock}`);

  // 再次加购应被拒绝（已达上限）
  const again = ctx.window.addToCart(low.id, 1);
  const item2 = ctx.window.getCart().find((x) => x.id === low.id);
  assert(again === false, "已达库存上限再次加购返回 false");
  assert(item2 && item2.qty === low.stock, "再次加购后仍等于库存，无超卖");

  // 未知商品
  const unknown = ctx.window.addToCart("p-nonexistent", 1);
  assert(unknown === false, "未知商品加购返回 false");
  assert(!ctx.window.getCart().some((x) => x.id === "p-nonexistent"), "未知商品未写入购物车");

  // 脏数据过滤（直接注入 localStorage）
  ctx.localStorage.setItem(CART_KEY, JSON.stringify([{ id: "p-ghost", qty: 3 }, { id: low.id, qty: 2 }]));
  const filtered = ctx.window.getCart();
  assert(!filtered.some((x) => x.id === "p-ghost"), "main.js getCart 过滤未知 id");
  assert(ctx.window.getCartCount() === 2, "main.js getCartCount 忽略未知 id");
})();

/* ============ 场景 B：首页引入 cart.js 后，统一走购物车模块 ============ */
(function scenarioB() {
  console.log("\n--- 场景 B：index.html 脚本顺序 data → cart → main ---");
  const ctx = makeContext("home");
  loadScript(ctx, "js/data.js");
  loadScript(ctx, "js/cart.js");
  loadScript(ctx, "js/main.js");

  assert(ctx.window.addToCart === ctx.Cart.addToCart, "window.addToCart 指向 cart.js 统一实现");

  const products = ctx.PRODUCTS;
  const low = products
    .filter((p) => p.stock > 0)
    .sort((a, b) => a.stock - b.stock)[0];

  ctx.window.addToCart(low.id, 999);
  const item = ctx.window.getCart().find((x) => x.id === low.id);
  assert(item && item.qty === low.stock, `首页统一实现按库存封顶：qty=${item && item.qty}`);

  // 预注入脏数据后，cart.js normalize 也应过滤
  ctx.localStorage.setItem(CART_KEY, JSON.stringify([{ id: "p-ghost", qty: 3 }, { id: low.id, qty: 1 }]));
  const normalized = ctx.window.Cart.getCart();
  assert(!normalized.some((x) => x.id === "p-ghost"), "cart.js normalize 过滤未知 id");
})();

console.log("\n==============================");
if (failures.length) {
  console.log(`结果：${failures.length} 项失败`);
  failures.forEach((f) => console.log("  - " + f));
  process.exit(1);
} else {
  console.log("结果：全部断言通过");
  process.exit(0);
}
