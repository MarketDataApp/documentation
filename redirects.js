"use strict";

/**
 * Every documentation redirect, in one place.
 *
 * These used to live inline in docusaurus.config.js, read by
 * @docusaurus/plugin-client-redirects and re-parsed out of the config file by
 * the integration test with a regular expression. Three consumers now import
 * the array instead:
 *
 *   plugins/redirects-file.js       writes them into the build as _redirects
 *                                   rules, which Cloudflare Pages serves as
 *                                   real 301s
 *   tests/redirects.integration.test.js  probes each one on the live site
 *   docusaurus.config.js            (until the client-redirects plugin goes)
 *
 * Paths are Docusaurus route paths, with no /docs prefix and no trailing
 * slash. The prefix and the slash are added where they are needed -- see
 * plugins/redirects-file.js, which is the only place that has to care.
 */

const REDIRECTS = [
  { from: "/account/troubleshooting/linkedin-missing", to: "/account/troubleshooting/linkedin-issues" },
  { from: "/api/troubleshooting/http-status-codes", to: "/api/troubleshooting" },
  { from: "/sheets/troubleshooting/common-error-messages", to: "/sheets/troubleshooting" },
  { from: "/api/universal-parameters/feed", to: "/api/universal-parameters/mode" },
  { from: "/sheets/automatic-refreshing", to: "/sheets/automatic-refresh" },
  { from: "/sheets/stockdata", to: "/sheets/stocks/stockdata" },
  { from: "/sheets/earnings", to: "/sheets/stocks/earnings" },
  { from: "/sheets/optiondata", to: "/sheets/options/optiondata" },
  { from: "/sheets/optionlookup", to: "/sheets/options/optionlookup" },
  { from: "/sheets/optionchain", to: "/sheets/options/optionchain" },
  { from: "/sheets/marketstatus", to: "/sheets/markets/marketstatus" },
  { from: "/account/compliance", to: "/account/data-policies/account-verification" },
  { from: "/api/options/strikes", to: "/api/options/chain" },
  { from: "/sdk/py/options/strikes", to: "/sdk/py/options/chain" },
  { from: "/sdk/php/options/strikes", to: "/sdk/php/options/chain" },
  { from: "/sdk/go/options/strikes", to: "/sdk/go/options/chain" },
  { from: "/sdk/csharp/options/strikes", to: "/sdk/csharp/options/chain" },
  { from: "/sdk/php/stocks/bulk-candles", to: "/sdk/php/stocks/bulkcandles" },

  // --- #197: two pages that moved years apart and took no redirect with them.
  //
  // Both were found by the 404 log store, not by a link checker, because
  // nothing in this repo links to either one. A link checker only sees the
  // links we still have; these are links the outside world still has.
  //
  // /api/category/universal-parameters was a Docusaurus generated-index
  // route, conjured by `link: { type: "generated-index" }` in
  // api/universal-parameters/_category_.json. Commit 5ce4d91 (2026-01-08)
  // deleted that file and added an index.mdx with `slug: /universal-parameters`
  // in its place. The page is still there and still good -- it just answers on
  // a different URL now, and the old one has been dead ever since.
  //
  // /api/stocks/bulkquotes was a real endpoint page until commit 0444635
  // (2025-05-07) deleted it. The endpoint did not go away; it was folded into
  // stocks/quotes, which takes `?symbols=A,B,C`. The docs already say so --
  // api/universal-parameters/mode.md links the words "Bulk Stock Quotes"
  // straight at /api/stocks/quotes -- so this rule only teaches the edge what
  // the prose already knew.
  { from: "/api/category/universal-parameters", to: "/api/universal-parameters" },
  { from: "/api/stocks/bulkquotes", to: "/api/stocks/quotes" },
];

/**
 * The legacy PHP SDK URL space, which redirects OFF this site entirely.
 *
 * These are not route pairs like REDIRECTS above. The source is a prefix under
 * /docs/sdk-php/ and the target is another host, so they need splats and their
 * own emitter in plugins/redirects-file.js.
 *
 * ---------------------------------------------------------------------------
 * Why this exists at all
 * ---------------------------------------------------------------------------
 *
 * The PHP SDK documentation moved to /docs/sdk/php/ and nothing in this repo
 * links to /docs/sdk-php/ any more -- a grep across every .md, .mdx, .js and
 * .tsx finds zero. This whole space is inbound links the outside world still
 * holds: old search results, old READMEs, old forum posts.
 *
 * It was served by the edge worker until now. The worker is being retired
 * (MarketData-App/www-marketdata-app#15), and it was the ONLY thing answering
 * these. Without the rules below every legacy PHP SDK URL becomes a 404.
 *
 * ---------------------------------------------------------------------------
 * The doubled prefixes, and why they are enumerated
 * ---------------------------------------------------------------------------
 *
 * Something in the wild emits doubled directory names -- /sdk-php/classes/
 * classes/Client rather than /sdk-php/classes/Client. The worker collapsed them
 * with `subpath.replace(/^(\w+)\/\1\//, '$1/')`, which is logic, and a
 * _redirects rule cannot run logic.
 *
 * It does not need to. The doubled prefix is always a top-level directory of
 * the generated phpDocumentor site, and that is a CLOSED SET. Measured against
 * the live site on 2026-08-31:
 *
 *   classes namespaces packages indices reports files   all serve pages
 *   graphs                                              404, does not exist
 *
 * So six explicit rules replace the regex, each with a single terminal splat,
 * which is all Cloudflare Pages _redirects supports. Issue #15 called this
 * blocked because it read the pattern as needing two wildcards. It does not --
 * the first wildcard was only ever standing in for this list.
 *
 * The collapse is worth keeping rather than dropping. Measured the same day:
 *
 *   /sdk-php/classes/MarketDataApp-Client.html          200
 *   /sdk-php/classes/classes/MarketDataApp-Client.html  404
 *
 * ORDER MATTERS. Cloudflare takes the first matching rule, so every collapse
 * rule must be emitted before the catch-all. plugins/redirects-file.js does
 * that, and tests/redirects.integration.test.js proves it against the live
 * site rather than trusting the ordering by eye.
 */
const SDK_PHP = {
  /** Where the generated PHP SDK documentation lives now. No trailing slash. */
  target: "https://marketdataapp.github.io/sdk-php",

  /** The path this site serves it under. No trailing slash. */
  source: "/sdk-php",

  /**
   * Top-level directories of the generated site, each of which shows up
   * doubled in links the outside world holds. Verified to serve pages; `graphs`
   * is deliberately absent because that directory does not exist.
   */
  doubledPrefixes: [
    "classes",
    "namespaces",
    "packages",
    "indices",
    "reports",
    "files",
  ],
};

module.exports = { REDIRECTS, SDK_PHP };
