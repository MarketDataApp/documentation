'use strict';

/**
 * Every Algolia API this repository can reach, and the pure logic that judges
 * what they return.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS AT ALL
 * ---------------------------------------------------------------------------
 *
 * On 2026-09-04 the DocSearch index behind `/docs/` was found to be six months
 * stale. Two instruments said so and they were never read:
 *
 *   - the index's own `updatedAt` stood at 2026-02-24T12:40:31Z, 192 days back
 *   - the operation log held 3,029 entries reaching 2026-05-26 and not one
 *     write among them -- no `batch`, no `saveObjects`, no `moveIndex`
 *
 * The cause was `schedule: null` on the crawler. It was created on 2026-02-24,
 * ran once for three minutes, and was never told to run again. It was not
 * broken, paused, blocked or rate-limited, which is exactly why nothing
 * reported it: every surface anyone looked at was green. The site kept
 * building, the search box kept answering, and 418 searches in 90 days ran
 * against an index that predated the entire C# SDK.
 *
 * **A search index fails silently by construction.** A stale index and a fresh
 * one are the same shape, answer in the same time and render identically. The
 * only difference is in content nobody thinks to search for, because nobody
 * searches for the page they do not know exists. So the defect is invisible
 * from every direction except a check that asks the index how old it is.
 *
 * ---------------------------------------------------------------------------
 * WHAT EACH CREDENTIAL REACHES, MEASURED 2026-09-04
 * ---------------------------------------------------------------------------
 *
 *   Search      search, listIndexes, settings.   PUBLIC -- it ships to the
 *               browser in docusaurus.config.js. Everything the watchdog
 *               gates is reachable with this key alone, which is deliberate:
 *               a check that needs a secret does not run on a fork's pull
 *               request, and this one must run everywhere.
 *   Usage       the Logs endpoint. The second, independent freshness witness.
 *   Analytics   query volume, and searches that returned nothing.
 *   Crawler     crawler.algolia.com. The only credential that can start a
 *               crawl or change a schedule. Basic auth, not a header key.
 *   Monitoring  NOTHING. `/1/status` answers 401 and `/1/inventory/servers`
 *               answers 403 for this application. It is a paid-plan feature
 *               and DocSearch does not grant it. The key is in `.env` so that
 *               a future reader does not spend an afternoon rediscovering
 *               this; no code path here uses it.
 *
 * There is no admin key. Algolia keeps it for a DocSearch-provisioned
 * application, so **nothing in this repository can write index settings**.
 * That single fact decides the order of every repair: a ranking tweak has to
 * be made in the crawler's `initialIndexSettings` BEFORE a reindex, because
 * afterwards there is no way to put it back.
 *
 * ---------------------------------------------------------------------------
 * NO SDK
 * ---------------------------------------------------------------------------
 *
 * The same reasoning as `MarketDataApp/website`'s `scripts/algolia-index.mjs`:
 * `algoliasearch` unpacks to megabytes to wrap a POST with two headers, and
 * every dependency here is one somebody has to keep audited. The calls used
 * are written out below and are the whole surface.
 */

const { PROBE_AGENT } = require('./probe-agent');

/** The DocSearch application and index behind `/docs/`. */
const APP_ID = 'IUHZFO750H';
const INDEX_NAME = 'Market Data Documentation';

/**
 * The public search key, duplicated from `docusaurus.config.js` on purpose.
 *
 * It is public by design -- it already ships to every visitor's browser -- and
 * hard-coding the fallback is what lets `lint:algolia` run with no `.env` and
 * no repository secret. `ALGOLIA_SEARCH_API_KEY` still overrides it, so a
 * regenerated key needs no code change.
 */
const PUBLIC_SEARCH_KEY = 'c29b76b827a4fa1a0ac3abe15f69ec5c';

/** The crawler behind that index, on crawler.algolia.com. */
const CRAWLER_ID = 'f42f78d6-acf4-4160-80e8-c69558fa87a5';

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

const appId = () => process.env.ALGOLIA_APP_ID || APP_ID;
const searchKey = () => process.env.ALGOLIA_SEARCH_API_KEY || PUBLIC_SEARCH_KEY;

async function json(url, options, what) {
  const res = await fetch(url, {
    ...options,
    headers: { 'User-Agent': PROBE_AGENT, ...(options?.headers || {}) },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`${what}: ${res.status} returned non-JSON: ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(`${what}: ${res.status} ${text.slice(0, 300)}`);
  }
  return body;
}

const keyed = (key) => ({
  'X-Algolia-API-Key': key,
  'X-Algolia-Application-Id': appId(),
});

/** POST a search query against the index. */
function search(body, { index = INDEX_NAME } = {}) {
  const url = `https://${appId()}-dsn.algolia.net/1/indexes/${encodeURIComponent(index)}/query`;
  return json(url, { method: 'POST', headers: keyed(searchKey()), body: JSON.stringify(body) }, 'search');
}

/** Every index on the application, with `entries` and `updatedAt`. */
function listIndexes() {
  return json(`https://${appId()}-dsn.algolia.net/1/indexes`, { headers: keyed(searchKey()) }, 'listIndexes');
}

/** The live index settings -- readable, never writable with our keys. */
function getSettings({ index = INDEX_NAME } = {}) {
  const url = `https://${appId()}-dsn.algolia.net/1/indexes/${encodeURIComponent(index)}/settings`;
  return json(url, { headers: keyed(searchKey()) }, 'getSettings');
}

/**
 * The operation log. Needs `ALGOLIA_USAGE_API_KEY`.
 *
 * Retention was measured at about 100 days on 2026-09-04 and is not
 * contractual, so a caller must treat an empty page as the end of the window
 * rather than as an answer about history.
 */
function getLogs({ length = 1000, offset = 0 } = {}) {
  const key = process.env.ALGOLIA_USAGE_API_KEY;
  if (!key) throw new Error('getLogs: ALGOLIA_USAGE_API_KEY is not set');
  const url = `https://${appId()}-dsn.algolia.net/1/logs?length=${length}&offset=${offset}&type=all`;
  return json(url, { headers: keyed(key) }, 'getLogs');
}

/** Analytics. Needs `ALGOLIA_ANALYTICS_API_KEY`. */
function analytics(path, params = {}) {
  const key = process.env.ALGOLIA_ANALYTICS_API_KEY;
  if (!key) throw new Error(`analytics(${path}): ALGOLIA_ANALYTICS_API_KEY is not set`);
  const query = new URLSearchParams({ index: INDEX_NAME, ...params }).toString();
  return json(`https://analytics.algolia.com/2/${path}?${query}`, { headers: keyed(key) }, `analytics/${path}`);
}

/**
 * The Crawler API. Basic auth with a user id and key, not the header pair
 * every other Algolia endpoint uses -- a difference that costs an afternoon
 * if you assume otherwise.
 */
function crawler(path = '', { method = 'GET', body } = {}) {
  const user = process.env.ALGOLIA_CRAWLER_USER_ID;
  const key = process.env.ALGOLIA_CRAWLER_API_KEY;
  if (!user || !key) throw new Error('crawler: ALGOLIA_CRAWLER_USER_ID / ALGOLIA_CRAWLER_API_KEY are not set');
  const id = process.env.ALGOLIA_CRAWLER_ID || CRAWLER_ID;
  const auth = Buffer.from(`${user}:${key}`).toString('base64');
  return json(
    `https://crawler.algolia.com/api/1/crawlers/${id}${path}`,
    {
      method,
      headers: { Authorization: `Basic ${auth}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    },
    `crawler${path}`
  );
}

// ---------------------------------------------------------------------------
// Pure logic -- everything below is tested without a network
// ---------------------------------------------------------------------------

/**
 * Read operations, by the last segment of an Algolia REST path.
 *
 * The list is of READS rather than writes on purpose. A new Algolia write verb
 * we have never seen would fall through a "known writes" list and be counted
 * as read activity, which is the direction that fails silently -- the exact
 * failure mode this whole file exists to end. An unknown verb here is counted
 * as a write, so the worst case is a check that goes green early and gets
 * corrected, never one that stays green while nothing runs.
 */
const READ_TAILS = new Set(['query', 'queries', 'settings', 'keys', 'indexes', 'browse', 'search', 'logs', 'facets']);

/** True when a log entry represents something that CHANGED the application. */
function isWriteOperation(entry) {
  const method = (entry.method || '').toUpperCase();
  if (method === 'GET') return false;
  if (method === 'PUT' || method === 'DELETE') return true;
  const path = String(entry.url || '').split('?')[0].replace(/\/+$/, '');
  const tail = path.slice(path.lastIndexOf('/') + 1);
  return !READ_TAILS.has(tail);
}

/** The newest write in a log page set, or null when there is none. */
function newestWrite(logs) {
  const writes = logs.filter(isWriteOperation);
  if (!writes.length) return null;
  return writes.reduce((a, b) => (a.timestamp >= b.timestamp ? a : b));
}

/** Whole days between an ISO timestamp and `now`, rounded down. */
function ageInDays(iso, now = new Date()) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((now.getTime() - then) / 86400000);
}

/** Every `<loc>` in a sitemap, as absolute URLs. */
function sitemapUrls(xml) {
  return [...String(xml).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
}

/**
 * A URL reduced to the form both sides of a coverage comparison agree on:
 * no anchor, no query, no trailing slash.
 *
 * The sitemap writes `…/candles/` and DocSearch stores `…/candles`. Comparing
 * them raw reports every route as missing, which reads as a catastrophe and is
 * a punctuation difference.
 */
function normaliseUrl(url) {
  const withoutHash = String(url).split('#')[0].split('?')[0];
  return withoutHash.replace(/\/+$/, '');
}

/**
 * Which sitemap routes have no record, and which indexed URLs are not in the
 * sitemap.
 *
 * `extra` is not a failure on its own -- an anchor-level record legitimately
 * has a URL the sitemap never lists -- but it is where an `/internal/` leak
 * would appear, so the caller gets it rather than a boolean.
 */
function coverage(sitemap, indexed) {
  const have = new Set(indexed.map(normaliseUrl));
  const want = sitemap.map(normaliseUrl);
  return {
    missing: want.filter((u) => !have.has(u)),
    extra: [...have].filter((u) => !new Set(want).has(u)),
  };
}

/**
 * Index settings that must survive a reindex.
 *
 * `hierarchy.lvl1` above `hierarchy.lvl0` is a deliberate departure from the
 * Docusaurus default, recorded in CLAUDE.md. On 2026-09-04 it existed ONLY on
 * the live index: the crawler's `initialIndexSettings` still listed `lvl0`
 * first, so the tweak lived one reindex away from being lost, in the one place
 * no key of ours can rewrite. The config was corrected before that reindex ran.
 * This rule is what stops the two drifting apart again.
 */
function settingsDrift(settings) {
  const drift = [];
  const searchable = settings.searchableAttributes || [];
  const lvl1 = searchable.findIndex((a) => a.includes('hierarchy.lvl1'));
  const lvl0 = searchable.findIndex((a) => a.includes('hierarchy.lvl0'));
  if (lvl1 === -1 || lvl0 === -1) {
    drift.push('searchableAttributes does not list both hierarchy.lvl0 and hierarchy.lvl1');
  } else if (lvl1 > lvl0) {
    drift.push(`hierarchy.lvl1 ranks below hierarchy.lvl0 (positions ${lvl1} and ${lvl0}); CLAUDE.md requires lvl1 first`);
  }
  if (settings.distinct !== true) drift.push(`distinct is ${JSON.stringify(settings.distinct)}, expected true`);
  if (settings.attributeForDistinct !== 'url') {
    drift.push(`attributeForDistinct is ${JSON.stringify(settings.attributeForDistinct)}, expected "url"`);
  }
  return drift;
}

module.exports = {
  APP_ID,
  INDEX_NAME,
  CRAWLER_ID,
  PUBLIC_SEARCH_KEY,
  search,
  listIndexes,
  getSettings,
  getLogs,
  analytics,
  crawler,
  isWriteOperation,
  newestWrite,
  ageInDays,
  sitemapUrls,
  normaliseUrl,
  coverage,
  settingsDrift,
};
