import { spawnSync } from 'node:child_process';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const apiBase = process.env.EXPO_PUBLIC_ACTIVITY_API || '/api';

if (!process.env.SKIP_EXPORT) {
  const npm = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(npm, ['expo', 'export', '--platform', 'web'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, EXPO_PUBLIC_ACTIVITY_API: apiBase },
    shell: process.platform === 'win32',
  });
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status || 1);
}

await mkdir(dist, { recursive: true });
await cp(resolve(root, 'pwa', 'icons'), resolve(dist, 'icons'), { recursive: true });
await cp(resolve(root, 'pwa', 'manifest.webmanifest'), resolve(dist, 'manifest.webmanifest'));
await cp(resolve(root, 'pwa', 'sw.js'), resolve(dist, 'sw.js'));

const indexPath = resolve(dist, 'index.html');
let html = await readFile(indexPath, 'utf8');

if (!html.includes('/manifest.webmanifest')) {
  html = html.replace('<html lang="en">', '<html lang="zh-CN">');
  html = html.replace(
    'content="width=device-width, initial-scale=1, shrink-to-fit=no"',
    'content="width=device-width, initial-scale=1, viewport-fit=cover"'
  );
  const headTags = [
    '    <meta name="description" content="面向 10–20 岁青少年的公益长跑成长平台。" />',
    '    <meta name="theme-color" content="#0E5A4A" />',
    '    <meta name="apple-mobile-web-app-capable" content="yes" />',
    '    <meta name="mobile-web-app-capable" content="yes" />',
    '    <meta name="apple-mobile-web-app-status-bar-style" content="default" />',
    '    <meta name="apple-mobile-web-app-title" content="青跑团" />',
    '    <link rel="manifest" href="/manifest.webmanifest" />',
    '    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />',
  ].join('\n');
  html = html.replace('</head>', headTags + '\n  </head>');
  html = html.replace(
    '</body>',
    '    <script>if (\'serviceWorker\' in navigator) { window.addEventListener(\'load\', function () { navigator.serviceWorker.register(\'/sw.js\').catch(function () {}); }); }</script>\n  </body>'
  );
}

await writeFile(indexPath, html);
console.log('PWA build ready:', indexPath, 'API base:', apiBase);
