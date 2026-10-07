/**
 * snack-shop / js/cart.js
 * 购物车模块 + 购物车页（cart.html）渲染
 *
 * 依赖：js/data.js（全局 PRODUCTS）、js/main.js（可选，提供 window.showToast / 角标同步）
 *
 * localStorage 契约（全站唯一，勿改名）：
 *   key   = "snack_cart"
 *   value = JSON.stringify([{ id: "p001", qty: 2 }, ...])
 *
 * 对外暴露：window.Cart（完整 API）、window.addToCart / window.getCart /
 *           window.updateCartBadge / window.getCartCount（供 main.js 卡片复用）
 */
(function () {
  "use strict";

  var CART_KEY = "snack_cart";

  var CATEGORY_EMOJI = {
    "薯片": "🍟",
    "饼干": "🍪",
    "糖果": "🍬",
    "坚果": "🥜",
    "饮料": "🥤",
    "进口": "🌍",
    "全部": "🛍️"
  };

  /* ---------------- 基础工具 ---------------- */

  function $(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  function findProduct(id) {
    var list = window.PRODUCTS || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function stockOf(id) {
    var p = findProduct(id);
    return p ? Math.max(0, Math.floor(Number(p.stock) || 0)) : 0;
  }

  function toast(msg, type) {
    if (typeof window.showToast === "function") window.showToast(msg, type);
  }

  function formatPrice(value) {
    var n = Number(value);
    if (!isFinite(n)) return "¥0.00";
    return "¥" + n.toFixed(2);
  }

  /* ---------------- 读写 localStorage ---------------- */

  function readRaw() {
    try {
      var raw = window.localStorage.getItem(CART_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function normalize(list) {
    var hasCatalog = !!(window.PRODUCTS && window.PRODUCTS.length);
    return list
      .filter(function (item) {
        return item && typeof item.id === "string" && Number(item.qty) > 0;
      })
      .map(function (item) {
        return { id: item.id, qty: Math.floor(Number(item.qty)) };
      })
      .filter(function (item) {
        // 目录已加载时剔除已下架/不存在的商品，避免脏数据在购物车中残留
        return !hasCatalog || !!findProduct(item.id);
      });
  }

  function getCart() {
    return normalize(readRaw());
  }

  function saveCart(cart) {
    try {
      window.localStorage.setItem(CART_KEY, JSON.stringify(normalize(cart)));
      return true;
    } catch (err) {
      return false;
    }
  }

  function getCartCount() {
    return getCart().reduce(function (sum, item) {
      return sum + item.qty;
    }, 0);
  }

  function getCartTotal() {
    return getCart().reduce(function (sum, item) {
      var p = findProduct(item.id);
      return sum + (p ? Number(p.price) * item.qty : 0);
    }, 0);
  }

  function getCartDetailed() {
    var result = [];
    getCart().forEach(function (item) {
      var p = findProduct(item.id);
      if (p) {
        result.push({
          id: item.id,
          qty: item.qty,
          product: p,
          subtotal: Number(p.price) * item.qty
        });
      }
    });
    return result;
  }

  /* ---------------- 角标 ---------------- */

  function updateCartBadge() {
    var badge = document.getElementById("cart-badge");
    if (!badge) return;
    var count = getCartCount();
    badge.textContent = String(count);
    badge.hidden = count <= 0;
  }

  /* ---------------- 增删改 ---------------- */

  function addToCart(id, qty) {
    qty = Math.max(1, Math.floor(Number(qty) || 1));
    var product = findProduct(id);
    if (!product) {
      toast("商品不存在", "error");
      return false;
    }
    var stock = Math.max(0, Math.floor(Number(product.stock) || 0));
    if (stock <= 0) {
      toast("该商品暂时缺货", "error");
      return false;
    }

    var cart = getCart();
    var found = null;
    for (var i = 0; i < cart.length; i++) {
      if (cart[i].id === id) {
        found = cart[i];
        break;
      }
    }
    var current = found ? found.qty : 0;
    var target = Math.min(current + qty, stock);
    var added = target - current;
    if (added <= 0) {
      toast("已达库存上限", "error");
      return false;
    }
    if (found) {
      found.qty = target;
    } else {
      cart.push({ id: id, qty: target });
    }
    saveCart(cart);
    updateCartBadge();
    toast("已加入购物车 🛒", "success");
    return true;
  }

  function setQty(id, qty) {
    qty = Math.floor(Number(qty) || 0);
    var cart = getCart();
    var stock = stockOf(id);
    for (var i = 0; i < cart.length; i++) {
      if (cart[i].id === id) {
        if (qty <= 0) {
          cart.splice(i, 1);
        } else {
          cart[i].qty = stock > 0 ? Math.min(qty, stock) : qty;
        }
        break;
      }
    }
    saveCart(cart);
    updateCartBadge();
    return cart;
  }

  function changeQty(id, delta) {
    var current = 0;
    getCart().forEach(function (item) {
      if (item.id === id) current = item.qty;
    });
    return setQty(id, current + Number(delta || 0));
  }

  function removeFromCart(id) {
    var cart = getCart().filter(function (item) {
      return item.id !== id;
    });
    saveCart(cart);
    updateCartBadge();
    return cart;
  }

  function clearCart() {
    saveCart([]);
    updateCartBadge();
    return [];
  }

  /* ---------------- 购物车页渲染 ---------------- */

  function createCartMedia(product) {
    var media = document.createElement("div");
    media.className = "cart-item-media";

    var fallback = document.createElement("div");
    fallback.className = "media-fallback";
    fallback.textContent = CATEGORY_EMOJI[product.category] || "🍫";
    media.appendChild(fallback);

    if (product.image) {
      var img = document.createElement("img");
      img.src = product.image;
      img.alt = product.name;
      img.loading = "lazy";
      img.addEventListener("error", function () {
        media.classList.add("is-fallback");
      });
      media.appendChild(img);
    } else {
      media.classList.add("is-fallback");
    }
    return media;
  }

  function createCartRow(item) {
    var product = item.product;
    var stock = Math.max(0, Math.floor(Number(product.stock) || 0));

    var row = document.createElement("article");
    row.className = "cart-item";
    row.setAttribute("data-id", product.id);

    row.appendChild(createCartMedia(product));

    var body = document.createElement("div");
    body.className = "cart-item-body";

    var name = document.createElement("a");
    name.className = "cart-item-name";
    name.href = "product.html?id=" + encodeURIComponent(product.id);
    name.textContent = product.name;
    body.appendChild(name);

    var unit = document.createElement("span");
    unit.className = "cart-item-price";
    unit.textContent = formatPrice(product.price) + " / 件";
    body.appendChild(unit);

    var actions = document.createElement("div");
    actions.className = "cart-item-actions";

    // 数量步进器
    var stepper = document.createElement("div");
    stepper.className = "qty-stepper";

    var dec = document.createElement("button");
    dec.type = "button";
    dec.textContent = "−";
    dec.setAttribute("aria-label", "减少数量");
    dec.addEventListener("click", function () {
      changeQty(product.id, -1);
      renderCartPage();
    });
    stepper.appendChild(dec);

    var val = document.createElement("span");
    val.className = "qty-value";
    val.textContent = String(item.qty);
    stepper.appendChild(val);

    var inc = document.createElement("button");
    inc.type = "button";
    inc.textContent = "+";
    inc.setAttribute("aria-label", "增加数量");
    if (item.qty >= stock) inc.disabled = true;
    inc.addEventListener("click", function () {
      changeQty(product.id, 1);
      renderCartPage();
    });
    stepper.appendChild(inc);

    actions.appendChild(stepper);

    var subtotal = document.createElement("span");
    subtotal.className = "cart-item-subtotal";
    subtotal.textContent = "小计 " + formatPrice(item.subtotal);
    actions.appendChild(subtotal);

    var remove = document.createElement("button");
    remove.type = "button";
    remove.className = "link-danger";
    remove.textContent = "删除";
    remove.addEventListener("click", function () {
      removeFromCart(product.id);
      renderCartPage();
      toast("已移除该商品", "info");
    });
    actions.appendChild(remove);

    body.appendChild(actions);
    row.appendChild(body);
    return row;
  }

  function renderCartPage() {
    var listEl = $("#cart-list");
    if (!listEl) return;

    var summaryEl = $("#cart-summary");
    var detailed = getCartDetailed();
    listEl.innerHTML = "";

    if (!detailed.length) {
      listEl.innerHTML =
        '<div class="cart-empty">' +
        '<span class="emoji">🛒</span>' +
        "购物车还是空的，去挑点好吃的吧<br><br>" +
        '<a class="btn btn-primary" href="products.html">去逛逛</a>' +
        "</div>";
      if (summaryEl) summaryEl.hidden = true;
      updateCartBadge();
      return;
    }

    if (summaryEl) summaryEl.hidden = false;

    var frag = document.createDocumentFragment();
    detailed.forEach(function (item) {
      frag.appendChild(createCartRow(item));
    });
    listEl.appendChild(frag);

    var totalEl = $("#cart-total");
    if (totalEl) {
      totalEl.innerHTML = '<span class="unit">¥</span>' + getCartTotal().toFixed(2);
    }
    var countEl = $("#cart-total-count");
    if (countEl) countEl.textContent = String(getCartCount());

    updateCartBadge();
  }

  /* ---------------- 购物车页初始化 ---------------- */

  function initCartPage() {
    if (!document.body || document.body.getAttribute("data-page") !== "cart") return;

    renderCartPage();

    var clearBtn = $("#clear-cart");
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        if (!getCart().length) {
          toast("购物车已经是空的", "info");
          return;
        }
        if (window.confirm && !window.confirm("确定清空购物车吗？")) return;
        clearCart();
        renderCartPage();
        toast("已清空购物车", "info");
      });
    }

    var checkoutBtn = $("#checkout-btn");
    if (checkoutBtn) {
      checkoutBtn.addEventListener("click", function () {
        toast("演示站点，结算功能开发中 🧾", "info");
      });
    }

    window.addEventListener("storage", function (event) {
      if (!event || event.key === CART_KEY || event.key == null) renderCartPage();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCartPage);
  } else {
    initCartPage();
  }

  /* ---------------- 对外暴露 ---------------- */

  window.Cart = {
    CART_KEY: CART_KEY,
    getCart: getCart,
    saveCart: saveCart,
    addToCart: addToCart,
    setQty: setQty,
    changeQty: changeQty,
    removeFromCart: removeFromCart,
    clearCart: clearCart,
    getCartCount: getCartCount,
    getCartTotal: getCartTotal,
    getCartDetailed: getCartDetailed,
    updateCartBadge: updateCartBadge,
    renderCartPage: renderCartPage
  };

  window.addToCart = addToCart;
  window.getCart = window.getCart || getCart;
  window.getCartCount = getCartCount;
  window.updateCartBadge = updateCartBadge;
  window.findProduct = window.findProduct || findProduct;
})();
