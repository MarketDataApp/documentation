'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PREAMBLE } = require('../../plugins/llms-txt');

// These sections are spliced into the site root's llms.txt, which already
// carries a "Getting started" section explaining the Markdown-URL convention
// for the WHOLE site, in both directions. Anything we say about it here is
// said again seven lines later in the composed file.
//
// This preamble therefore carries no URL convention at all. It used to name
// three forms, then one; one was still one too many, because the root file
// states it better and for more pages than we can.
//
// What it keeps is the single thing the root file does NOT have: a pointer to
// the authentication reference page, which is a link to more detail rather
// than a restatement of the root's guidance.

const prose = () =>
  PREAMBLE.split('\n')
    .filter((line) => !line.trim().startsWith('http'))
    .join('\n');

test('the preamble states no Markdown-URL convention', () => {
  assert.doesNotMatch(prose(), /index\.html\.md/);
  assert.doesNotMatch(prose(), /three URLs/i);
  assert.doesNotMatch(prose(), /drop the|append|trailing|remove/i);
});

// URLs are stripped before asserting on prose because the authentication link
// ends in `index.md`. Asserting on the raw string matched that URL rather than
// any sentence, so the check passed on a preamble whose prose was deleted
// entirely. raven hit the identical defect the same afternoon.
test('the assertion reads prose, not the URLs inside it', () => {
  assert.doesNotMatch(prose(), /index\.md/);
  assert.match(PREAMBLE, /index\.md/);
});

test('the preamble keeps the authentication pointer, which the root file lacks', () => {
  assert.match(PREAMBLE, /api\/authentication\/index\.md/);
});

test('the preamble is short enough to be worth splicing', () => {
  assert.ok(prose().trim().split('\n').length <= 3, prose());
});
