'use strict';

/**
 * Does a search return the RIGHT page? Nothing else here asks that.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS SEPARATELY FROM THE REST OF lint:algolia
 * ---------------------------------------------------------------------------
 *
 * A2 proves the index is fresh. A5 proves every route is IN it. Both were
 * green on 2026-09-04 while the index answered five of twenty of these badly:
 * `rate limit` returned `/sdk/php/utilities/user/` and `google sheets`
 * returned a troubleshooting page. **Two correct checks, neither of which
 * could see it.**
 *
 * Freshness and coverage are properties of the corpus. This is a property of
 * the ranking, and the only instrument that can read it is a real query with
 * an asserted answer. The idea came from `lint:relevance` in
 * `MarketData-App/website`, which caught their own "Market Data API" page
 * sitting 28th for the query `Market Data API`.
 *
 * ---------------------------------------------------------------------------
 * WHY THE PASSING QUERIES MATTER AS MUCH AS THE FAILING ONES
 * ---------------------------------------------------------------------------
 *
 * The eight that pass are the regression surface. A ranking change is a single
 * global lever, so it moves queries nobody was looking at.
 *
 * That is not hypothetical here. The first `pageRank` tier tried also demoted
 * Sheets to 70; it fixed `troubleshooting` and silently broke `optionchain`,
 * which stopped returning the Sheets function literally named `OPTIONCHAIN`.
 * Only a baseline taken BEFORE the change could see that, and the score was
 * 8/20 either way — the total said nothing, the individual rows said
 * everything.
 *
 * **Take the baseline before touching ranking, never after.**
 *
 * ---------------------------------------------------------------------------
 * A KNOWN GAP THAT STARTS PASSING IS A FAILURE
 * ---------------------------------------------------------------------------
 *
 * `known` records why a row fails today. If such a row starts passing, this
 * check FAILS and names the line to delete.
 *
 * That inverse rule is the whole reason the list can be trusted. Without it a
 * gap list becomes a graveyard of things fixed years ago that nobody removed,
 * and then it is documentation of the past rather than a description of the
 * index. The convention is `MarketData-App/website`'s, from their KNOWN_GAPS.
 */

/**
 * Each row: the query a reader types, the route they should land on, and — when
 * it does not — why not.
 *
 * Baseline measured 2026-09-04 against the live index, after the `pageRank`
 * tiers landed. Eight pass.
 *
 * Every `want` is a route that exists in the build. Two earlier candidates were
 * dropped for failing that: `/api/credits` is not a page, and
 * `/internal/sdk-requirements` is `noindex`, so its ABSENCE is correct and rule
 * A6 asserts it.
 */
const RELEVANCE = [
  // --- Passing today. These are the regression surface; do not delete them. --
  { q: 'option chain', want: '/api/options/chain' },
  { q: 'rate limit', want: '/api/rate-limiting' },
  { q: 'authentication', want: '/api/authentication' },
  { q: 'universal parameters', want: '/api/universal-parameters' },
  { q: 'postman', want: '/sdk/postman' },
  { q: 'stockdata', want: '/sheets/stocks/stockdata' },
  { q: 'optionchain', want: '/sheets/options/optionchain' },

  // --- Known gaps: the SDK titles embed their section --------------------
  // "Stock Candles (Python SDK)" matches both words of `stock candles`,
  // adjacent and exact. `/api/stocks/candles` is titled "Candles" and matches
  // one, so it loses on `words` and never reaches the tie-break where
  // pageRank lives. `custom` is the LAST ranking criterion.
  //
  // No crawler setting fixes these. Titling the API pages for the concept
  // does: "Stock Candles" would match fully AND win at pageRank 100 over 30.
  { q: 'stock candles', want: '/api/stocks/candles', known: 'retitled "Stock Candles" 2026-09-04; awaiting production' },
  { q: 'option quotes', want: '/api/options/quotes', known: 'retitled "Option Quotes" 2026-09-04; awaiting production' },
  { q: 'bulk candles', want: '/api/stocks/bulkcandles', known: 'retitled "Bulk Stock Candles" 2026-09-04; awaiting production' },
  { q: 'earnings', want: '/api/stocks/earnings', known: 'retitled "Stock Earnings" 2026-09-04; awaiting production' },
  { q: 'option expirations', want: '/api/options/expirations', known: 'retitled "Option Expirations" 2026-09-04; awaiting production' },

  // --- Known gaps: a section index loses to its own deep pages -----------
  // Same section, so the same pageRank: this is not a tier problem. Every page
  // under /sdk/php/ carries "(PHP SDK)" in its title, so the index page has
  // nothing to distinguish it from twenty siblings that match equally well.
  { q: 'php sdk', want: '/sdk/php' },
  { q: 'python sdk', want: '/sdk/py' },
  { q: 'go sdk', want: '/sdk/go' },
  { q: 'google sheets', want: '/sheets' },
  { q: 'billing portal', want: '/account/billing-portal' },

  // --- Known gaps: a cross-section tie broken by insertion order ---------
  // API and Sheets share pageRank 100 deliberately, so these fall to insertion
  // order. Demoting Sheets would settle them and cost `optionchain`, which is
  // a worse trade: a reader typing an exact function name should get it.
  { q: 'troubleshooting', want: '/api/troubleshooting', known: 'a bare word with two honest answers; /sheets/troubleshooting is equally right' },
  { q: 'market status', want: '/api/markets/status', known: 'retitled "Market Status" 2026-09-04; awaiting production' },

  // --- Known gap that will clear itself ----------------------------------
  // The tag pages were deleted on 2026-09-04 but PRODUCTION still serves them,
  // and production is what the crawler reads. This clears on the first crawl
  // after that removal reaches `main` — at which point the line below must go.
  { q: 'api credits', want: '/api/rate-limiting', known: 'a deleted tag page production still serves' },
];

/** A URL reduced to a comparable route: no origin, no trailing slash. */
function routeOf(url) {
  return String(url || '')
    .replace(/^https?:\/\/[^/]+\/docs/, '')
    .split('#')[0]
    .replace(/\/+$/, '');
}

/**
 * Compare measured first results against the table.
 *
 * `results` maps a query string to the first hit's URL (or null for no hit).
 * Returns the two lists the caller reports separately, because they are
 * different kinds of news: a regression is a gate, a known gap is a note.
 */
function judge(results) {
  const regressions = []; // was expected to pass, does not
  const gaps = []; // known to fail, still failing
  const fixed = []; // known to fail, now passing -- delete the `known` line

  for (const row of RELEVANCE) {
    const got = routeOf(results[row.q]);
    const pass = got === routeOf(row.want);
    if (row.known) {
      if (pass) fixed.push(`${row.q} -> ${row.want} now passes; delete its \`known\` in lib/algolia-relevance.js`);
      else gaps.push(`${row.q} -> ${got || '(nothing)'} (want ${row.want}; ${row.known})`);
    } else if (!pass) {
      regressions.push(`${row.q} -> ${got || '(nothing)'} (want ${row.want})`);
    }
  }
  return { regressions, gaps, fixed };
}

module.exports = { RELEVANCE, routeOf, judge };
