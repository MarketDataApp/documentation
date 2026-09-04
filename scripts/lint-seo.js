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
 * EVERY FLAG IS NOW `true`, and the reported half of this file still has to
 * work. The backlog table in docs/SEO.md is empty, no rule reports anything,
 * and the machinery that prints and gates that table is therefore unexercised
 * by an ordinary run. `--ungate` exists so the self-tests can construct the
 * condition rather than borrow whichever rule happened to be red that month —
 * a fixture that moved four times as rules went green, and had nowhere left to
 * move. See `gate` in main().
 *
 * Usage:
 *   yarn build && node scripts/lint-seo.js
 *   node scripts/lint-seo.js --dir some/other/build
 *   node scripts/lint-seo.js --report   # print the reported-rule backlogs in full
 *   node scripts/lint-seo.js --ungate L1  # report one gated rule instead of failing
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
const { assertFreshBuild } = require('../lib/build-freshness');

const ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// The flags. Every one is `true`: nothing here is measured-but-not-gated any
// more, and docs/SEO.md's backlog table is empty. They are kept rather than
// deleted because each one records what was paid down to earn it, and because
// `--ungate` needs something to name. See docs/SEO.md.
// ---------------------------------------------------------------------------

const TITLE_UNIQUE_ENFORCED = true; // 270 distinct titles across 270 pages
const DESC_UNIQUE_ENFORCED = true; // 262 distinct descriptions across 262 content pages
const LENGTH_ENFORCED = true; // 0 titles > 60, and every description is 70-160
const CARD_IMAGE_ENFORCED = true; // themeConfig.image landed; 271 of 271 declare one
const HEADING_ORDER_ENFORCED = true; // 0 pages skip a heading level
// The 404 names no URL of its own: plugins/not-found-head.js cuts the
// canonical, og:url and the two hreflang alternates out of the built page.
//
// This was the last rule measured and not gated, on the argument that the page
// only ever answers 404 and a crawler drops the response before it reads the
// hint. Measured against production on 2026-09-03, that argument was false:
// Pages strips the .html, so /docs/404.html 308s to /docs/404 and THAT answers
// 200. A soft 404, crawlable, carrying a canonical to a URL that 404s -- which
// is the trigger the gap note itself named for flipping this flag.
const NOT_FOUND_CANONICAL_ENFORCED = true;

/**
 * Which flag holds which rule. The ONLY place that mapping is written down:
 * `gate(rule)` reads it, and `--ungate` validates against it.
 *
 * It used to be implicit -- each rule's call site named its own flag -- and a
 * table beside it would then have been a second copy to keep true. Rules with
 * no flag are absent on purpose: a rule that never had a backlog has nothing
 * to ungate, and listing it would invite ungating it.
 */
const ENFORCED = {
  H1: TITLE_UNIQUE_ENFORCED,
  H2: DESC_UNIQUE_ENFORCED,
  I1: LENGTH_ENFORCED,
  I2: LENGTH_ENFORCED,
  I3: LENGTH_ENFORCED,
  F2: CARD_IMAGE_ENFORCED,
  D3: HEADING_ORDER_ENFORCED,
  L1: NOT_FOUND_CANONICAL_ENFORCED,
};

const TITLE_MAX = 60;
const DESC_MAX = 160;
const DESC_MIN = 70;

const SITE_SUFFIX = 'Market Data';

/**
 * The same string on the staging arm. `docusaurus.config.js:13` picks between
 * the two on `PROD`, and Docusaurus appends ` | <siteConfig.title>` to every
 * page title, so the SAME authored title is 15 characters longer on staging.
 *
 * I1's budget is about what Google renders, and Google is only ever served
 * production. Measuring a staging build against a production-sized budget
 * fails ten titles on characters nobody can delete, so the budget is widened
 * there by exactly the difference between the two suffixes -- which measures
 * the authored title against the same 60 on both arms.
 *
 * Found by gating LENGTH_ENFORCED and then running an ordinary `yarn build`:
 * CI always passes PROD=true, so the trap would have sprung first on a
 * developer's machine, on a rule they had not touched.
 */
const SITE_SUFFIX_STAGING = 'Market Data Docs (staging)';

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
 * title is 15 characters longer and I1 measures 6 titles over 60 rather than 0.
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
  const out = { dir: path.join(ROOT, 'build'), report: false, floor: null, ungate: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dir') out.dir = path.resolve(ROOT, argv[++i]);
    else if (argv[i] === '--report') out.report = true;
    else if (argv[i] === '--floor') out.floor = Number(argv[++i]);
    else if (argv[i] === '--ungate') out.ungate.push(...argv[++i].split(',').map((r) => r.trim()));
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
    // Only the hreflang ones. A feed link is also a rel=alternate and says
    // nothing about which URL the page itself is; these do. Read for rule L1.
    alternates: Array.from(doc.querySelectorAll('link[rel="alternate"][hreflang]')),
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

  // Only for this repo's own build: `--dir` is a throwaway fixture with no
  // sources to be older than.
  if (args.dir === OWN_BUILD) {
    assertFreshBuild(ROOT, args.dir, 'PROD=true yarn build && node scripts/lint-seo.js');
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

  /**
   * Where a flagged rule's verdict goes: `fail`, or `report` when its flag is
   * false or `--ungate` names it for this run.
   *
   * `--ungate` is here so the reporting machinery stays PROVEN now that every
   * flag is true. Four self-tests used to stand on whichever rule was still
   * red — duplicate titles, then duplicate descriptions, then skipped
   * headings, then the 404's canonical — and each one had to be rewritten when
   * that rule went green. There is no fifth rule to move them to, and a
   * reporting path that nothing exercises is a reporting path that has stopped
   * working without telling anyone.
   *
   * It changes no rule's verdict about the corpus, only whether that verdict
   * is fatal, and it announces itself in the run header. Nothing in CI passes
   * it: `pr-checks.yml` runs `node scripts/lint-seo.js` with no arguments.
   */
  const ungated = new Set(args.ungate);
  const gate = (rule) => (message, offenders) =>
    (ENFORCED[rule] && !ungated.has(rule) ? fail : report)(rule, message, offenders);

  const unknownUngate = [...ungated].filter((r) => !(r in ENFORCED));
  if (unknownUngate.length) {
    console.error(`--ungate names no flagged rule: ${unknownUngate.join(', ')}`);
    console.error(`Flagged rules are: ${Object.keys(ENFORCED).join(', ')}`);
    process.exit(1);
  }

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

  // --- L1. The 404 must not name a URL of its own -------------------------
  //
  // Docusaurus emits the page's own URL four times, and on this page all four
  // read /docs/404.html/ -- a URL that 404s, because applyTrailingSlash adds a
  // slash and the result is not a route. A page that only ever means "not
  // found" has no preferred URL to declare, and the one it declares is nothing.
  //
  // All four are one defect, so all four are one rule. Gating the canonical
  // alone would leave og:url stating the same dead URL with nothing checking
  // it -- C3 compares og:url against the canonical, and it runs over `routes`,
  // which excludes this page.
  //
  // plugins/not-found-head.js cuts them out of the built page.
  if (notFound) {
    const href = (n) => n.getAttribute('href');
    const selfNaming = [
      ...notFound.canonicals.map((n) => `rel=canonical -> ${href(n)}`),
      ...(notFound.ogUrl ? [`og:url -> ${notFound.ogUrl}`] : []),
      ...notFound.alternates.map((n) => `rel=alternate hreflang=${n.getAttribute('hreflang')} -> ${href(n)}`),
    ];
    if (selfNaming.length) {
      gate('L1')(
        'the 404 page names a URL of its own, and that URL 404s',
        selfNaming.map((s) => `/404.html: ${s}`));
    }
  }

  // --- L2. The 404 says noindex, because it is reachable with a 200 -------
  //
  // The other half of L1, and the half that stops this being cosmetic. This
  // page is not only served as the body of a 404 response. Cloudflare Pages
  // strips the .html, so production answers:
  //
  //     /docs/404.html   308 -> /docs/404
  //     /docs/404        200                 the same page, as a success
  //
  // A soft 404 with no directive is indexable, and it is indexable under a URL
  // that looks like a real page. Staging emits noindex on every page already;
  // production sets none, so the plugin adds one there. Gated on both arms
  // rather than only on production, because the claim is about this page and
  // not about the environment.
  //
  // Kept apart from L1 deliberately: it is a second, independent statement,
  // and the two fail for different reasons and take different fixes.
  if (notFound && !/noindex/i.test(notFound.robots ?? '')) {
    fail('L2', 'the 404 page does not say noindex, and Pages serves it at /docs/404 with a 200',
      [`/404.html robots=${notFound.robots ?? 'absent'}`]);
  }

  // --- L3. The 404 must not be advertised in the sitemap -------------------
  //
  // True today, and asserted by nothing until now: @docusaurus/plugin-sitemap
  // excludes the 404 on its own, so the property held because of how a plugin
  // happens to behave. That is the shape this file keeps closing -- a guarantee
  // that is real, that nothing states, and that would drop silently if the
  // plugin's exclusion list ever changed.
  //
  // It matters more here than the count suggests. L2 exists because Pages
  // serves this page at /docs/404 with a 200, so a sitemap entry would be an
  // instruction to crawl a soft 404 rather than a harmless stray line.
  //
  // Every spelling is checked, because the entry could only ever appear by
  // some other route than the one we expect: Pages strips the .html, and the
  // site sets trailingSlash: true.
  if (sitemap) {
    const spellings = ['/docs/404', '/docs/404/', '/docs/404.html', '/docs/404.html/'];
    const listed = spellings.filter((p) => sitemap.has(p));
    if (listed.length) {
      fail('L3', 'the sitemap advertises the 404 page', listed);
    }
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

  // --- M1. /internal/ is noindex, by its own tag ---------------------------
  // The section is absent from the navbar, which is presentation and not a
  // directive: the routes build, deploy and answer 200, so anything that finds
  // a URL indexes it. What keeps them out is the `<head>` block each page
  // writes, and six consumers read that tag rather than any front matter --
  // Google, the Algolia crawler, markdown-twins, llms.txt G2, the sitemap's
  // ignorePatterns and D2 above.
  //
  // `unlisted: true` is NOT the mechanism here and must not be reintroduced.
  // It marks a page noindex and ALSO drops it from the sidebar in a production
  // build, which removes the one thing the section exists to give: land on a
  // page by URL and get the section's menu.
  //
  // So the tag is a hand-written line in every file, and a hand-written line
  // is one somebody forgets. This rule is the only thing that would say so --
  // the page would render, deploy, look right, and quietly be indexable.
  //
  // Staging is exempt because D1 already requires noindex on EVERY page there,
  // so this rule would restate it and would fail for a different reason.
  if (env.name !== 'staging') {
    const bare = routes
      .filter((p) => /^\/internal(\/|$)/.test(p.route))
      .filter((p) => !/noindex/i.test(p.robots ?? ''))
      .map((p) => p.route);
    if (bare.length) {
      fail('M1', 'internal pages without a noindex directive', bare);
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
  if (dupTitles.length) {
    gate('H1')(`${dupTitles.length} title(s) used by more than one page`,
      dupTitles.map(([t, v]) => `"${t}" x${v.length}: ${v.slice(0, 3).join(' ')}${v.length > 3 ? ' …' : ''}`));
  }
  // Guarded like H1 rather than passing a null message when clean. A null
  // message renders as nothing and S1 reads it as clean, which was harmless
  // while the rule was reported -- but `fail` has no such convention, so a
  // gated H2 with no duplicates failed the run with "H2 null [0]".
  if (dupDescs.length) {
    gate('H2')(
      `${dupDescs.length} description(s) used by more than one page`,
      dupDescs.map(([d, v]) => `"${d.slice(0, 40)}…" x${v.length}: ${v.slice(0, 3).join(' ')}`));
  }

  const titleMax = TITLE_MAX
    + (env.name === 'staging' ? SITE_SUFFIX_STAGING.length - SITE_SUFFIX.length : 0);
  const longTitles = routes.filter((p) => p.title && p.title.length > titleMax)
    .map((p) => `${p.route} (${p.title.length})`);
  const longDescs = contentPages.filter((p) => p.description && p.description.length > DESC_MAX)
    .map((p) => `${p.route} (${p.description.length})`);
  const shortDescs = contentPages.filter((p) => p.description && p.description.trim().length < DESC_MIN)
    .map((p) => `${p.route} (${p.description.trim().length})`);
  if (longTitles.length) gate('I1')(`title over ${titleMax} characters`, longTitles);
  if (longDescs.length) gate('I2')(`description over ${DESC_MAX} characters`, longDescs);
  if (shortDescs.length) gate('I3')(`description under ${DESC_MIN} characters`, shortDescs);

  // The card type is a promise about an image. summary_large_image with no
  // og:image renders as a bare link on every platform that reads it.
  const cardNoImage = routes.filter((p) => p.twitterCard === 'summary_large_image' && !p.ogImage)
    .map((p) => p.route);
  if (cardNoImage.length) {
    gate('F2')(
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
    gate('D3')('heading level skipped', skips);
  }

  // --- G1. Two independent walks, pinned to one artefact -------------------
  //
  // `plugins/markdown-twins.js` fails the build when a route has no Markdown
  // twin, so the guarantee is enforced -- at build time, by the same code that
  // writes them. Nothing re-checks it afterwards, and the two facts that make
  // that worth doing are both in CLAUDE.md:
  //
  //   * #188: `aws s3 sync --delete` removed files from R2 AFTER the build that
  //     had just produced them. Pages, that time. Losing an artefact between
  //     the build and the deploy is a thing that has happened here.
  //   * every doc page now carries a "View as Markdown" link to its twin, so a
  //     missing one is a 404 a reader can click, not only an agent's problem.
  //
  // This walk is independent: it starts from the built HTML this check already
  // enumerates, not from the plugin's route list. If that list ever narrows,
  // the page is still here and its twin is not, and the two walks disagree.
  // Two checks pinned to one artefact cannot disagree without one of them
  // failing -- which is the argument D2 already makes about robots and the
  // sitemap, applied one level out.
  //
  // Only `<route>index.md` is asserted, of the three names the plugin writes.
  // It is the one that exists for every route including the docs root, and the
  // one the actions row links to. `markdown-twins` owns the other two and the
  // rule that all three hold identical bytes.
  const twinless = [];
  for (const p of routes) {
    const twin = p.route === '/'
      ? path.join(args.dir, 'index.md')
      : path.join(args.dir, p.route.replace(/^\//, ''), 'index.md');
    if (!fs.existsSync(twin)) twinless.push(`${p.route} -> ${path.relative(args.dir, twin)} missing`);
  }
  if (twinless.length) {
    fail('G1', 'built pages whose Markdown twin is not in the build', twinless);
  }

  // --- G2. Nothing noindex is advertised to an LLM consumer -----------------
  //
  // Owner's ruling, 2026-09-03. Telling a crawler "do not index this" and an
  // LLM consumer "here is the page and here is its Markdown" is the site
  // contradicting itself, and the two halves are written by different code
  // that never consults the other.
  //
  // The generator derives the exclusion from the rendered <meta>, so this
  // gate and that generator start from the same artefact -- G1's argument
  // again. What it catches is the generator's list and the pages drifting,
  // which is exactly how MarketDataApp/website#95 happened: two route lists
  // were equal once, a ruling moved one, and eight noindex archives kept
  // being advertised with nothing red.
  //
  // The floor is not decoration. An assertion that passes because it examined
  // nothing is the shape this file has spent a week removing, and an empty or
  // truncated llms.txt would satisfy "no noindex route appears in it"
  // perfectly.
  if (env.name === 'production') {
    const llms = ['llms.txt', 'llms-full.txt']
      .map((name) => ({ name, file: path.join(args.dir, name) }))
      .filter((f) => fs.existsSync(f.file))
      .map((f) => ({ ...f, text: fs.readFileSync(f.file, 'utf8') }));

    // Their ABSENCE is only a defect in this repo's own build. A throwaway
    // fixture has no llms files and is not claiming to -- failing it there
    // would be asserting something about a corpus nobody generated.
    if (llms.length !== 2) {
      if (args.dir === OWN_BUILD) {
        fail('G2', 'the llms files are missing from the build', [
          `found ${llms.length} of 2 (llms.txt, llms-full.txt)`,
        ]);
      }
    } else {
      // The floor is scoped the same way, and for the same reason a fixture
      // is small on purpose. `--floor` drives it against one.
      const LLMS_FLOOR = args.floor === null ? 100 : args.floor; // real: 260 indexed
      const floored = args.dir === OWN_BUILD || args.floor !== null;
      const listed = (llms[0].text.match(/^- \[/gm) ?? []).length;
      if (floored && listed < LLMS_FLOOR) {
        fail('G2', `llms.txt lists only ${listed} route(s), below the floor of ${LLMS_FLOOR}`, [
          'a truncated index would satisfy the noindex rule below by containing nothing',
        ]);
      }

      const advertised = [];
      for (const p of routes.filter((p) => /noindex/i.test(p.robots ?? ''))) {
        const stem = p.route.replace(/^\/|\/$/g, '');
        for (const f of llms) {
          if (f.text.includes(`/${stem}/`) || f.text.includes(`/${stem}.md`)) {
            advertised.push(`${p.route} appears in ${f.name}`);
          }
        }
      }
      if (advertised.length) {
        fail('G2', 'noindex routes advertised in the llms files', advertised);
      }
    }
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
  // here. Pay ten descriptions down and this fails until the table agrees.
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
  console.log(`environment    ${env.name ?? 'UNRESOLVED'} (${env.host ?? '—'})`);
  // A run that ungated something must say so, or its exit code means something
  // different from every other run's and nothing on the page records that.
  if (ungated.size) console.log(`ungated        ${[...ungated].join(', ')} — reported for this run, not gated`);
  console.log('');

  const distinctTitles = new Set(routes.map((p) => p.title)).size;
  const distinctDescs = new Set(contentPages.map((p) => p.description?.trim()).filter(Boolean)).size;
  const selfNamed = notFound ? notFound.canonicals.length + notFound.alternates.length + (notFound.ogUrl ? 1 : 0) : 0;
  console.log(`canonical      ${routes.filter((p) => p.canonicals.length === 1).length} of ${routes.length} emit exactly one`);
  console.log(`404            names ${notFound ? selfNamed : 'n/a'} URL(s) of its own; robots ${notFound ? (notFound.robots ?? 'absent') : 'n/a'}`);
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
