import assert from 'node:assert/strict';
import test from 'node:test';

import { collectWorkspaceVersions, parseSemver, validateChangelog } from '../../scripts/check-release-metadata.mjs';

test('parseSemver accepts release versions and rejects prerelease suffixes', () => {
  assert.deepEqual(parseSemver('21.0.6'), { major: 21, minor: 0, patch: 6 });
  assert.throws(() => parseSemver('21.0.0-qris'), /release semver/i);
  assert.throws(() => parseSemver('21.0.0-beta.1'), /release semver/i);
});

test('current workspace versions are a single release version', () => {
  const versions = collectWorkspaceVersions();
  assert.equal(versions.root, versions.client);
  assert.equal(versions.client, versions.server);
  assert.equal(versions.root, '21.0.7');
});

test('validateChangelog requires the current version first and descending history', () => {
  assert.deepEqual(validateChangelog('21.0.7', ['21.0.7', '21.0.6', '21.0.5']), []);
  assert.match(validateChangelog('21.0.7', ['21.0.6', '21.0.7']).join('\n'), /first|descending|current/i);
});
