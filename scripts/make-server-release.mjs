import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, readdir, readFile, rename, rm, stat, writeFile, chmod } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const templateDir = path.join(root, 'deploy', 'release-template');
const releasesDir = path.join(root, 'releases');
const mirror = 'E:/_src/rununion';

const rawVersion = process.argv[2];
if (!rawVersion) {
  console.error('用法：node scripts/make-server-release.mjs v0.1.0');
  process.exit(1);
}
const version = rawVersion.startsWith('v') ? rawVersion : 'v' + rawVersion;
if (!/^v\d+\.\d+\.\d+$/.test(version)) {
  console.error('版本号格式应为 v主版本.次版本.修订号，例如 v0.1.0');
  process.exit(1);
}
const releaseName = 'qingrun-server-' + version;
const targetDir = path.join(releasesDir, releaseName);

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}
if (await exists(targetDir)) {
  console.error('发布目录已存在，不能覆盖：' + targetDir);
  console.error('版本目录不可变；请换一个版本号，或先手动归档旧目录。');
  process.exit(1);
}

function run(command, args, cwd, extraEnv = {}) {
  console.log('$ ' + [command, ...args].join(' '));
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
    shell: process.platform === 'win32',
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (process.env.SKIP_BUILD !== '1') {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  run(npm, ['run', 'web:deploy'], path.join(root, 'mobile'), { EXPO_PUBLIC_ACTIVITY_API: '/api' });
  run(npm, ['run', 'build'], path.join(root, 'admin'), { VITE_ACTIVITY_API: '/api' });
}

const mobileDist = path.join(root, 'mobile', 'dist');
const adminDist = path.join(root, 'admin', 'dist');
for (const [label, dir] of [['mobile/dist', mobileDist], ['admin/dist', adminDist]]) {
  if (!(await exists(path.join(dir, 'index.html')))) {
    console.error(label + ' 缺少 index.html，请先构建。');
    process.exit(1);
  }
}

let gitCommit = process.env.GIT_COMMIT || 'working-tree';
if (await exists(path.join(mirror, '.git'))) {
  const result = spawnSync('git', ['-C', mirror, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' });
  if (result.status === 0 && result.stdout.trim()) gitCommit = result.stdout.trim();
}
const builtAt = new Date().toISOString();
const tempDir = path.join(releasesDir, '.' + releaseName + '.tmp');
await mkdir(releasesDir, { recursive: true });
await rm(tempDir, { recursive: true, force: true });
await mkdir(tempDir, { recursive: true });

await cp(mobileDist, path.join(tempDir, 'web'), { recursive: true });
await cp(adminDist, path.join(tempDir, 'admin'), { recursive: true });
await cp(path.join(root, 'mock-api', 'server.mjs'), path.join(tempDir, 'api', 'server.mjs'));
await cp(path.join(root, 'deploy', 'Caddyfile'), path.join(tempDir, 'Caddyfile'));
await cp(path.join(root, 'deploy', '.env.example'), path.join(tempDir, '.env.example'));
for (const file of ['docker-compose.yml', 'start.sh', 'stop.sh', 'README.md']) {
  await cp(path.join(templateDir, file), path.join(tempDir, file));
}

const templateReadme = await readFile(path.join(templateDir, 'README.md'), 'utf8');
const readme = templateReadme
  .replaceAll('{{VERSION}}', releaseName)
  .replaceAll('{{BUILT_AT}}', builtAt)
  .replaceAll('{{GIT_COMMIT}}', gitCommit);
await writeFile(path.join(tempDir, 'README.md'), readme);
await writeFile(path.join(tempDir, 'VERSION'), [
  'release=' + releaseName,
  'product=青跑团',
  'built_at=' + builtAt,
  'git_commit=' + gitCommit,
  'source=develop',
  '',
].join('\n'));
await chmod(path.join(tempDir, 'start.sh'), 0o755);
await chmod(path.join(tempDir, 'stop.sh'), 0o755);

async function walk(dir, base = dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full, base));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

const files = (await walk(tempDir))
  .filter((file) => path.basename(file) !== 'SHA256SUMS.txt')
  .sort((a, b) => a.localeCompare(b));
const lines = [];
for (const file of files) {
  const digest = createHash('sha256').update(await readFile(file)).digest('hex');
  lines.push(digest + '  ' + path.relative(tempDir, file).split(path.sep).join('/'));
}
const checksumText = lines.join('\n') + '\n';
await writeFile(path.join(tempDir, 'SHA256SUMS.txt'), checksumText);
const checksumSha256 = createHash('sha256').update(checksumText).digest('hex');

await rename(tempDir, targetDir);

const indexPath = path.join(releasesDir, 'index.json');
let index = { latest: '', releases: [] };
if (await exists(indexPath)) {
  try { index = JSON.parse(await readFile(indexPath, 'utf8')); } catch { /* 重建索引 */ }
}
if (!Array.isArray(index.releases)) index.releases = [];
index.latest = releaseName;
index.releases = index.releases.filter((item) => item.name !== releaseName);
index.releases.push({
  name: releaseName,
  builtAt,
  gitCommit,
  checksumSha256,
  files: files.length,
});
await writeFile(indexPath, JSON.stringify(index, null, 2) + '\n');
await writeFile(path.join(releasesDir, 'LATEST.txt'), releaseName + '\n');

console.log('');
console.log('发布目录：' + targetDir);
console.log('版本：' + releaseName);
console.log('文件数：' + files.length + '，校验文件 SHA-256：' + checksumSha256);
console.log('下一步：复制整个目录到服务器，cd 进入后 sh start.sh');
