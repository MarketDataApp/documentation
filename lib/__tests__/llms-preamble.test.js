'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PREAMBLE } = require('../../plugins/llms-txt');

// The owner of the site root file ruled against advertising several URL forms
// for one page -- "we shouldn't confuse the llms". Our sections are spliced
// into that same composed file, so the ruling reaches this text even though it
// is generated here.
//
// The three names are all real: markdown-twins writes <stem>.md,
// <stem>/index.md and <stem>/index.html.md. But every entry already links
// straight at the .md URL, so a reader never has to construct one, and naming
// three ways to build a URL nobody needs to build is cost with no return.

test('the preamble names exactly one URL convention', () => {
  assert.doesNotMatch(PREAMBLE, /index\.html\.md/);
  assert.doesNotMatch(PREAMBLE, /three URLs/i);
});

test('the preamble still says how to reach the HTML page', () => {
  assert.match(PREAMBLE, /index\.md/);
});

test('the preamble still points at authentication, which the root file asked for', () => {
  assert.match(PREAMBLE, /api\/authentication/);
});
