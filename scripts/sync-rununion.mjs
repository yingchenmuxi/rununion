import { cp, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

const source = path.resolve(process.argv[2] ?? '.');
const target = path.resolve(process.argv[3] ?? 'E:/_src/rununion');

const skippedNames = new Set(['.git', 'node_modules', 'dist', '.expo', '.vite', 'web-build', 'server']);

function shouldCopy(sourcePath) {
  const relative = path.relative(source, sourcePath);
  if (!relative) return true;
  const parts = relative.split(path.sep);
  if (parts.some((part) => skippedNames.has(part) || part.startsWith('node_modules') || part.startsWith('.edge-'))) {
    return false;
  }
  if (relative.endsWith('.log')) return false;
  if (parts.some((part) => part !== '.env.example' && (part === '.env' || part.startsWith('.env.')))) return false;
  return true;
}

await mkdir(target, { recursive: true });
for (const entry of await readdir(source, { withFileTypes: true })) {
  const from = path.join(source, entry.name);
  const to = path.join(target, entry.name);
  if (!shouldCopy(from)) continue;
  await cp(from, to, { recursive: true, force: true, filter: (item) => shouldCopy(item) });
  console.log('synced ' + entry.name);
}
console.log('done -> ' + target);
