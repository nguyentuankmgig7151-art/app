/**
 * snack-shop / js/data.js
 * 商品静态数据集与分类常量（无副作用，仅导出数据）
 *
 * 字段契约（冻结，勿改名）：
 *   id          唯一标识，详情页通过 ?id= 匹配
 *   name        商品名称
 *   category    所属分类，必须属于 CATEGORIES
 *   price       单价（元）
 *   image       图片 URL；为空串 "" 时前端自动降级为 CSS 渐变占位
 *   description 一句话卖点（≤ 80 字）
 *   rating      评分 0–5，一位小数
 *   stock       库存件数；为 0 时详情页禁用加入购物车
 *
 * 图片采用确定性占位服务 https://picsum.photos/seed/<slug>/600/450
 * 离线环境加载失败时，由 main.js/CSS 自动降级为渐变占位，不影响功能。
 */

var PRODUCTS = [
  {
    id: "p001",
    name: "海盐黄油薯片",
    category: "薯片",
    price: 12.9,
    image: "https://picsum.photos/seed/snack-chips/600/450",
    description: "现切马铃薯，海盐与黄油慢烤，酥脆不腻。",
    rating: 4.8,
    stock: 25
  },
  {
    id: "p002",
    name: "焦糖爆米花",
    category: "薯片",
    price: 15.5,
    image: "https://picsum.photos/seed/snack-popcorn/600/450",
    description: "手工熬制焦糖裹衣，颗颗饱满香甜。",
    rating: 4.6,
    stock: 40
  },
  {
    id: "p003",
    name: "咸蛋黄味薯条",
    category: "薯片",
    price: 13.9,
    image: "https://picsum.photos/seed/snack-fries/600/450",
    description: "咸蛋黄风味，松脆咸香停不下来。",
    rating: 4.5,
    stock: 22
  },
  {
    id: "p004",
    name: "奶油曲奇饼干",
    category: "饼干",
    price: 18.8,
    image: "https://picsum.photos/seed/snack-cookie/600/450",
    description: "丹麦风味黄油曲奇，酥松入口即化。",
    rating: 4.6,
    stock: 30
  },
  {
    id: "p005",
    name: "海苔薄脆苏打饼",
    category: "饼干",
    price: 9.9,
    image: "https://picsum.photos/seed/snack-cracker/600/450",
    description: "低温烘焙，海苔咸香，轻负担小食。",
    rating: 4.3,
    stock: 55
  },
  {
    id: "p006",
    name: "蜂蜜柚子糖",
    category: "糖果",
    price: 9.9,
    image: "https://picsum.photos/seed/snack-candy/600/450",
    description: "真果肉夹心，酸甜清爽不粘牙。",
    rating: 4.7,
    stock: 60
  },
  {
    id: "p007",
    name: "草莓软糖",
    category: "糖果",
    price: 11.5,
    image: "https://picsum.photos/seed/snack-gummy/600/450",
    description: "Q 弹果汁软糖，一口一颗的少女心。",
    rating: 4.4,
    stock: 48
  },
  {
    id: "p008",
    name: "每日混合坚果",
    category: "坚果",
    price: 29.9,
    image: "https://picsum.photos/seed/snack-nuts/600/450",
    description: "腰果巴旦木核桃科学配比，每日一包。",
    rating: 4.7,
    stock: 35
  },
  {
    id: "p009",
    name: "炭烤杏仁",
    category: "坚果",
    price: 24.5,
    image: "https://picsum.photos/seed/snack-almond/600/450",
    description: "低温慢烤锁住香气，无添加蔗糖。",
    rating: 4.5,
    stock: 0
  },
  {
    id: "p010",
    name: "气泡柠檬水",
    category: "饮料",
    price: 6.5,
    image: "https://picsum.photos/seed/snack-lemonade/600/450",
    description: "零糖零卡，真柠檬酸甜气泡。",
    rating: 4.4,
    stock: 80
  },
  {
    id: "p011",
    name: "冷萃蜜桃乌龙茶",
    category: "饮料",
    price: 8.8,
    image: "https://picsum.photos/seed/snack-tea/600/450",
    description: "冷萃茶底融入蜜桃香，清爽回甘。",
    rating: 4.6,
    stock: 70
  },
  {
    id: "p012",
    name: "厚切牛奶巧克力",
    category: "进口",
    price: 22.0,
    image: "https://picsum.photos/seed/snack-choco/600/450",
    description: "比利时进口可可，45% 可可含量奶香浓郁。",
    rating: 4.9,
    stock: 18
  },
  {
    id: "p013",
    name: "抹茶生巧",
    category: "进口",
    price: 26.0,
    image: "https://picsum.photos/seed/snack-matcha/600/450",
    description: "日本宇治抹茶入料，冷藏口感更佳。",
    rating: 4.8,
    stock: 12
  },
  {
    id: "p014",
    name: "比利时华夫饼干",
    category: "进口",
    price: 19.9,
    image: "https://picsum.photos/seed/snack-waffle/600/450",
    description: "经典焦糖华夫，酥脆夹心，下午茶首选。",
    rating: 4.5,
    stock: 26
  }
];

/** 分类列表；「全部」固定置首，用于列表页筛选胶囊 */
var CATEGORIES = ["全部", "薯片", "饼干", "糖果", "坚果", "饮料", "进口"];

/* 兼容挂载到 window，便于 HTML 内联脚本或调试使用 */
if (typeof window !== "undefined") {
  window.PRODUCTS = PRODUCTS;
  window.CATEGORIES = CATEGORIES;
}

/* 兼容 CommonJS / Node 环境下的语法与数据校验 */
if (typeof module !== "undefined" && module.exports) {
  module.exports = { PRODUCTS: PRODUCTS, CATEGORIES: CATEGORIES };
}
