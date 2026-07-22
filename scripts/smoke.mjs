import assert from 'node:assert/strict';
import { config } from '../server/src/config.js';

const base = process.env.SMOKE_BASE_URL || config.apiUrl;
const r = await fetch(`${base}/api/health`);
assert.equal(r.ok, true, 'API health should return 200');
const j = await r.json();
assert.equal(j.ok, true, 'API should be healthy');
console.log('Smoke test passed:', j);
