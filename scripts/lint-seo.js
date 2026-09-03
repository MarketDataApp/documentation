#!/usr/bin/env node
/**
 * Gates the `<head>` of every built page against the spec in docs/SEO.md.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS A NEW CHECK AND NOT AN EXTENSION OF AN EXISTING ONE
 * ---------------------------------------------------------------------------
 *
 * Several checks already read `build/`, and every one was read before this file
 * was written. None of them opens the `<head>` as a whole, which is where this
 * site's SEO surface lives:
 *
 *   lint:links          Docusaurus's own onBrokenLinks, with STRICT_LINKS. It
 *                       resolves URL-bearing ELEMENTS. It never reads
 *                       `<meta content>`, so og:url has never been compared
 *                       with anything, and a plain <a href> written by a theme
 *                       component is not walked either.
 *   lint:sitemap        the sitemap against the page tree. It never opens a
 *                       page's head, so it cannot see that a page the sitemap
 *                       advertises also says `noindex`.
 *   lint:examples       request parity across language tabs. Body, not head.
 *   lint:highlighting   Prism grammars over rendered code blocks. Body.
 *   lint:options        expired OCC symbols in sources. Not the build at all.
 *   markdown-twins      postBuild: every route has a twin. File existence.
 *
 * So the ground is genuinely uncovered. What this file deliberately does NOT
 * re-assert, because something above already does:
 *
 *   - a route has a Markdown twin              -> markdown-twins postBuild
 *   - the sitemap lists only pages that built  -> lint:sitemap
 *   - internal link targets exist              -> lint:links
 *
 * ---------------------------------------------------------------------------
 * WHY A DOM PARSER AND NOT REGEX
 * ---------------------------------------------------------------------------
 *
 * `@mixmark-io/domino` is already a dependency — `lib/html-to-md.js` uses it —
 * so parsing costs nothing new and removes a whole class of failure by
 * construction rather than by fixture.
 *
 * The sibling check in MarketDataApp/website was bitten by exactly this: its
 * minifier writes attributes UNQUOTED and REORDERED, so `<meta name="robots">`
 * ships as `<meta content="..." name=robots>`, and a matcher requiring quotes
 * read every built page as having no robots tag — indistinguishable from a page
 * that genuinely has none. It passed against an unminified dev server and
 * failed in CI, which serves the build.
 *
 * A DOM cannot be fooled that way: `querySelector('meta[name=robots]')` is
 * indifferent to quoting and to attribute order. Docusaurus happens to quote
 * its attributes today, and this file does not depend on that continuing.
 * The self-test feeds it a minified, unquoted, reordered fixture anyway.
 *
 * ---------------------------------------------------------------------------
 * GATED VERSUS REPORTED
 * ---------------------------------------------------------------------------
 *
 * A rule that cannot be green today still earns its place if it counts and
 * NAMES the backlog on every run. Each reported rule has an `_ENFORCED` flag
 * beside it; flipping one to `true` is the whole change once the corpus is
 * clean. None of them is a count baseline — they name every offending page on
 * every run rather than freezing a number, so the list can only be paid down.
 *
 * Usage:
 *   yarn build && node scripts/lint-seo.js
 *   node scripts/lint-seo.js --dir some/other/build
 *   node scripts/lint-seo.js --report   # print the reported-rule backlogs in full
 *
 * Exit codes
 *   0  every gated rule passed
 *   1  a gated rule failed
 */

'use strict';

const fs = require('fs');
const path = require('path');
const domino = require('@mixmark-io/domino');
const { isNavigationArtifact } = require('../lib/llms-txt');

const ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Flags for the rules that are measured but not yet gated. See docs/SEO.md.
// ---------------------------------------------------------------------------

const TITLE_UNIQUE_ENFORCED = false; // 33 duplicate title groups
const DESC_UNIQUE_ENFORCED = false; // 12 duplicate description groups
const LENGTH_ENFORCED = false; // 1 title > 60, 107 descriptions > 160
const CARD_IMAGE_ENFORCED = false; // no page declares og:image
const HEADING_ORDER_ENFORCED = false; // 89 pages skip a heading level
// The 404 emits a canonical naming /docs/404.html/, a URL that 404s. Measured
// not gated, and the reason is in docs/SEO-GAPS.md rather than here: the page
// is served with a real 404 status, so a crawler drops the URL before it reads
// the hint. Suppressing it means swizzling @theme/SiteMetadata -- a core
// internal that also emits og:url, the hreflang alternates and the search
// metadata -- and carrying that copy across every Docusaurus upgrade. Flip
// this if the 404 ever starts answering 200, which is when the hint is read.
const NOT_FOUND_CANONICAL_ENFORCED = false;

const TITLE_MAX = 60;
const DESC_MAX = 160;
const DESC_MIN = 70;

const SITE_SUFFIX = 'Market Data';

const HOSTS = {
  production: 'https://www.marketdata.app',
  staging: 'https://www-staging.marketdata.app',
};

const SKIP_DIRS = new Set(['assets', 'img', 'fonts', 'node_modules']);

/**
 * A "the walk found nothing" tripwire, not a content baseline. See the same
 * note in scripts/check-example-parity.js. Applies only to this repo's own
 * build; `--dir` is how the self-tests drive three-page fixtures.
 */
const FLOOR_PAGES = 50; // against a real 271

/**
 * The spec whose backlog table rule S1 gates. See the S1 block in main().
 *
 * S1's subject is THIS repository's PRODUCTION corpus, so it runs only when the
 * build being read is this repository's own and resolves to production.
 *
 * `--dir` pointing at a throwaway build -- which is how the self-tests exercise
 * every other rule -- skips it, because "docs/SEO.md says 33" is not a claim
 * about a synthetic three-page fixture.
 *
 * The environment half is not tidiness. Two counts genuinely differ between the
 * arms, and the first version of this rule asserted otherwise and was caught by
 * its own staging run: siteConfig.title is "Market Data Docs (staging)" there
 * against "Market Data" in production, so the suffix Docusaurus appends to every
 * title is 15 characters longer and I1 measures 10 titles over 60 rather than 1.
 * The document describes what crawlers are served, which is production.
 */
const SPEC = path.join(ROOT, 'docs', 'SEO.md');
const OWN_BUILD = path.join(ROOT, 'build');

/**
 * The header that identifies the backlog table, as normalised cell names.
 *
 * The table is found by its header rather than by matching `| H1 | 33 |`
 * anywhere in the file, for two reasons: a second table starting with a
 * rule-shaped cell cannot feed this rule, and a table that is renamed or
 * deleted is NOTICED rather than silently yielding no rows.
 *
 * Compared cell by cell after trimming, NOT as an exact string. The sibling
 * check in MarketDataApp/website matches its header exactly and can afford to,
 * because nothing formats its Markdown. This repo's pre-commit hook re-aligns
 * every table on every commit, so an exact match would break the first time a
 * column grew.
 */
const BACKLOG_HEADER = ['Rule', 'Backlog', 'What it is', 'Flag'];

/** `| A |  B  |` -> ['A', 'B'], or null if the line is not a table row. */
function cells(line) {
  const t = line.trim();
  if (!t.startsWith('|') || !t.endsWith('|')) return null;
  return t.slice(1, -1).split('|').map((c) => c.trim());
}

/**
 * Parse the backlog table out of docs/SEO.md.
 *
 * Returns Map<ruleId, count>, or null when the table cannot be found — which
 * the caller turns into a loud, distinct failure. Failing closed matters more
 * than parsing leniently: a rule that compares an empty table against an empty
 * expectation passes forever while gating nothing.
 */
function declaredBacklog(file) {
  if (!fs.existsSync(file)) return null;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const header = lines.findIndex((l) => {
    const c = cells(l);
    return c && c.length === BACKLOG_HEADER.length && c.every((v, i) => v === BACKLOG_HEADER[i]);
  });
  if (header === -1) return null;

  const out = new Map();
  // Skip the header and its `|---|` separator, then read until the table ends.
  for (let i = header + 2; i < lines.length; i++) {
    const c = cells(lines[i]);
    if (!c) break;
    if (/^[A-Z]\d$/.test(c[0]) && /^\d+$/.test(c[1])) out.set(c[0], Number(c[1]));
  }
  return out;
}

function parseArgs(argv) {
  // `--floor` lets the self-tests drive the tripwire against a small fixture,
  // rather than leaving that branch provable only by truncating the real build.
  const out = { dir: path.join(ROOT, 'build'), report: false, floor: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dir') out.dir = path.resolve(ROOT, argv[++i]);
    else if (argv[i] === '--report') out.report = true;
    else if (argv[i] === '--floor') out.floor = Number(argv[++i]);
  }
  return out;
}

function walk(dir, acc = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, acc);
    else if (e.name.endsWith('.html')) acc.push(full);
  }
  return acc;
}

/** The route a built file is served at, given `trailingSlash: true`. */
function routeOf(file, dir) {
  const rel = path.relative(dir, file).replace(/\\/g, '/');
  if (rel === '404.html') return '/404.html';
  return '/' + rel.replace(/index\.html$/, '');
}

/** The stem `lib/llms-txt.js` classifies: the route without its leading slash. */
function stemOf(route) {
  return route.replace(/^\//, '').replace(/\/$/, '');
}

function readPage(file, dir) {
  const html = fs.readFileSync(file, 'utf8');
  const doc = domino.createWindow(html).document;
  const attr = (sel, name) => doc.querySelector(sel)?.getAttribute(name) ?? null;
  const route = routeOf(file, dir);
  return {
    file,
    route,
    stem: stemOf(route),
    doc,
    lang: doc.documentElement?.getAttribute('lang') ?? null,
    titles: Array.from(doc.querySelectorAll('head title')),
    title: doc.querySelector('head title')?.textContent?.trim() ?? null,
    description: attr('meta[name="description"]', 'content'),
    canonicals: Array.from(doc.querySelectorAll('link[rel="canonical"]')),
    canonical: attr('link[rel="canonical"]', 'href'),
    robots: attr('meta[name="robots"]', 'content'),
    charsets: Array.from(doc.querySelectorAll('meta[charset]')),
    viewport: attr('meta[name="viewport"]', 'content'),
    ogTitle: attr('meta[property="og:title"]', 'content'),
    ogDescription: attr('meta[property="og:description"]', 'content'),
    ogUrl: attr('meta[property="og:url"]', 'content'),
    ogImage: attr('meta[property="og:image"]', 'content'),
    twitterCard: attr('meta[name="twitter:card"]', 'content'),
    modifiedTime: attr('meta[property="article:modified_time"]', 'content'),
    timeDatetime: attr('time[datetime]', 'datetime'),
    jsonLd: Array.from(doc.querySelectorAll('script[type="application/ld+json"]')).map((s) => {
      try {
        return JSON.parse(s.textContent);
      } catch {
        return { __unparseable: true };
      }
    }),
    h1s: Array.from(doc.querySelectorAll('h1')),
    headings: Array.from(doc.querySelectorAll('article h1, article h2, article h3, article h4, article h5, article h6'))
      .map((h) => Number(h.tagName[1])),
  };
}

/**
 * Which environment produced this build.
 *
 * Derived from the canonical host rather than from an env var, because the env
 * var is an input to the build and this check reads its OUTPUT — the two can
 * disagree, and when they do it is the artefact that ships. Cross-checked
 * against the robots directive and the sitemap below (rule D1).
 */
function resolveEnvironment(pages) {
  const hosts = new Set();
  for (const p of pages) {
    if (!p.canonical) continue;
    try {
      hosts.add(new URL(p.canonical).origin);
    } catch {
      /* rule C1 reports an unparseable canonical */
    }
  }
  if (hosts.size !== 1) {
    return { name: null, host: null, hosts: [...hosts] };
  }
  const host = [...hosts][0];
  const name = Object.keys(HOSTS).find((k) => HOSTS[k] === host) ?? null;
  return { name, host, hosts: [host] };
}

function sitemapPaths(dir) {
  const file = path.join(dir, 'sitemap.xml');
  if (!fs.existsSync(file)) return null;
  const xml = fs.readFileSync(file, 'utf8');
  const out = new Set();
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    try {
      out.add(new URL(m[1]).pathname);
    } catch {
      /* lint:sitemap owns sitemap wellformedness */
    }
  }
  return out;
}

// ---------------------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(args.dir)) {
    console.error(`No build at ${path.relative(ROOT, args.dir)} — run \`yarn build\` first.`);
    process.exit(1);
  }

  const files = walk(args.dir);
  if (files.length === 0) {
    console.error(`No HTML found under ${path.relative(ROOT, args.dir)}.`);
    process.exit(1);
  }

  const pageFloor = args.floor === null ? FLOOR_PAGES : args.floor;
  if ((args.dir === OWN_BUILD || args.floor !== null) && files.length < pageFloor) {
    console.error(
      `Only ${files.length} page(s) under ${path.relative(ROOT, args.dir)}/, ` +
        `below the floor of ${pageFloor}.\n\n` +
        'This is a tripwire for a walk that stopped matching, not a content\n' +
        'baseline. Do not lower the floor to make it pass.'
    );
    process.exit(1);
  }

  const pages = files.map((f) => readPage(f, args.dir));
  const routes = pages.filter((p) => p.route !== '/404.html');
  const notFound = pages.find((p) => p.route === '/404.html');
  const env = resolveEnvironment(pages);
  const sitemap = sitemapPaths(args.dir);

  const failures = []; // gated
  const reports = []; // measured, not gated
  const fail = (rule, message, offenders = []) => failures.push({ rule, message, offenders });
  const report = (rule, message, offenders = []) => reports.push({ rule, message, offenders });

  // --- Environment ---------------------------------------------------------
  // The build must be recognisably one environment or the other. A canonical
  // host we do not know is a deploy pointing somewhere unintended, and every
  // host-dependent rule below would otherwise silently pass.
  if (!env.name) {
    fail('D0', `build does not resolve to one known environment (canonical hosts: ${env.hosts.join(', ') || 'none'})`);
  }

  // --- A. Title ------------------------------------------------------------
  const noTitle = [];
  const manyTitles = [];
  const emptyTitle = [];
  const suffixOnly = [];
  for (const p of pages) {
    if (p.titles.length === 0) noTitle.push(p.route);
    else if (p.titles.length > 1) manyTitles.push(`${p.route} (${p.titles.length})`);
    if (p.titles.length === 1) {
      if (!p.title) emptyTitle.push(p.route);
      else if (p.title === SITE_SUFFIX || p.title === `| ${SITE_SUFFIX}`) suffixOnly.push(p.route);
    }
  }
  if (noTitle.length) fail('A1', 'pages with no <title>', noTitle);
  if (manyTitles.length) fail('A1', 'pages with more than one <title>', manyTitles);
  if (emptyTitle.length) fail('A1', '<title> present but empty', emptyTitle);
  if (suffixOnly.length) fail('A1', '<title> is only the site name', suffixOnly);

  // --- A2. Document basics -------------------------------------------------
  const noLang = pages.filter((p) => !p.lang).map((p) => p.route);
  const noCharset = pages.filter((p) => p.charsets.length !== 1).map((p) => p.route);
  const noViewport = pages.filter((p) => !p.viewport).map((p) => p.route);
  if (noLang.length) fail('A2', 'no lang attribute on <html>', noLang);
  if (noCharset.length) fail('A2', 'not exactly one <meta charset>', noCharset);
  if (noViewport.length) fail('A2', 'no viewport meta', noViewport);

  // --- B. Description ------------------------------------------------------
  // Exempt the navigation artifacts, using the classifier lib/llms-txt.js
  // already exports. A second list here would drift from that one, and the two
  // answer the same question: is this route content, or scaffolding?
  const contentPages = routes.filter((p) => !isNavigationArtifact(p.stem));
  const noDesc = contentPages.filter((p) => !p.description?.trim()).map((p) => p.route);
  if (noDesc.length) fail('B1', 'content pages with no description', noDesc);

  // --- C. Canonical --------------------------------------------------------
  const canonMissing = [];
  const canonMany = [];
  const canonRelative = [];
  const canonNotSelf = [];
  for (const p of routes) {
    if (p.canonicals.length === 0) {
      canonMissing.push(p.route);
      continue;
    }
    if (p.canonicals.length > 1) canonMany.push(`${p.route} (${p.canonicals.length})`);
    let u;
    try {
      u = new URL(p.canonical);
    } catch {
      canonRelative.push(`${p.route} -> ${p.canonical}`);
      continue;
    }
    // trailingSlash: true, so the canonical must be the route with its slash.
    const expected = `/docs${p.route}`;
    if (u.pathname !== expected) canonNotSelf.push(`${p.route} -> ${u.pathname} (expected ${expected})`);
  }
  if (canonMissing.length) fail('C1', 'pages with no canonical', canonMissing);
  if (canonMany.length) fail('C1', 'pages with more than one canonical', canonMany);
  if (canonRelative.length) fail('C2', 'canonical is not an absolute URL', canonRelative);
  if (canonNotSelf.length) fail('C2', 'canonical does not name this page', canonNotSelf);

  // --- C3. The head must not disagree with itself --------------------------
  const ogUrlMismatch = routes
    .filter((p) => p.canonical && p.ogUrl && p.ogUrl !== p.canonical)
    .map((p) => `${p.route}: og:url ${p.ogUrl} vs canonical ${p.canonical}`);
  if (ogUrlMismatch.length) fail('C3', 'og:url disagrees with the canonical', ogUrlMismatch);

  const ogDescMismatch = contentPages
    .filter((p) => p.description && p.ogDescription && p.ogDescription !== p.description)
    .map((p) => p.route);
  if (ogDescMismatch.length) fail('C3', 'og:description disagrees with the description', ogDescMismatch);

  // --- L1. The 404 must not canonicalise ----------------------------------
  // Its canonical would name /docs/404.html/, a URL that does not resolve.
  // Telling a crawler "this is my preferred URL" about a page that only ever
  // answers 404 is a contradiction, and the URL it names is itself a 404.
  if (notFound && notFound.canonicals.length > 0) {
    (NOT_FOUND_CANONICAL_ENFORCED ? fail : report)(
      'L1', 'the 404 page emits a canonical, and it names a URL that 404s',
      [`/404.html -> ${notFound.canonical}`]);
  }

  // --- D1. Robots and the sitemap are two halves of one statement ----------
  // An absence assertion matters as much as a presence one. A page the sitemap
  // advertises must not also say noindex, and a page that says noindex must not
  // be advertised. Checked in both directions so neither half can drift.
  if (env.name === 'staging') {
    const indexable = routes.filter((p) => !/noindex/i.test(p.robots ?? '')).map((p) => p.route);
    if (indexable.length) fail('D1', 'staging build has pages without noindex', indexable);
    if (sitemap) fail('D2', 'staging build published a sitemap; a noIndex build must not', [`${sitemap.size} URLs`]);
  } else if (env.name === 'production') {
    if (!sitemap) {
      fail('D2', 'production build published no sitemap');
    } else {
      const noindexed = routes.filter((p) => /noindex/i.test(p.robots ?? ''));
      const advertised = noindexed.filter((p) => sitemap.has(`/docs${p.route}`)).map((p) => p.route);
      if (advertised.length) fail('D2', 'noindex pages listed in the sitemap', advertised);

      const missing = routes
        .filter((p) => !/noindex/i.test(p.robots ?? ''))
        .filter((p) => !sitemap.has(`/docs${p.route}`))
        .map((p) => p.route);
      if (missing.length) fail('D2', 'indexable pages absent from the sitemap', missing);
    }
  }

  // --- E1. One h1 ----------------------------------------------------------
  const h1Wrong = pages.filter((p) => p.h1s.length !== 1).map((p) => `${p.route} (${p.h1s.length})`);
  if (h1Wrong.length) fail('E1', 'pages without exactly one <h1>', h1Wrong);

  // --- F1. Structured data agrees with the head around it -----------------
  // lint:schema does not exist here; nothing else compares the graph with the
  // tags beside it. The JSON-LD naming a different URL than the canonical would
  // describe a second page.
  const ldBad = [];
  for (const p of routes) {
    for (const ld of p.jsonLd) {
      if (ld.__unparseable) {
        ldBad.push(`${p.route}: JSON-LD does not parse`);
        continue;
      }
      if (ld.url && p.canonical && ld.url !== p.canonical) {
        ldBad.push(`${p.route}: JSON-LD url ${ld.url} vs canonical ${p.canonical}`);
      }
      if (ld.dateModified && p.modifiedTime && ld.dateModified !== p.modifiedTime) {
        ldBad.push(`${p.route}: dateModified ${ld.dateModified} vs article:modified_time ${p.modifiedTime}`);
      }
      if (ld.dateModified && p.timeDatetime && ld.dateModified !== p.timeDatetime) {
        ldBad.push(`${p.route}: dateModified ${ld.dateModified} vs <time datetime> ${p.timeDatetime}`);
      }
    }
  }
  if (ldBad.length) fail('F1', 'structured data disagrees with the head', ldBad);

  // --- Reported rules ------------------------------------------------------

  const groupBy = (items, key) => {
    const m = new Map();
    for (const it of items) {
      const k = key(it);
      if (!k) continue;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(it.route);
    }
    return [...m].filter(([, v]) => v.length > 1);
  };

  const dupTitles = groupBy(routes, (p) => p.title);
  const dupDescs = groupBy(contentPages, (p) => p.description?.trim());
  const record = TITLE_UNIQUE_ENFORCED ? fail : report;
  if (dupTitles.length) {
    record('H1', `${dupTitles.length} title(s) used by more than one page`,
      dupTitles.map(([t, v]) => `"${t}" x${v.length}: ${v.slice(0, 3).join(' ')}${v.length > 3 ? ' …' : ''}`));
  }
  (DESC_UNIQUE_ENFORCED ? fail : report)('H2',
    dupDescs.length ? `${dupDescs.length} description(s) used by more than one page` : null,
    dupDescs.map(([d, v]) => `"${d.slice(0, 40)}…" x${v.length}: ${v.slice(0, 3).join(' ')}`));

  const longTitles = routes.filter((p) => p.title && p.title.length > TITLE_MAX)
    .map((p) => `${p.route} (${p.title.length})`);
  const longDescs = contentPages.filter((p) => p.description && p.description.length > DESC_MAX)
    .map((p) => `${p.route} (${p.description.length})`);
  const shortDescs = contentPages.filter((p) => p.description && p.description.trim().length < DESC_MIN)
    .map((p) => `${p.route} (${p.description.trim().length})`);
  const lengthRule = LENGTH_ENFORCED ? fail : report;
  if (longTitles.length) lengthRule('I1', `title over ${TITLE_MAX} characters`, longTitles);
  if (longDescs.length) lengthRule('I2', `description over ${DESC_MAX} characters`, longDescs);
  if (shortDescs.length) lengthRule('I3', `description under ${DESC_MIN} characters`, shortDescs);

  // The card type is a promise about an image. summary_large_image with no
  // og:image renders as a bare link on every platform that reads it.
  const cardNoImage = routes.filter((p) => p.twitterCard === 'summary_large_image' && !p.ogImage)
    .map((p) => p.route);
  if (cardNoImage.length) {
    (CARD_IMAGE_ENFORCED ? fail : report)('F2',
      'twitter:card is summary_large_image but the page declares no og:image', cardNoImage);
  }

  const skips = [];
  for (const p of routes) {
    for (let i = 1; i < p.headings.length; i++) {
      if (p.headings[i] - p.headings[i - 1] > 1) {
        skips.push(`${p.route} (h${p.headings[i - 1]} -> h${p.headings[i]})`);
        break;
      }
    }
  }
  if (skips.length) {
    (HEADING_ORDER_ENFORCED ? fail : report)('D3', 'heading level skipped', skips);
  }

  // --- S1. The numbers in the prose are gated too --------------------------
  //
  // A count in a document is the one thing on the page nothing keeps true.
  // The sibling spec in MarketDataApp/website said "101 of 101" in six places
  // while its own check reported 127 pages -- wrong by 26 for weeks, in the
  // document that is supposed to be the statement of intent the check gates
  // against. Its lint:doc-refs gates every path:line citation in that file and
  // has nothing to say about a number beside one.
  //
  // So every reported rule's backlog is declared in docs/SEO.md and asserted
  // here. Pay ten titles down and this fails until the table agrees.
  const gatesSpec = args.dir === OWN_BUILD && env.name === 'production';
  const declared = gatesSpec ? declaredBacklog(SPEC) : null;
  if (gatesSpec && declared === null && fs.existsSync(SPEC)) {
    // Fail closed, and name which of the two things went wrong. Reporting this
    // as "eight rules have no row" would read as eight rules needing rows
    // rather than as one table having gone missing.
    fail('S1', 'docs/SEO.md has no backlog table for this rule to gate', [
      `looked for a header row reading: | ${BACKLOG_HEADER.join(' | ')} |`,
      'restore it, or delete rule S1 -- but do not leave hand-written counts',
      'in the document with nothing keeping them honest',
    ]);
  } else if (declared) {
    const measured = new Map(reports.filter((r) => r.message).map((r) => [r.rule, r.offenders.length]));
    const drift = [];
    for (const [rule, count] of declared) {
      const actual = measured.get(rule);
      if (actual === undefined) {
        drift.push(`${rule}: docs/SEO.md declares ${count}, this run reports the rule as clean`);
      } else if (actual !== count) {
        drift.push(`${rule}: docs/SEO.md declares ${count}, this run measured ${actual}`);
      }
    }
    for (const [rule, actual] of measured) {
      if (!declared.has(rule)) {
        drift.push(`${rule}: measured ${actual}, and docs/SEO.md's table has no row for it`);
      }
    }
    if (drift.length) {
      fail('S1', 'docs/SEO.md disagrees with what this run measured', drift);
    }
  }

  // --- Output --------------------------------------------------------------

  console.log(`${pages.length} built page(s) read from ${path.relative(ROOT, args.dir)}/`);
  console.log(`environment    ${env.name ?? 'UNRESOLVED'} (${env.host ?? '—'})\n`);

  const distinctTitles = new Set(routes.map((p) => p.title)).size;
  const distinctDescs = new Set(contentPages.map((p) => p.description?.trim()).filter(Boolean)).size;
  console.log(`canonical      ${routes.filter((p) => p.canonicals.length === 1).length} of ${routes.length} emit exactly one; 404 emits ${notFound ? notFound.canonicals.length : 'n/a'}`);
  console.log(`sitemap        ${sitemap ? `${sitemap.size} URLs` : 'none (correct for a noIndex build)'}`);
  console.log(`robots         ${routes.filter((p) => /noindex/i.test(p.robots ?? '')).length} page(s) noindex`);
  console.log(`titles         ${distinctTitles} distinct across ${routes.length} pages`);
  console.log(`descriptions   ${distinctDescs} distinct; ${contentPages.length - noDesc.length} of ${contentPages.length} content pages have one`);
  console.log(`headings       ${pages.filter((p) => p.h1s.length === 1).length} of ${pages.length} have exactly one h1`);
  console.log('');

  const shown = reports.filter((r) => r.message);
  if (shown.length) {
    console.log(`REPORTED, not gated (${shown.length}) — see docs/SEO.md:\n`);
    for (const r of shown) {
      console.log(`  ${r.rule}  ${r.message}  [${r.offenders.length}]`);
      const list = args.report ? r.offenders : r.offenders.slice(0, 3);
      for (const o of list) console.log(`        ${o}`);
      if (!args.report && r.offenders.length > 3) {
        console.log(`        … and ${r.offenders.length - 3} more (--report for all)`);
      }
    }
    console.log('');
  }

  if (failures.length) {
    console.log(`FAILED (${failures.length}):\n`);
    for (const f of failures) {
      console.log(`  ${f.rule}  ${f.message}  [${f.offenders.length}]`);
      for (const o of f.offenders.slice(0, 12)) console.log(`        ${o}`);
      if (f.offenders.length > 12) console.log(`        … and ${f.offenders.length - 12} more`);
    }
    console.log('\nEvery rule is stated in prose in docs/SEO.md. If a rule here and');
    console.log('that document disagree, one of them is wrong — fix both together.');
    process.exit(1);
  }

  console.log('Every gated rule passed.');
  process.exit(0);
}

if (require.main === module) main();

module.exports = { readPage, routeOf, stemOf, resolveEnvironment, walk };
