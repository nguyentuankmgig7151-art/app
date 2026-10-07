/**
 * snack-shop / js/product.js
 * 商品详情页（product.html）逻辑
 *
 * 依赖：js/data.js（PRODUCTS）、js/cart.js（addToCart）
 *      js/main.js（formatPrice / showToast）
 *
 * URL 契约：?id=<商品 id>，缺失或不存在时展示友好空态。
 */
(function () {
  "use strict";

  var CATEGORY_EMOJI = {
    "薯片": "🍟",
    "饼干": "🍪",
    "糖果": "🍬",
    "坚果": "🥜",
    "饮料": "🥤",
    "进口": "🌍"
  };

  function $(selector) {
    return document.querySelector(selector);
  }

  function findProduct(id) {
    var list = window.PRODUCTS || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function formatPrice(value) {
    if (typeof window.formatPrice === "function") return window.formatPrice(value);
    return "¥" + Number(value).toFixed(2);
  }

  function getParam(name) {
    if (typeof URLSearchParams !== "function") return null;
    return new URLSearchParams(window.location.search).get(name);
  }

  /* ---------------- 图片区（含渐变兜底） ---------------- */

  function createMedia(product) {
    var media = document.createElement("div");
    media.className = "detail-media";

    var fallback = document.createElement("div");
    fallback.className = "media-fallback";
    fallback.textContent = (CATEGORY_EMOJI[product.category] || "🍫") + " " + product.name;
    media.appendChild(fallback);

    if (product.image) {
      var img = document.createElement("img");
      img.src = product.image;
      img.alt = product.name;
      img.addEventListener("error", function () {
        media.classList.add("is-fallback");
      });
      media.appendChild(img);
    } else {
      media.classList.add("is-fallback");
    }
    return media;
  }

  /* ---------------- 信息区 + 数量选择 ---------------- */

  function createInfo(product) {
    var stock = Math.max(0, Math.floor(Number(product.stock) || 0));
    var qty = stock > 0 ? 1 : 0;

    var info = document.createElement("div");
    info.className = "detail-info";

    var cat = document.createElement("span");
    cat.className = "product-cat";
    cat.textContent = product.category;
    info.appendChild(cat);

    var name = document.createElement("h1");
    name.className = "detail-name";
    name.textContent = product.name;
    info.appendChild(name);

    var meta = document.createElement("div");
    meta.className = "detail-meta";

    var rating = document.createElement("span");
    rating.className = "detail-rating";
    rating.textContent = "★ " + Number(product.rating).toFixed(1);
    meta.appendChild(rating);

    var stockEl = document.createElement("span");
    stockEl.className = "detail-stock" + (stock <= 0 ? " is-out" : "");
    stockEl.textContent = stock > 0 ? "库存 " + stock + " 件" : "暂时缺货";
    meta.appendChild(stockEl);
    info.appendChild(meta);

    var price = document.createElement("div");
    price.className = "detail-price";
    price.innerHTML = '<span class="unit">¥</span>' + Number(product.price).toFixed(2);
    info.appendChild(price);

    var desc = document.createElement("p");
    desc.className = "detail-desc";
    desc.textContent = product.description;
    info.appendChild(desc);

    // 购买区：数量步进器 + 加入购物车
    var buyRow = document.createElement("div");
    buyRow.className = "buy-row";

    var stepper = document.createElement("div");
    stepper.className = "qty-stepper";

    var dec = document.createElement("button");
    dec.type = "button";
    dec.textContent = "−";
    dec.setAttribute("aria-label", "减少数量");

    var val = document.createElement("span");
    val.className = "qty-value";
    val.textContent = String(qty);

    var inc = document.createElement("button");
    inc.type = "button";
    inc.textContent = "+";
    inc.setAttribute("aria-label", "增加数量");

    function refreshStepper() {
      val.textContent = String(qty);
      dec.disabled = qty <= 1 || stock <= 0;
      inc.disabled = qty >= stock || stock <= 0;
    }

    dec.addEventListener("click", function () {
      if (qty > 1) {
        qty -= 1;
        refreshStepper();
      }
    });
    inc.addEventListener("click", function () {
      if (qty < stock) {
        qty += 1;
        refreshStepper();
      }
    });

    stepper.appendChild(dec);
    stepper.appendChild(val);
    stepper.appendChild(inc);
    buyRow.appendChild(stepper);

    var addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn btn-primary";
    addBtn.textContent = stock > 0 ? "加入购物车" : "缺货";
    if (stock <= 0) addBtn.disabled = true;
    addBtn.addEventListener("click", function () {
      if (typeof window.addToCart === "function") {
        window.addToCart(product.id, qty);
      }
    });
    buyRow.appendChild(addBtn);

    info.appendChild(buyRow);

    refreshStepper();
    return info;
  }

  /* ---------------- 空态 ---------------- */

  function renderNotFound(root) {
    root.innerHTML = "";
    var empty = document.createElement("div");
    empty.className = "cart-empty";
    empty.innerHTML =
      '<span class="emoji">🔍</span>' +
      "没有找到这个商品，可能已经下架啦<br><br>" +
      '<a class="btn btn-primary" href="products.html">返回商品列表</a>';
    root.appendChild(empty);
  }

  /* ---------------- 初始化 ---------------- */

  function init() {
    if (!document.body || document.body.getAttribute("data-page") !== "product") return;
    var root = $("#product-detail");
    if (!root) return;

    var id = getParam("id");
    var product = id ? findProduct(id) : null;

    if (!product) {
      renderNotFound(root);
      return;
    }

    document.title = product.name + " · 零食铺子";
    root.innerHTML = "";

    var layout = document.createElement("div");
    layout.className = "detail";
    layout.appendChild(createMedia(product));
    layout.appendChild(createInfo(product));
    root.appendChild(layout);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
