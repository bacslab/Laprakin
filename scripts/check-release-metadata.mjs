import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDirectory, '..');

export function parseSemver(value) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(String(value || '').trim());
  if (!match) throw new Error(`Release semver diperlukan: ${value}`);
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

function readManifest(root, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

export function collectWorkspaceVersions(root = workspaceRoot) {
  return {
    root: readManifest(root, 'package.json').version,
    client: readManifest(root, path.join('client', 'package.json')).version,
    server: readManifest(root, path.join('server', 'package.json')).version,
  };
}

function compare(left, right) {
  const a = parseSemver(left);
  const b = parseSemver(right);
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

export function validateChangelog(version, entries = []) {
  const errors = [];
  parseSemver(version);
  if (entries[0] !== version) errors.push(`current version ${version} must be the first changelog entry`);
  for (let index = 1; index < entries.length; index += 1) {
    try {
      if (compare(entries[index - 1], entries[index]) <= 0) errors.push(`changelog entries must be descending at ${entries[index - 1]} -> ${entries[index]}`);
    } catch (error) { errors.push(error.message); }
  }
  return errors;
}

function changelogVersions(root = workspaceRoot) {
  return fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8')
    .split(/\r?\n/)
    .map((line) => line.match(/^## (\d+\.\d+\.\d+)(?:\s|$)/)?.[1])
    .filter(Boolean);
}

export function checkReleaseMetadata(root = workspaceRoot) {
  const versions = collectWorkspaceVersions(root);
  const errors = [];
  const parsed = Object.entries(versions).map(([name, version]) => {
    try { return [name, parseSemver(version)]; } catch (error) { errors.push(`${name}: ${error.message}`); return [name, null]; }
  });
  if (parsed.every(([, value]) => value) && new Set(Object.values(versions)).size !== 1) errors.push('root, client, and server versions must match');
  if (parsed.every(([, value]) => value)) errors.push(...validateChangelog(versions.root, changelogVersions(root)));
  return { versions, errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = checkReleaseMetadata();
  if (result.errors.length) { console.error(result.errors.join('\n')); process.exitCode = 1; }
  else console.log(`Release metadata valid: ${result.versions.root}`);
}
