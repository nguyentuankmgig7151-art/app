/* ==========================================================================
   个人年终总结 · 交互脚本
   包含：主题切换、滚动进度、进场动画、数字滚动、SVG 雷达图与折线图动画
   ========================================================================== */
(function () {
  "use strict";

  /* ---------- 0. 常量与数据 ---------- */

  // 主题在 <html> 上的属性名，CSS 依据它切换变量
  const THEME_ATTRIBUTE = "data-theme";
  const THEME_STORAGE_KEY = "year-review-theme";

  // 能力雷达：六个维度，分值与两位介绍保持一致
  const RADAR_AXES = ["工程能力", "架构设计", "团队协作", "业务理解", "沟通表达", "自我驱动"];
  const RADAR_SERIES = [
    { name: "年末", values: [88, 76, 84, 80, 72, 90], colorStart: "#6d5efc", colorEnd: "#ff5f8f" },
    { name: "年初", values: [70, 52, 66, 64, 58, 72], colorStart: "#ffb245", colorEnd: "#ff5f8f" }
  ];

  // 成长曲线：十二月数据
  const MONTHS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
  const GROWTH_SERIES = [
    { name: "月度产出", values: [4, 5, 6, 7, 8, 9, 7, 10, 9, 11, 10, 11], color: "#6d5efc", area: true },
    { name: "学习投入", values: [6, 7, 6, 8, 7, 8, 6, 7, 8, 9, 8, 9], color: "#16c9b4", area: false }
  ];
  const GROWTH_MAX = 12; // 纵轴上限

  /* ---------- 1. 主题切换 ---------- */

  function initTheme() {
    const root = document.documentElement;
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = saved || (prefersDark ? "dark" : "light");
    applyTheme(initialTheme);

    const toggle = document.getElementById("themeToggle");
    if (!toggle) {
      return;
    }
    toggle.addEventListener("click", function () {
      const next = root.getAttribute(THEME_ATTRIBUTE) === "dark" ? "light" : "dark";
      applyTheme(next);
      localStorage.setItem(THEME_STORAGE_KEY, next);
    });
  }

  function applyTheme(theme) {
    const root = document.documentElement;
    root.setAttribute(THEME_ATTRIBUTE, theme);
    const toggle = document.getElementById("themeToggle");
    if (toggle) {
      toggle.setAttribute("aria-pressed", String(theme === "dark"));
    }
  }

  /* ---------- 2. 滚动进度与回到顶部 ---------- */

  function initScrollEffects() {
    const progressBar = document.getElementById("scrollProgress");
    const toTopButton = document.getElementById("toTop");

    const updateOnScroll = function () {
      const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
      const ratio = scrollableHeight > 0 ? window.scrollY / scrollableHeight : 0;
      if (progressBar) {
        progressBar.style.width = Math.min(ratio * 100, 100).toFixed(2) + "%";
      }
      if (toTopButton) {
        toTopButton.classList.toggle("is-visible", window.scrollY > 400);
      }
    };

    window.addEventListener("scroll", updateOnScroll, { passive: true });
    window.addEventListener("resize", updateOnScroll);
    updateOnScroll();

    if (toTopButton) {
      toTopButton.addEventListener("click", function () {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
  }

  /* ---------- 3. 章节导航高亮 ---------- */

  function initNavHighlight() {
    const sections = Array.prototype.slice.call(document.querySelectorAll("main section[id]"));
    const links = Array.prototype.slice.call(document.querySelectorAll(".topbar__nav a"));
    if (sections.length === 0 || links.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) {
            return;
          }
          const activeId = entry.target.id;
          links.forEach(function (link) {
            link.classList.toggle("is-active", link.getAttribute("href") === "#" + activeId);
          });
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );

    sections.forEach(function (section) {
      observer.observe(section);
    });
  }

  /* ---------- 4. 通用进场动画与动画触发器 ---------- */

  const revealCallbacks = new WeakMap();
  // 需要动画但本身没有 .reveal 类的元素（例如整个图表章节），单独登记后一并观察
  const animatedTargets = new Set();

  function initReveal() {
    const targets = new Set(document.querySelectorAll(".reveal"));
    animatedTargets.forEach(function (target) {
      targets.add(target);
    });

    const observer = new IntersectionObserver(
      function (entries, self) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) {
            return;
          }
          entry.target.classList.add("is-visible");
          const callback = revealCallbacks.get(entry.target);
          if (typeof callback === "function") {
            callback();
          }
          self.unobserve(entry.target);
        });
      },
      { threshold: 0.18 }
    );

    targets.forEach(function (target) {
      observer.observe(target);
    });
  }

  /**
   * 将动画函数绑定到某个元素上，元素进入视口时执行一次。
   * @param {Element} element 触发元素（带 .reveal 或通过本函数登记的任意元素）
   * @param {Function} callback 进入视口后执行的动画函数
   */
  function onReveal(element, callback) {
    if (!element) {
      return;
    }
    revealCallbacks.set(element, callback);
    animatedTargets.add(element);
  }

  /* ---------- 5. 数字滚动 ---------- */

  function animateCounter(element) {
    const target = Number(element.dataset.target || 0);
    const duration = 1200;
    const startTime = performance.now();

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // 缓出曲线，收尾更平滑
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = Math.round(target * eased).toString();
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }

    element.textContent = "0";
    requestAnimationFrame(step);
  }

  function initCounters() {
    document.querySelectorAll(".stat-card").forEach(function (card) {
      const counter = card.querySelector(".counter");
      onReveal(card, function () {
        animateCounter(counter);
      });
    });
  }

  /* ---------- 6. 进度条动画 ---------- */

  function initProgressBars() {
    document.querySelectorAll(".skill-bar").forEach(function (bar) {
      const fill = bar.querySelector(".skill-bar__fill");
      const value = Number(bar.dataset.value || 0);
      onReveal(bar, function () {
        fill.style.width = value + "%";
      });
    });

    document.querySelectorAll(".project-card").forEach(function (card) {
      const fill = card.querySelector(".project-card__progress-fill");
      const value = Number(fill.dataset.value || 0);
      onReveal(card, function () {
        fill.style.width = value + "%";
      });
    });
  }

  /* ---------- 7. SVG 雷达图 ---------- */

  const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

  function createSvgElement(tagName, attributes) {
    const element = document.createElementNS(SVG_NAMESPACE, tagName);
    Object.keys(attributes || {}).forEach(function (key) {
      element.setAttribute(key, attributes[key]);
    });
    return element;
  }

  function buildRadarChart(container) {
    const size = 320;
    const centerX = size / 2;
    const centerY = size / 2 + 6;
    const radius = 112;
    const rings = [20, 40, 60, 80, 100];
    const axisCount = RADAR_AXES.length;

    const angleAt = function (index) {
      return (Math.PI * 2 * index) / axisCount - Math.PI / 2;
    };
    const pointAt = function (index, value) {
      const angle = angleAt(index);
      const distance = (radius * value) / 100;
      return [centerX + Math.cos(angle) * distance, centerY + Math.sin(angle) * distance];
    };
    const toPointString = function (points) {
      return points.map(function (point) {
        return point[0].toFixed(2) + "," + point[1].toFixed(2);
      }).join(" ");
    };

    const svg = createSvgElement("svg", {
      viewBox: "0 0 " + size + " " + size,
      role: "presentation"
    });

    const defs = createSvgElement("defs");
    RADAR_SERIES.forEach(function (series, index) {
      const gradient = createSvgElement("linearGradient", {
        id: "radarGradient" + index,
        x1: "0%", y1: "0%", x2: "100%", y2: "100%"
      });
      gradient.appendChild(createSvgElement("stop", { offset: "0%", "stop-color": series.colorStart }));
      gradient.appendChild(createSvgElement("stop", { offset: "100%", "stop-color": series.colorEnd }));
      defs.appendChild(gradient);
    });
    svg.appendChild(defs);

    // 网格圈
    rings.forEach(function (ring) {
      const points = RADAR_AXES.map(function (_, index) {
        return pointAt(index, ring);
      });
      svg.appendChild(createSvgElement("polygon", {
        points: toPointString(points),
        fill: "none",
        stroke: "currentColor",
        "stroke-width": "1",
        opacity: "0.16"
      }));
    });

    // 轴线与标签
    RADAR_AXES.forEach(function (label, index) {
      const outerPoint = pointAt(index, 100);
      svg.appendChild(createSvgElement("line", {
        x1: centerX, y1: centerY,
        x2: outerPoint[0].toFixed(2), y2: outerPoint[1].toFixed(2),
        stroke: "currentColor",
        "stroke-width": "1",
        opacity: "0.16"
      }));

      const labelPoint = pointAt(index, 124);
      const text = createSvgElement("text", {
        x: labelPoint[0].toFixed(2),
        y: labelPoint[1].toFixed(2),
        "text-anchor": "middle",
        "dominant-baseline": "middle",
        "font-size": "12",
        fill: "currentColor",
        opacity: "0.72"
      });
      text.textContent = label;
      svg.appendChild(text);
    });

    // 数据多边形：初始缩到中心，进入视口后展开
    const seriesElements = [];
    RADAR_SERIES.forEach(function (series, index) {
      const points = series.values.map(function (value, valueIndex) {
        return pointAt(valueIndex, value);
      });
      const polygon = createSvgElement("polygon", {
        points: toPointString(points),
        fill: "url(#radarGradient" + index + ")",
        "fill-opacity": index === 0 ? "0.32" : "0.14",
        stroke: "url(#radarGradient" + index + ")",
        "stroke-width": "2.5",
        "stroke-linejoin": "round"
      });
      polygon.style.transformOrigin = centerX + "px " + centerY + "px";
      polygon.style.transform = "scale(0.2)";
      polygon.style.opacity = "0";
      polygon.style.transition = "transform 1.1s cubic-bezier(0.22, 0.61, 0.36, 1) " + (index * 0.15) + "s, opacity 0.9s ease " + (index * 0.15) + "s";
      svg.appendChild(polygon);
      seriesElements.push(polygon);
    });

    container.innerHTML = "";
    container.appendChild(svg);
    container.style.color = "var(--text)";

    return function play() {
      seriesElements.forEach(function (polygon) {
        polygon.style.transform = "scale(1)";
        polygon.style.opacity = "1";
      });
    };
  }

  /* ---------- 8. SVG 折线图 ---------- */

  function buildLineChart(container) {
    const width = 760;
    const height = 320;
    const padding = { top: 24, right: 26, bottom: 42, left: 46 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    const xAt = function (index) {
      return padding.left + (plotWidth * index) / (MONTHS.length - 1);
    };
    const yAt = function (value) {
      return padding.top + plotHeight - (plotHeight * value) / GROWTH_MAX;
    };

    const svg = createSvgElement("svg", {
      viewBox: "0 0 " + width + " " + height,
      role: "presentation"
    });

    const defs = createSvgElement("defs");
    GROWTH_SERIES.forEach(function (series, index) {
      const gradient = createSvgElement("linearGradient", {
        id: "lineGradient" + index,
        x1: "0%", y1: "0%", x2: "0%", y2: "100%"
      });
      gradient.appendChild(createSvgElement("stop", { offset: "0%", "stop-color": series.color, "stop-opacity": "0.35" }));
      gradient.appendChild(createSvgElement("stop", { offset: "100%", "stop-color": series.color, "stop-opacity": "0" }));
      defs.appendChild(gradient);
    });
    svg.appendChild(defs);

    // 横向网格与纵轴刻度
    for (let value = 0; value <= GROWTH_MAX; value += 3) {
      const y = yAt(value);
      svg.appendChild(createSvgElement("line", {
        x1: padding.left, y1: y.toFixed(2),
        x2: width - padding.right, y2: y.toFixed(2),
        stroke: "currentColor",
        "stroke-width": "1",
        opacity: "0.14"
      }));
      const tick = createSvgElement("text", {
        x: padding.left - 12,
        y: y.toFixed(2),
        "text-anchor": "end",
        "dominant-baseline": "middle",
        "font-size": "12",
        fill: "currentColor",
        opacity: "0.55"
      });
      tick.textContent = String(value);
      svg.appendChild(tick);
    }

    // 月份标签
    MONTHS.forEach(function (month, index) {
      const label = createSvgElement("text", {
        x: xAt(index).toFixed(2),
        y: height - padding.bottom + 22,
        "text-anchor": "middle",
        "font-size": "11",
        fill: "currentColor",
        opacity: "0.55"
      });
      label.textContent = month;
      svg.appendChild(label);
    });

    const animatedDots = [];
    GROWTH_SERIES.forEach(function (series, seriesIndex) {
      const points = series.values.map(function (value, index) {
        return [xAt(index), yAt(value)];
      });
      const linePath = points.map(function (point, index) {
        return (index === 0 ? "M" : "L") + point[0].toFixed(2) + " " + point[1].toFixed(2);
      }).join(" ");

      if (series.area) {
        const baseline = yAt(0).toFixed(2);
        const areaPath = linePath +
          " L" + points[points.length - 1][0].toFixed(2) + " " + baseline +
          " L" + points[0][0].toFixed(2) + " " + baseline + " Z";
        svg.appendChild(createSvgElement("path", {
          d: areaPath,
          fill: "url(#lineGradient" + seriesIndex + ")",
          stroke: "none"
        }));
      }

      const strokePath = createSvgElement("path", {
        d: linePath,
        fill: "none",
        stroke: series.color,
        "stroke-width": "3",
        "stroke-linecap": "round",
        "stroke-linejoin": "round"
      });
      svg.appendChild(strokePath);
      strokePath.style.color = series.color;

      // 数据点：默认隐藏，线条画完后淡入
      const dots = points.map(function (point) {
        const dot = createSvgElement("circle", {
          cx: point[0].toFixed(2),
          cy: point[1].toFixed(2),
          r: "4",
          fill: series.color,
          stroke: "var(--bg-soft)",
          "stroke-width": "2"
        });
        dot.style.opacity = "0";
        dot.style.transition = "opacity 0.5s ease";
        svg.appendChild(dot);
        return dot;
      });
      animatedDots.push(dots);

      const totalLength = strokePath.getTotalLength();
      strokePath.style.strokeDasharray = totalLength + " " + totalLength;
      strokePath.style.strokeDashoffset = String(totalLength);
      strokePath.style.transition = "stroke-dashoffset 1.6s ease-in-out " + (seriesIndex * 0.2) + "s";
      strokePath.dataset.animatedLength = String(totalLength);
    });

    container.innerHTML = "";
    container.appendChild(svg);
    container.style.color = "var(--text)";

    return function play() {
      svg.querySelectorAll("path[data-animated-length]").forEach(function (path) {
        path.style.strokeDashoffset = "0";
      });
      animatedDots.forEach(function (dots, seriesIndex) {
        dots.forEach(function (dot, index) {
          window.setTimeout(function () {
            dot.style.opacity = "1";
          }, 500 + seriesIndex * 200 + index * 45);
        });
      });
    };
  }

  /* ---------- 9. 初始化 ---------- */

  function initCharts() {
    const radarContainer = document.getElementById("radarChart");
    if (radarContainer) {
      const playRadar = buildRadarChart(radarContainer);
      const radarSection = document.getElementById("skills");
      onReveal(radarSection, playRadar);
    }

    const lineContainer = document.getElementById("lineChart");
    if (lineContainer) {
      const playLine = buildLineChart(lineContainer);
      const growthSection = document.getElementById("growth");
      onReveal(growthSection, playLine);
    }
  }

  function initPrintButton() {
    const button = document.getElementById("printBtn");
    if (button) {
      button.addEventListener("click", function () {
        window.print();
      });
    }
  }

  function init() {
    initTheme();
    initScrollEffects();
    initNavHighlight();
    initCounters();
    initProgressBars();
    initCharts();
    initPrintButton();
    initReveal();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
