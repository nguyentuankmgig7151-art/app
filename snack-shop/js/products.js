/**
 * snack-shop / js/products.js
 * 商品列表页（products.html）逻辑：分类筛选 + 关键词搜索 + 价格/评分排序
 *
 * 依赖：js/data.js（PRODUCTS / CATEGORIES）、js/cart.js（加购）
 *      js/main.js（createProductCard / renderProductGrid / formatPrice）
 *
 * URL 参数契约：
 *   ?category=<分类>   预置分类筛选（与 CATEGORIES 对齐，「全部」表示不筛选）
 *   ?q=<关键词>        预置搜索关键词（导航搜索框跳转携带）
 *   ?sort=<排序>       default | price-asc | price-desc | rating-desc
 */
(function () {
  "use strict";

  function $(selector) {
    return document.querySelector(selector);
  }

  var SORTS = ["default", "price-asc", "price-desc", "rating-desc"];

  var state = {
    category: "全部",
    keyword: "",
    sort: "default"
  };

  /* ---------------- 解析 URL 参数 ---------------- */

  function readParams() {
    if (typeof URLSearchParams !== "function") return;
    var params = new URLSearchParams(window.location.search);
    var category = params.get("category");
    if (category && window.CATEGORIES && window.CATEGORIES.indexOf(category) !== -1) {
      state.category = category;
    }
    var q = params.get("q");
    if (q) state.keyword = q;
    var sort = params.get("sort");
    if (sort && SORTS.indexOf(sort) !== -1) state.sort = sort;
  }

  /* ---------------- 筛选 + 排序 ---------------- */

  function applyFilters() {
    var keyword = state.keyword.trim().toLowerCase();
    var list = (window.PRODUCTS || []).filter(function (product) {
      if (state.category !== "全部" && product.category !== state.category) return false;
      if (!keyword) return true;
      var haystack = (
        product.name +
        " " +
        product.category +
        " " +
        (product.description || "")
      ).toLowerCase();
      return haystack.indexOf(keyword) !== -1;
    });

    list.sort(function (a, b) {
      switch (state.sort) {
        case "price-asc":
          return a.price - b.price || a.name.localeCompare(b.name);
        case "price-desc":
          return b.price - a.price || a.name.localeCompare(b.name);
        case "rating-desc":
          return b.rating - a.rating || a.name.localeCompare(b.name);
        default:
          return a.id.localeCompare(b.id);
      }
    });

    return list;
  }

  /* ---------------- 渲染 ---------------- */

  function updateUrl() {
    if (typeof history === "undefined" || !history.replaceState) return;
    var params = [];
    if (state.category && state.category !== "全部") {
      params.push("category=" + encodeURIComponent(state.category));
    }
    if (state.keyword) {
      params.push("q=" + encodeURIComponent(state.keyword));
    }
    if (state.sort && state.sort !== "default") {
      params.push("sort=" + encodeURIComponent(state.sort));
    }
    var url = "products.html" + (params.length ? "?" + params.join("&") : "");
    try {
      history.replaceState(null, "", url);
    } catch (err) {
      /* 本地 file:// 下可能受限，忽略即可 */
    }
  }

  function renderChips() {
    var row = $("#filter-category");
    if (!row || !window.CATEGORIES) return;
    row.innerHTML = "";
    window.CATEGORIES.forEach(function (name) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "filter-chip";
      btn.textContent = name;
      btn.setAttribute("data-category", name);
      if (name === state.category) btn.classList.add("is-active");
      btn.addEventListener("click", function () {
        state.category = name;
        syncUI();
        render();
      });
      row.appendChild(btn);
    });
  }

  function render() {
    var list = applyFilters();

    var countEl = $("#result-count");
    if (countEl) {
      countEl.innerHTML =
        '共找到 <strong>' + list.length + "</strong> 款零食" +
        (state.keyword ? "（关键词：" + escapeText(state.keyword) + "）" : "");
    }

    var grid = $("#product-grid");
    if (!grid) return;
    if (typeof window.renderProductGrid === "function") {
      window.renderProductGrid(grid, list);
    } else {
      grid.innerHTML = "";
      list.forEach(function (product) {
        if (typeof window.createProductCard === "function") {
          grid.appendChild(window.createProductCard(product));
        }
      });
    }
  }

  function escapeText(str) {
    return String(str).replace(/[&<>"']/g, function (ch) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[ch];
    });
  }

  function syncUI() {
    // 分类胶囊选中态
    var chips = document.querySelectorAll("#filter-category .filter-chip");
    Array.prototype.forEach.call(chips, function (chip) {
      chip.classList.toggle(
        "is-active",
        chip.getAttribute("data-category") === state.category
      );
    });
    // 搜索框
    var input = $("#list-search-input");
    if (input && input.value !== state.keyword) input.value = state.keyword;
    // 排序
    var sortEl = $("#sort-select");
    if (sortEl) sortEl.value = state.sort;
  }

  /* ---------------- 事件绑定 ---------------- */

  function bindEvents() {
    var form = $("#list-search-form");
    if (form) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        var input = $("#list-search-input");
        state.keyword = input ? input.value.trim() : "";
        updateUrl();
        render();
      });
    }

    var resetBtn = $("#reset-filter");
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        state.category = "全部";
        state.keyword = "";
        state.sort = "default";
        syncUI();
        updateUrl();
        render();
      });
    }

    var sortEl = $("#sort-select");
    if (sortEl) {
      sortEl.addEventListener("change", function () {
        state.sort = sortEl.value || "default";
        updateUrl();
        render();
      });
    }
  }

  function init() {
    if (!document.body || document.body.getAttribute("data-page") !== "products") return;
    readParams();
    renderChips();
    syncUI();
    bindEvents();
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
