// ============================================================
// 修复脚本：把 articles 表里指向 trae-api 占位图的封面
// 替换为本地真实图片（下载 picsum 稳定图源到 uploads/）
// 用法：node fix_images.js
// ============================================================
const fs = require('fs');
const path = require('path');
const https = require('https');
const db = require('./db');

const UPLOAD_DIR = path.join(__dirname, 'uploads');

// 下载一个 URL 到本地文件，返回 Promise
function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      // 跟随重定向
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        fs.unlinkSync(dest);
        return download(response.headers.location, dest).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`HTTP ${response.statusCode}`));
      }
      response.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      reject(err);
    });
  });
}

// 给每篇文章生成一个稳定的 picsum seed
// seed 相同 → picsum 返回相同图片，保证可重现
const seedFor = (articleId, category) => `running-${category}-${articleId}`;

async function main() {
  const articles = db.prepare('SELECT id, category, title, image_url FROM articles').all();
  console.log(`共 ${articles.length} 篇文章待处理\n`);

  for (const a of articles) {
    // 已经是本地上传的图就跳过
    if (a.image_url && a.image_url.startsWith('/uploads/')) {
      console.log(`跳过 #${a.id}（已是本地图）`);
      continue;
    }

    const filename = `article_${a.id}.jpg`;
    const filepath = path.join(UPLOAD_DIR, filename);
    const seed = encodeURIComponent(seedFor(a.id, a.category));
    const url = `https://picsum.photos/seed/${seed}/800/450`;

    try {
      process.stdout.write(`下载 #${a.id} [${a.category}] ${a.title} ... `);
      await download(url, filepath);
      const stats = fs.statSync(filepath);
      if (stats.size < 1000) {
        throw new Error('文件太小，可能不是有效图片');
      }
      // 更新数据库
      db.prepare('UPDATE articles SET image_url = ? WHERE id = ?').run(`/uploads/${filename}`, a.id);
      console.log(`OK (${(stats.size / 1024).toFixed(1)} KB)`);
    } catch (e) {
      console.log(`FAIL: ${e.message}`);
      // 失败就清空 image_url，让前端用默认渐变背景
      db.prepare("UPDATE articles SET image_url = '' WHERE id = ?").run(a.id);
    }
  }

  console.log('\n=== 完成 ===');
  const ok = db.prepare("SELECT COUNT(*) AS c FROM articles WHERE image_url LIKE '/uploads/%'").get().c;
  console.log(`已本地化 ${ok} / ${articles.length} 张封面图`);
}

main().catch((e) => {
  console.error('脚本失败：', e);
  process.exit(1);
});
