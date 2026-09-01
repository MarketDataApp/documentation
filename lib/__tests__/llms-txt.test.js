'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { categoryOf } = require('../llms-txt');

// categoryOf turns a route stem -- the path under /docs/, with no leading or
// trailing slash, exactly what markdown-twins calls a stem -- into the section
// it belongs to in llms.txt, or null if it is a navigation artifact that the
// index deliberately skips.

test('an api route lands in the API section with no subsection', () => {
  assert.deepEqual(categoryOf('api/stocks/candles'), { section: 'API', subsection: null });
});

test('an sdk route lands in SDKs, under its language', () => {
  assert.deepEqual(categoryOf('sdk/go/options/chain'), { section: 'SDKs', subsection: 'Go' });
});

test('language slugs render as the names people use, not the directory names', () => {
  assert.equal(categoryOf('sdk/py/stocks/quotes').subsection, 'Python');
  assert.equal(categoryOf('sdk/js/stocks/quotes').subsection, 'JavaScript');
  assert.equal(categoryOf('sdk/csharp/stocks/quotes').subsection, 'C#');
  assert.equal(categoryOf('sdk/php/stocks/quotes').subsection, 'PHP');
  assert.equal(categoryOf('sdk/java/stocks/quotes').subsection, 'Java');
});

test('sheets and account routes land in their own sections', () => {
  assert.deepEqual(categoryOf('sheets/stocks/stockdata'), {
    section: 'Google Sheets',
    subsection: null,
  });
  assert.deepEqual(categoryOf('account/plans/commercial'), {
    section: 'Account & Policies',
    subsection: null,
  });
});

test('an sdk page above the language directories has no subsection', () => {
  assert.deepEqual(categoryOf('sdk/sdk-requirements'), { section: 'SDKs', subsection: null });
  assert.deepEqual(categoryOf('sdk'), { section: 'SDKs', subsection: null });
});

test('the docs root is its own section rather than being dropped', () => {
  assert.deepEqual(categoryOf(''), { section: 'Overview', subsection: null });
});

// The index and the twin list are deliberately different. markdown-twins fails
// the build if any route lacks a twin, so these routes still get one -- they
// are simply not worth an entry in an index an agent reads.

test('navigation artifacts are skipped', () => {
  assert.equal(categoryOf('tags'), null);
  assert.equal(categoryOf('tags/stocks'), null);
  assert.equal(categoryOf('search'), null);
  assert.equal(categoryOf('404'), null);
});

test('an unrecognised top-level directory is skipped rather than guessed at', () => {
  assert.equal(categoryOf('something-new/page'), null);
});

// --- renderIndex ---

const { renderIndex } = require('../llms-txt');

const ORIGIN = 'https://www.marketdata.app/docs';

const render = (entries, opts = {}) =>
  renderIndex({
    entries,
    origin: ORIGIN,
    title: 'Market Data Documentation',
    summary: 'The REST API, the SDKs and the Google Sheets add-on.',
    preamble: 'Every page is also available as Markdown.',
    ...opts,
  });

test('an entry links to the page Markdown twin and carries its description', () => {
  const out = render([
    { stem: 'api/stocks/candles', title: 'Historical Candles', description: 'Get candles.' },
  ]);
  assert.match(
    out,
    /^- \[Historical Candles\]\(https:\/\/www\.marketdata\.app\/docs\/api\/stocks\/candles\/index\.md\): Get candles\.$/m
  );
});

test('an entry with no description omits the separator rather than trailing a colon', () => {
  const out = render([{ stem: 'api/cors', title: 'CORS', description: '' }]);
  assert.match(out, /^- \[CORS\]\(\S+\/api\/cors\/index\.md\)$/m);
});

test('the docs root links to index.md, because its stem is empty', () => {
  const out = render([{ stem: '', title: 'Documentation', description: 'Start here.' }]);
  assert.match(out, /^- \[Documentation\]\(https:\/\/www\.marketdata\.app\/docs\/index\.md\): Start here\.$/m);
});

test('the heading, summary and preamble open the file', () => {
  const out = render([{ stem: 'api/cors', title: 'CORS', description: 'x' }]);
  assert.match(out, /^# Market Data Documentation\n/);
  assert.match(out, /^> The REST API, the SDKs and the Google Sheets add-on\.$/m);
  assert.match(out, /^Every page is also available as Markdown\.$/m);
});

test('sdk entries group under a language subheading below the SDKs heading', () => {
  const out = render([
    { stem: 'sdk/go/stocks/quotes', title: 'Go Quotes', description: 'a' },
    { stem: 'sdk/py/stocks/quotes', title: 'Python Quotes', description: 'b' },
  ]);
  assert.match(out, /## SDKs\n\n### Go\n\n- \[Go Quotes\]/);
  assert.match(out, /### Python\n\n- \[Python Quotes\]/);
});

test('sections come out in a fixed order regardless of the order they arrive in', () => {
  const out = render([
    { stem: 'account/plans/commercial', title: 'Plans', description: 'a' },
    { stem: 'api/cors', title: 'CORS', description: 'b' },
    { stem: '', title: 'Docs', description: 'c' },
    { stem: 'sheets/stocks/stockdata', title: 'STOCKDATA', description: 'd' },
    { stem: 'sdk/go/x', title: 'Go', description: 'e' },
  ]);
  const order = [...out.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
  assert.deepEqual(order, ['Overview', 'API', 'SDKs', 'Google Sheets', 'Account & Policies']);
});

test('navigation artifacts never reach the output', () => {
  const out = render([
    { stem: 'api/cors', title: 'CORS', description: 'a' },
    { stem: 'tags/stocks', title: 'Stocks Tag', description: 'b' },
    { stem: 'search', title: 'Search', description: 'c' },
  ]);
  assert.match(out, /CORS/);
  assert.doesNotMatch(out, /Stocks Tag/);
  assert.doesNotMatch(out, /Search/);
});

test('a section with no entries is left out entirely', () => {
  const out = render([{ stem: 'api/cors', title: 'CORS', description: 'a' }]);
  assert.doesNotMatch(out, /## SDKs/);
  assert.doesNotMatch(out, /## Google Sheets/);
});

test('entries within a section are consecutive lines, as the site root file has them', () => {
  const out = render([
    { stem: 'api/stocks/candles', title: 'Candles', description: 'a' },
    { stem: 'api/cors', title: 'CORS', description: '' },
    { stem: 'api/authentication', title: 'Auth', description: 'c' },
  ]);
  assert.match(out, /## API\n\n- \[Candles\][^\n]*\n- \[CORS\][^\n]*\n- \[Auth\][^\n]*\n/);
});

// --- metadata extraction ---
//
// Titles come from the Markdown twin's first heading rather than the built
// page's <title>, which carries a " | Market Data Docs" suffix that differs
// between environments. Descriptions come from the built HTML, because
// Docusaurus synthesises <meta name="description"> from the first paragraph --
// only 2 of 259 source files declare one in frontmatter.

const { titleFromMarkdown, descriptionFromHtml } = require('../llms-txt');

test('the title is the first heading of the twin', () => {
  assert.equal(titleFromMarkdown('# CORS\n\nBody text.\n'), 'CORS');
});

test('a later heading is not mistaken for the title', () => {
  assert.equal(titleFromMarkdown('# Historical Candles\n\n## Endpoint\n'), 'Historical Candles');
});

test('a twin with no heading yields no title rather than throwing', () => {
  assert.equal(titleFromMarkdown('Just a paragraph.\n'), '');
});

test('the description comes out of the meta tag', () => {
  const html = '<html><head><meta data-rh="true" name="description" content="Get candles."></head></html>';
  assert.equal(descriptionFromHtml(html), 'Get candles.');
});

test('HTML entities in the description are decoded', () => {
  const html = '<meta name="description" content="Kraken&#x27;s &quot;live&quot; feed &amp; more">';
  assert.equal(descriptionFromHtml(html), 'Kraken\'s "live" feed & more');
});

test('a page with no meta description yields an empty string', () => {
  assert.equal(descriptionFromHtml('<html><head></head></html>'), '');
});

// --- renderFull ---
//
// Mirrors the shape the site root's llms-full.txt already uses: each page's
// title, a Source line naming its Markdown URL, then the page, with pages
// separated by a horizontal rule.

const { renderFull } = require('../llms-txt');

test('a page carries a Source line naming its Markdown URL, below its title', () => {
  const out = renderFull({
    origin: ORIGIN,
    entries: [{ stem: 'api/cors', markdown: '# CORS\n\nBody text.\n' }],
  });
  assert.match(
    out,
    /^# CORS\n\nSource: https:\/\/www\.marketdata\.app\/docs\/api\/cors\/index\.md\n\nBody text\.$/m
  );
});

test('pages are separated by a horizontal rule', () => {
  const out = renderFull({
    origin: ORIGIN,
    entries: [
      { stem: 'api/a', markdown: '# A\n\nFirst.\n' },
      { stem: 'api/b', markdown: '# B\n\nSecond.\n' },
    ],
  });
  assert.match(out, /First\.\n\n---\n\n# B\n/);
});

test('a page with no leading heading still gets its Source line', () => {
  const out = renderFull({
    origin: ORIGIN,
    entries: [{ stem: 'api/x', markdown: 'No heading here.\n' }],
  });
  assert.match(out, /^Source: \S+\/api\/x\/index\.md\n\nNo heading here\.$/m);
});

// focus's failure mode 6: an empty docs half still parses after the splice and
// silently loses the documentation. Refuse to render one rather than emit a
// file whose emptiness only shows up downstream.

test('rendering an index with no surviving entries throws rather than emitting a stub', () => {
  assert.throws(() => render([]), /no entries/i);
});

test('an index of only navigation artifacts throws too', () => {
  assert.throws(() => render([{ stem: 'tags/x', title: 'T', description: '' }]), /no entries/i);
});

test('rendering full text with no entries throws', () => {
  assert.throws(() => renderFull({ origin: ORIGIN, entries: [] }), /no entries/i);
});

// Tag pages are generated per docs-instance, so their stems are nested under
// the section rather than sitting at the top level: api/tags/..., not tags/...
// The first cut of categoryOf only knew the top-level form and let seven tag
// pages into the index, filed under API and Google Sheets.

test('tag pages nested under a section are skipped', () => {
  assert.equal(categoryOf('api/tags'), null);
  assert.equal(categoryOf('api/tags/api-premium'), null);
  assert.equal(categoryOf('sheets/tags'), null);
  assert.equal(categoryOf('sheets/tags/sheets-high-usage'), null);
});

test('a real page whose name merely contains "tags" is kept', () => {
  assert.deepEqual(categoryOf('api/tagsoup'), { section: 'API', subsection: null });
  assert.deepEqual(categoryOf('api/stocks/tags-explained'), { section: 'API', subsection: null });
});

// The docs root's own heading is the site title, which carries "(staging)" on
// the staging build. The index heading names the documentation, not the
// environment serving it, and the orchestrator splices this into a root file.

const { titleForStem, ROOT_TITLE } = require('../llms-txt');

test('the docs root gets a stable title rather than the environment site title', () => {
  assert.equal(titleForStem('', '# Market Data Docs (staging)\n'), ROOT_TITLE);
  assert.equal(titleForStem('', '# Market Data Docs\n'), ROOT_TITLE);
});

test('every other page keeps the title from its own heading', () => {
  assert.equal(titleForStem('api/cors', '# CORS\n'), 'CORS');
});

test('a page with no heading falls back to its stem rather than an empty link', () => {
  assert.equal(titleForStem('api/cors', 'no heading\n'), 'api/cors');
});
