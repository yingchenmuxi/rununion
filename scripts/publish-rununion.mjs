import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const target = path.resolve(process.env.RUNUNION_DIR ?? 'E:/_src/rununion');
const message = process.argv[2] ?? `chore: 同步青跑团原型 ${new Date().toISOString().slice(0, 10)}`;

if (!existsSync(path.join(target, '.git'))) {
  console.error('找不到目标仓库：' + target);
  process.exit(1);
}

function run(command, args, cwd, extraEnv = {}) {
  console.log('$ ' + [command, ...args].join(' '));
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(process.execPath, [path.join(projectRoot, 'scripts', 'sync-rununion.mjs'), projectRoot, target], projectRoot);
run('git', ['add', '-A'], target);

const staged = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: target });
if (staged.status === 1) {
  run('git', ['commit', '-m', message], target);
} else if (staged.status === 0) {
  console.log('没有文件变化，跳过提交');
} else {
  console.error('无法检查暂存区');
  process.exit(staged.status ?? 1);
}

const gitEnv = { GCM_INTERACTIVE: 'Never' };
run('git', ['push', 'origin', 'develop:develop'], target, gitEnv);
run('git', ['push', 'origin', 'develop:main'], target, gitEnv);
run('git', ['log', '--oneline', '-1'], target);
