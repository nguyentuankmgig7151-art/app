/**
 * snack-shop / js/main.js
 * 通用逻辑：商品卡片渲染、分类入口、搜索跳转、购物车角标同步、Toast 工具
 *
 * 依赖：js/data.js（全局 PRODUCTS / CATEGORIES）
 * 对外暴露（挂到 window）：showToast、formatPrice、addToCart、updateCartBadge
 *
 * localStorage 契约（与 cart.js 保持一致）：
 *   key   = "snack_cart"
 *   value = JSON.stringify([{ id: "p001", qty: 2 }, ...])
 */
(function () {
  "use strict";

  var CART_KEY = "snack_cart";

  /* ---------------- 分类表情映射（仅用于分类快捷入口） ---------------- */
  var CATEGORY_EMOJI = {
    "薯片": "🍟",
    "饼干": "🍪",
    "糖果": "🍬",
    "坚果": "🥜",
    "饮料": "🥤",
    "进口": "🌍",
    "全部": "🛍️"
  };

  /* ---------------- 工具函数 ---------------- */

  function $(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  function formatPrice(value) {
    var n = Number(value);
    if (!isFinite(n)) return "¥0.00";
    return "¥" + n.toFixed(2);
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (ch) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[ch];
    });
  }

  /* ---------------- Toast ---------------- */

  function showToast(msg, type) {
    var container = $("#toast-container");
    if (!container) {
      // 兜底：页面未放容器时动态创建
      container = document.createElement("div");
      container.className = "toast-container";
      container.id = "toast-container";
      container.setAttribute("aria-live", "polite");
      document.body.appendChild(container);
    }

    // 同一时刻只保留一个 toast
    container.innerHTML = "";

    var toast = document.createElement("div");
    toast.className = "toast toast-" + (type || "info");
    toast.setAttribute("role", "status");
    toast.textContent = msg;
    container.appendChild(toast);

    // 下一帧进入，触发过渡
    requestAnimationFrame(function () {
      toast.classList.add("is-visible");
    });

    setTimeout(function () {
      toast.classList.remove("is-visible");
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 2000);
  }

  /* ---------------- 购物车：localStorage 读写（与 cart.js 契约一致） ---------------- */

  function getCart() {
    try {
      var raw = window.localStorage.getItem(CART_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(function (item) {
          return item && typeof item.id === "string" && Number(item.qty) > 0;
        })
        .map(function (item) {
          return { id: item.id, qty: Math.floor(Number(item.qty)) };
        })
        .filter(function (item) {
          // 同时剔除目录中已不存在的商品 id，避免脏数据残留
          return !!findProduct(item.id);
        });
    } catch (err) {
      return [];
    }
  }

  function saveCart(cart) {
    try {
      window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
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

  function updateCartBadge() {
    var badge = $("#cart-badge");
    if (!badge) return;
    var count = getCartCount();
    badge.textContent = String(count);
    if (count > 0) {
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }

  /**
   * 加入购物车。若未来引入了 cart.js（其 window.addToCart 已存在），优先复用。
   */
  function addToCart(id, qty) {
    if (typeof window.addToCart === "function" && window.addToCart !== addToCart) {
      return window.addToCart(id, qty);
    }
    qty = Math.max(1, Math.floor(Number(qty) || 1));
    var product = findProduct(id);
    if (!product) {
      showToast("商品不存在", "error");
      return false;
    }
    var stock = Math.max(0, Math.floor(Number(product.stock) || 0));
    if (stock <= 0) {
      showToast("该商品暂时缺货", "error");
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
    // 与 cart.js 行为保持一致：按库存封顶，避免超卖
    var current = found ? found.qty : 0;
    var target = Math.min(current + qty, stock);
    if (target <= current) {
      showToast("已达库存上限", "error");
      return false;
    }
    if (found) {
      found.qty = target;
    } else {
      cart.push({ id: id, qty: target });
    }
    saveCart(cart);
    updateCartBadge();
    showToast("已加入购物车 🛒", "success");
    return true;
  }

  function findProduct(id) {
    if (!window.PRODUCTS) return null;
    for (var i = 0; i < window.PRODUCTS.length; i++) {
      if (window.PRODUCTS[i].id === id) return window.PRODUCTS[i];
    }
    return null;
  }

  /* ---------------- 商品卡片渲染 ---------------- */

  function createProductMedia(product) {
    var media = document.createElement("div");
    media.className = "product-media";

    var fallback = document.createElement("div");
    fallback.className = "media-fallback";
    fallback.textContent = (CATEGORY_EMOJI[product.category] || "🍫") + " " + product.name;
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

  function createProductCard(product) {
    var card = document.createElement("article");
    card.className = "product-card";
    card.setAttribute("data-id", product.id);

    // 图片区
    card.appendChild(createProductMedia(product));

    // 内容区
    var body = document.createElement("div");
    body.className = "product-body";

    var cat = document.createElement("span");
    cat.className = "product-cat";
    cat.textContent = product.category;
    body.appendChild(cat);

    var name = document.createElement("h3");
    name.className = "product-name";
    name.textContent = product.name;
    body.appendChild(name);

    var desc = document.createElement("p");
    desc.className = "product-desc";
    desc.textContent = product.description;
    body.appendChild(desc);

    var meta = document.createElement("div");
    meta.className = "product-meta";

    var rating = document.createElement("span");
    rating.className = "product-rating";
    rating.textContent = "★ " + Number(product.rating).toFixed(1);
    meta.appendChild(rating);

    if (product.stock <= 0) {
      var out = document.createElement("span");
      out.className = "stock-out";
      out.textContent = "已售罄";
      meta.appendChild(out);
    } else {
      var price = document.createElement("span");
      price.className = "product-price";
      price.innerHTML = '<span class="unit">¥</span>' + Number(product.price).toFixed(2);
      meta.appendChild(price);
    }
    body.appendChild(meta);

    // 操作区：查看详情 + 加入购物车
    var actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.gap = "8px";

    var detailLink = document.createElement("a");
    detailLink.className = "btn btn-secondary";
    detailLink.href = "product.html?id=" + encodeURIComponent(product.id);
    detailLink.textContent = "查看详情";
    detailLink.style.flex = "1 1 0";
    actions.appendChild(detailLink);

    var addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn btn-primary";
    addBtn.textContent = product.stock <= 0 ? "缺货" : "加入购物车";
    addBtn.style.flex = "1 1 0";
    if (product.stock <= 0) addBtn.disabled = true;
    addBtn.addEventListener("click", function () {
      addToCart(product.id, 1);
    });
    actions.appendChild(addBtn);

    body.appendChild(actions);
    card.appendChild(body);

    return card;
  }

  function renderProductGrid(container, list) {
    if (!container) return;
    container.innerHTML = "";
    if (!list.length) {
      var empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML = '<span class="emoji">🍽️</span>没有找到相关零食，换个关键词试试';
      container.appendChild(empty);
      return;
    }
    var frag = document.createDocumentFragment();
    list.forEach(function (product) {
      frag.appendChild(createProductCard(product));
    });
    container.appendChild(frag);
  }

  /* ---------------- 首页初始化 ---------------- */

  function renderHotProducts() {
    var grid = $("#product-grid");
    if (!grid) return;
    var products = (window.PRODUCTS || []).slice();
    // 按评分从高到低取前 8 款作为热门推荐
    products.sort(function (a, b) {
      return b.rating - a.rating || a.id.localeCompare(b.id);
    });
    renderProductGrid(grid, products.slice(0, 8));
  }

  function renderCategoryEntries() {
    var grid = $("#category-grid");
    if (!grid || !window.CATEGORIES) return;
    grid.innerHTML = "";
    window.CATEGORIES
      .filter(function (name) { return name !== "全部"; })
      .forEach(function (name) {
        var link = document.createElement("a");
        link.className = "category-chip";
        link.href = "products.html?category=" + encodeURIComponent(name);
        link.innerHTML =
          '<span class="emoji" aria-hidden="true">' +
          (CATEGORY_EMOJI[name] || "🍫") +
          '</span><span>' + escapeHtml(name) + "</span>";
        grid.appendChild(link);
      });
  }

  /* ---------------- 搜索框跳转 ---------------- */

  function bindSearch() {
    var form = $("#nav-search-form");
    if (!form) return;
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var input = $("#nav-search-input");
      var keyword = input ? input.value.trim() : "";
      var target = "products.html";
      if (keyword) {
        target += "?q=" + encodeURIComponent(keyword);
      }
      window.location.href = target;
    });
  }

  /* ---------------- 跨标签页同步购物车角标 ---------------- */

  function bindStorageSync() {
    window.addEventListener("storage", function (event) {
      if (!event || event.key === CART_KEY || event.key == null) {
        updateCartBadge();
      }
    });
  }

  /* ---------------- 启动 ---------------- */

  function init() {
    updateCartBadge();
    bindSearch();
    bindStorageSync();

    var page = document.body ? document.body.getAttribute("data-page") : "";
    if (page === "home") {
      renderCategoryEntries();
      renderHotProducts();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  /* 对外暴露 API */
  window.showToast = showToast;
  window.formatPrice = formatPrice;
  window.addToCart = window.addToCart || addToCart;
  window.updateCartBadge = updateCartBadge;
  window.getCart = window.getCart || getCart;
  window.getCartCount = window.getCartCount || getCartCount;
  window.findProduct = findProduct;
  window.createProductCard = createProductCard;
  window.renderProductGrid = renderProductGrid;
})();
