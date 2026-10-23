import { Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

export function resetIntegrationRateLimits(): void {
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
      '/var/www/html/tests/Support/ResetIntegrationRateLimits.php',
    ],
    { stdio: 'ignore' },
  );
}

export async function authHeaders(page: Page): Promise<{ Cookie: string; 'X-CSRF-Token': string }> {
  const cookies = await page.context().cookies('http://localhost:8082');
  const csrfToken = cookies.find(({ name }) => name === 'XSRF-TOKEN')?.value;
  if (!csrfToken) {
    throw new Error('Expected a CSRF token after login.');
  }

  return {
    Cookie: cookies.map(({ name, value }) => `${name}=${value}`).join('; '),
    'X-CSRF-Token': csrfToken,
  };
}
