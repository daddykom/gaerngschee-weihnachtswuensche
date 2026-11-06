import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let version = '0.0.0-dev';

try {
  const tag = execFileSync('git', ['describe', '--tags', '--match', 'v[0-9]*', '--abbrev=0'], {
    cwd: frontendDirectory,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();

  if (tag.startsWith('v')) {
    version = tag.slice(1);
  }
} catch {
  // Local checkouts without a release tag use the development version.
}

const output = resolve(frontendDirectory, 'public/version.json');
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify({ version }, null, 2)}\n`);
console.log(`Building version ${version}`);
