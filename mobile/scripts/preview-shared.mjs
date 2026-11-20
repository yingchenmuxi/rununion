import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const child = spawn(process.execPath, ['mock-api/server.mjs'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, PORT: process.env.PORT || '8090' },
});

child.on('exit', (code) => process.exit(code ?? 0));
