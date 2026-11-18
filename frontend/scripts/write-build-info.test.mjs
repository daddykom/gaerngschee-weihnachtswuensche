import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createBuildInfo, writeBuildInfo } from './write-build-info.mjs';

test('uses the installed release and creates different IDs for repeated builds of the same source', () => {
  const options = { describe: () => 'v1.2.3+42' };
  const first = createBuildInfo(options);
  const second = createBuildInfo(options);
  assert.equal(first.appVersion, '1.2.3+42');
  assert.equal(first.appVersion, second.appVersion);
  assert.notEqual(first.buildId, second.buildId);
  assert.match(first.buildId, /^[a-f0-9-]{36}$/);
});

test('allows archives to supply the release without requiring git or silently inventing a dev version', () => {
  assert.equal(
    createBuildInfo({
      appVersion: '1.2.3+42',
      describe: () => {
        throw new Error('No git');
      },
    }).appVersion,
    '1.2.3+42',
  );
  assert.throws(() => createBuildInfo({ describe: () => 'unreleased' }));
  assert.throws(() =>
    createBuildInfo({
      describe: () => {
        throw new Error('No tags');
      },
    }),
  );
});

test('writes identical metadata into the compiled baseline and the published artifact', () => {
  const directory = mkdtempSync(join(tmpdir(), 'gaerngschee-build-info-'));
  try {
    const info = createBuildInfo({ appVersion: '1.2.3+42' });
    writeBuildInfo(directory, info);
    assert.deepEqual(
      JSON.parse(readFileSync(join(directory, 'public/build-info.json'), 'utf8')),
      info,
    );
    assert.ok(
      readFileSync(join(directory, 'src/generated/build-info.ts'), 'utf8').includes(
        JSON.stringify(info),
      ),
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
