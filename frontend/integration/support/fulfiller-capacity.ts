import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

export function seedFulfillerCapacityFixture(): void {
  execFileSync(
    'docker',
    [
      'compose',
      '-f',
      resolve(process.cwd(), '..', 'docker-compose.integration.yml'),
      'exec',
      '-T',
      'integration-backend',
      'php',
      '/var/www/html/tests/Support/SeedFulfillerCapacityFixture.php',
    ],
    { stdio: 'inherit' },
  );
}
