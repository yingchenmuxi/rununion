// ============================================================
// 安全新增知识点脚本（只增不删）
//
// 【用途】给新任务/新会话提供一条安全通道：只往 articles 表插入新文章，
//        绝对不会删除或修改任何已有文章（与 seed_articles.js 完全不同）。
//
// 【用法】
//   1. 先把文章内容写成一个 JSON 文件（推荐放在 backend/_inbox.json）
//   2. 停掉后端（避免 SQLite 库锁），然后执行：
//        E:\Trea\tools\nodejs\node.exe add_article.js _inbox.json
//   3. 插入成功后重新启动后端即可，无需重新打包 APK
//
// 【JSON 格式】可以是单个对象，也可以是对象数组（批量）
//   {
//     "category":  "🚀 进阶提升",        // 分类（建议沿用已有 6 大分类）
//     "title":     "文章标题",           // 必填
//     "summary":   "一句话摘要，30-60字", // 列表卡片显示，必填建议
//     "content":   "正文……\n【小标题】\n1. 要点……",  // 必填，支持 \n 换行
//     "tags":      "标签1,标签2,标签3,标签4",        // 逗号分隔 4-6 个
//     "image_url": "/uploads/art_43.jpg",           // 相对路径；图要先放进 uploads/
//     "attachment_url": ""                          // 可选，PDF/文档链接
//   }
//
// 【安全设计】
//   - 只执行 INSERT，源码里不存在任何 DELETE / UPDATE / DROP
//   - 插入前校验必填字段，字段缺失直接报错退出，不写脏数据
//   - 插入后检查 image_url 对应的本地图片文件是否真实存在，不存在则给出警告
//   - 全程事务，任何一条失败则整体回滚
// ============================================================
const fs = require('fs');
const path = require('path');
const db = require('./db');

// 读取命令行传入的 JSON 文件路径
const jsonPath = process.argv[2];
if (!jsonPath) {
  console.error('❌ 用法：node add_article.js <文章JSON文件路径>');
  console.error('   例如：node add_article.js _inbox.json');
  process.exit(1);
}

// 读取并解析 JSON（去掉可能的 BOM，兼容中文）
let raw = fs.readFileSync(path.resolve(jsonPath), 'utf8');
if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
let parsed;
try {
  parsed = JSON.parse(raw);
} catch (e) {
  console.error('❌ JSON 格式错误：', e.message);
  process.exit(1);
}

// 统一成数组处理（单个对象也当数组）
const items = Array.isArray(parsed) ? parsed : [parsed];

// 字段归一化 + 校验
const normalized = [];
items.forEach((a, i) => {
  const no = i + 1;
  const title = String(a.title || '').trim();
  const content = String(a.content || '').trim();
  if (!title) throw new Error(`第 ${no} 篇：title 不能为空`);
  if (!content) throw new Error(`第 ${no} 篇：content 不能为空`);

  normalized.push({
    category: String(a.category || '基础知识').trim(),
    title,
    summary: String(a.summary || '').trim(),
    content,
    tags: String(a.tags || '').trim(),
    image_url: String(a.image_url || '').trim(),
    attachment_url: String(a.attachment_url || '').trim(),
  });
});

console.log(`准备新增 ${normalized.length} 篇文章（只插入，不删除任何现有内容）\n`);

// 先记录插入前的总数，便于对比
const before = db.prepare('SELECT COUNT(*) AS c FROM articles').get().c;

const insert = db.prepare(`
  INSERT INTO articles (category, title, summary, content, tags, image_url, attachment_url)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

try {
  db.exec('BEGIN');
  for (const a of normalized) {
    const info = insert.run(
      a.category, a.title, a.summary, a.content, a.tags, a.image_url, a.attachment_url
    );
    console.log(`✅ 新增 id=${info.lastInsertRowid} [${a.category}] ${a.title}`);

    // 本地图片存在性检查：提醒忘记放图的情况
    if (a.image_url.startsWith('/uploads/')) {
      const localFile = path.join(__dirname, a.image_url.replace(/^\//, ''));
      if (!fs.existsSync(localFile)) {
        console.warn(`   ⚠️ 配图文件不存在：${localFile}`);
        console.warn('      请先把图片放进 backend/uploads/，否则 APP 里封面会显示为默认背景');
      }
    }
  }
  db.exec('COMMIT');
} catch (e) {
  db.exec('ROLLBACK');
  console.error('\n❌ 插入失败，已全部回滚：', e.message);
  process.exit(1);
}

const after = db.prepare('SELECT COUNT(*) AS c FROM articles').get().c;
console.log('\n========================================');
console.log(`✅ 完成：文章总数 ${before} → ${after}（新增 ${after - before} 篇）`);
console.log('========================================');

// 输出各分类篇数，方便核对结构
const stats = db.prepare(
  'SELECT category, COUNT(*) AS c FROM articles GROUP BY category'
).all();
console.log('\n当前分类统计：');
for (const s of stats) console.log(`  ${s.category}: ${s.c} 篇`);
console.log('\n提示：重新启动后端即可在 APP 中看到新文章，无需重新打包 APK。');
