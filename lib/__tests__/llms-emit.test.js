'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { promises: fs } = require('node:fs');

const { emitLlmsTxt } = require('../../plugins/llms-txt');

const entry = { stem: 'api/cors', markdown: '# CORS\n\nBody.\n', title: 'CORS', description: 'd' };

const tmp = () => fs.mkdtemp(path.join(os.tmpdir(), 'llms-emit-'));

test('an unclassified route fails the build and names its directory', async () => {
  const outDir = await tmp();
  await assert.rejects(
    () => emitLlmsTxt({ entries: [entry], outDir, routeCount: 2, unclassified: ['guides/x'] }),
    /belong to no section[\s\S]*guides\//
  );
});

// The guard must fire BEFORE anything is written, or a broken build still
// leaves artifacts on disk for the next step to pick up.
test('nothing is written when the guard fires', async () => {
  const outDir = await tmp();
  await assert.rejects(() =>
    emitLlmsTxt({ entries: [entry], outDir, routeCount: 2, unclassified: ['guides/x'] })
  );
  assert.deepEqual(await fs.readdir(outDir), []);
});

test('the happy path writes both artifacts', async () => {
  const outDir = await tmp();
  await emitLlmsTxt({ entries: [entry], outDir, routeCount: 1, unclassified: [] });
  const written = (await fs.readdir(outDir)).sort();
  assert.deepEqual(written, ['llms-full.txt', 'llms.txt']);
});

test('no .tmp file survives a successful write', async () => {
  const outDir = await tmp();
  await emitLlmsTxt({ entries: [entry], outDir, routeCount: 1, unclassified: [] });
  assert.equal((await fs.readdir(outDir)).filter((f) => f.endsWith('.tmp')).length, 0);
});
