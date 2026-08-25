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
];

module.exports = { REDIRECTS };
