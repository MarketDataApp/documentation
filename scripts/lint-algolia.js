#!/usr/bin/env node
'use strict';

/**
 * Watches the DocSearch index behind `/docs/` and fails when it stops being a
 * description of this site.
 *
 * ---------------------------------------------------------------------------
 * THE DEFECT THIS EXISTS TO END
 * ---------------------------------------------------------------------------
 *
 * The crawler was created on 2026-02-24 with `schedule: null`. It ran once for
 * three minutes and was never told to run again. On 2026-09-04 -- 192 days
 * later -- the index still held that February crawl: the entire C# SDK
 * (25 pages, added 2026-08-17) returned zero hits, and so did every Go page
 * added on 2026-09-02.
 *
 * Nothing reported it, and nothing could have. The crawler read
 * `running: true`, `blocked: false`, no errors, no failed run to find. The
 * build was green, the search box answered every query, and 418 searches in
 * 90 days ran against the stale index without one of them looking wrong. **A
 * search index has no failing state that resembles failure** -- it answers
 * from what it holds, and a visitor cannot miss a page they do not know
 * exists.
 *
 * So this check does not ask whether search WORKS. It asks how old the answer
 * is, which is the one question whose answer was already wrong in March.
 *
 * ---------------------------------------------------------------------------
 * WHY IT IS SCHEDULED AND NOT A PR GATE
 * ---------------------------------------------------------------------------
 *
 * Every subject here lives on Algolia's servers, not in the commit. A pull
 * request cannot make the index stale and cannot make it fresh, so gating a
 * merge on it would block authors on something no diff of theirs can fix --
 * and a check people cannot act on is a check people learn to skip. It runs
 * daily instead, and the failure is addressed to whoever owns the crawler.
 *
 * ---------------------------------------------------------------------------
 * WHY IT NEEDS NO SECRET
 * ---------------------------------------------------------------------------
 *
 * Rules A1-A3 and A5-A7 run on the PUBLIC search key, which already ships to
 * every visitor in `docusaurus.config.js`. That is deliberate: a check gated
 * behind a repository secret does not run on a fork, does not run for a
 * contributor, and quietly does not run in any environment somebody forgot to
 * configure -- which is the same silence that let this defect stand for six
 * months.
 *
 * A4, B1 and B2 need `ALGOLIA_USAGE_API_KEY`, `ALGOLIA_ANALYTICS_API_KEY` and
 * the crawler pair. When a key is absent they report that they were SKIPPED
 * and name the variable. They never pass quietly.
 *
 * ---------------------------------------------------------------------------
 * TWO FRESHNESS WITNESSES, ON PURPOSE
 * ---------------------------------------------------------------------------
 *
 * A2 reads the index's `updatedAt`. A4 reads the operation log for a write.
 * They measure the same event through different instruments, and the whole
 * point is that they can DISAGREE: `updatedAt` moves for any write at all,
 * including a settings edit that indexes no content, while the log names the
 * operation. A settings-only touch would refresh A2 and leave A4 red, which is
 * a state worth seeing rather than one to average away.
 *
 *   node scripts/lint-algolia.js
 *   node scripts/lint-algolia.js --json
 */

const {
  INDEX_NAME,
  search,
  listIndexes,
  getSettings,
  getLogs,
  analytics,
  crawler,
  newestWrite,
  ageInDays,
  sitemapUrls,
  normaliseUrl,
  settingsDrift,
} = require('../lib/algolia');

/**
 * The crawler runs `every 1 week on monday at 6:00 am`, set 2026-09-04.
 * Ten days is that period plus slack for a missed or slow run -- close enough
 * to report a stall inside a fortnight, loose enough that one skipped Monday
 * is not an alarm.
 */
const MAX_INDEX_AGE_DAYS = 10;

/**
 * A tripwire on the walk, never an inventory to keep in step with the content.
 *
 * The index held 5,161 records on 2026-09-04 and 4,983 before that. This floor
 * sits far below both, so it fires when a crawl publishes a fraction of the
 * site and never because somebody added pages. The same reasoning as
 * `corpus-floor.mjs` in `MarketDataApp/website`: a number in a check that
 * tracks the content is a number that goes stale and gets deleted.
 */
const MIN_RECORDS = 3000;

/**
 * `/docs/search/` is the Algolia search UI. It renders results and has no
 * content of its own, so DocSearch indexes nothing from it and never will.
 * It is in the sitemap because it is a real page a person can visit.
 */
const UNINDEXABLE = new Set(['https://www.marketdata.app/docs/search']);

const SITEMAP_URL = 'https://www.marketdata.app/docs/sitemap.xml';

/**
 * Enumerate every indexed page URL.
 *
 * The public key cannot `browse` (403) and pagination stops at 1,000 hits, so
 * the index is swept one `docusaurus_tag` x `type` facet cell at a time. On
 * 2026-09-04 that returned 267 of 268 sitemap URLs -- but one cell,
 * `docs-sdk-current/content`, reported 1,040 records against a 1,000 cap.
 *
 * **A capped cell is not a missing page and must not be reported as one.** A
 * page carries records under several types, so a URL lost to one cell's cap is
 * almost always found through another. That is luck, not a guarantee, which is
 * why `capped` comes back to the caller and why every apparent miss is
 * confirmed individually before anyone calls it missing.
 */
async function enumerateIndexedUrls() {
  const { facets } = await search({
    query: '',
    hitsPerPage: 0,
    facets: ['docusaurus_tag', 'type'],
    maxValuesPerFacet: 100,
  });
  const tags = Object.keys(facets?.docusaurus_tag || {});
  const types = Object.keys(facets?.type || {});
  const urls = new Set();
  const capped = [];

  for (const tag of tags) {
    for (const type of types) {
      const res = await search({
        query: '',
        hitsPerPage: 1000,
        distinct: 1,
        facetFilters: [`docusaurus_tag:${tag}`, `type:${type}`],
        attributesToRetrieve: ['url_without_anchor'],
      });
      for (const hit of res.hits) {
        if (hit.url_without_anchor) urls.add(normaliseUrl(hit.url_without_anchor));
      }
      if (res.nbHits > 1000) capped.push(`${tag}/${type} holds ${res.nbHits} against a 1000 cap`);
    }
  }
  return { urls, capped };
}

/**
 * Second opinion on one URL the sweep did not find.
 *
 * Queries the path's own words rather than the URL, because `url` is not a
 * searchable attribute on this index -- a fact worth stating, since asking for
 * `restrictSearchableAttributes: ['url']` fails with an error that does not
 * say why.
 */
async function confirmMissing(url) {
  const words = url.replace(/^https?:\/\/[^/]+\/docs\//, '').split('/').filter(Boolean).join(' ');
  const res = await search({
    query: words,
    hitsPerPage: 50,
    attributesToRetrieve: ['url_without_anchor'],
  });
  return !res.hits.some((h) => normaliseUrl(h.url_without_anchor || '') === url);
}

async function main() {
  const asJson = process.argv.includes('--json');
  const failures = [];
  const reports = [];
  const fail = (rule, message, offenders = []) => failures.push({ rule, message, offenders });
  const report = (rule, message, offenders = []) => reports.push({ rule, message, offenders });
  const facts = {};

  // --- A1. The index exists and answers ------------------------------------
  const { items } = await listIndexes();
  const index = items.find((i) => i.name === INDEX_NAME);
  if (!index) {
    fail('A1', `no index named "${INDEX_NAME}" on this application`, items.map((i) => i.name));
    return finish({ failures, reports, facts, asJson });
  }
  facts.records = index.entries;
  facts.updatedAt = index.updatedAt;

  // --- A2. The index is not stale ------------------------------------------
  const age = ageInDays(index.updatedAt);
  facts.indexAgeDays = age;
  if (age === null) {
    fail('A2', `index updatedAt is unreadable: ${JSON.stringify(index.updatedAt)}`);
  } else if (age > MAX_INDEX_AGE_DAYS) {
    fail('A2', `index last written ${age} days ago, budget is ${MAX_INDEX_AGE_DAYS}`, [index.updatedAt]);
  }

  // --- A3. The record count is above the floor -----------------------------
  if (index.entries < MIN_RECORDS) {
    fail('A3', `index holds ${index.entries} records, floor is ${MIN_RECORDS}`);
  }

  // --- A4. The log shows a write, independently of A2 ----------------------
  if (!process.env.ALGOLIA_USAGE_API_KEY) {
    report('A4', 'SKIPPED, ALGOLIA_USAGE_API_KEY is not set; the second freshness witness did not run');
  } else {
    const scanned = [];
    for (let page = 0; page < 4; page += 1) {
      const { logs } = await getLogs({ length: 1000, offset: page * 1000 });
      if (!logs || !logs.length) break;
      scanned.push(...logs);
    }
    facts.logEntriesScanned = scanned.length;
    const write = newestWrite(scanned);
    if (!write) {
      fail('A4', `no write operation in the last ${scanned.length} log entries; nothing has indexed this site`);
    } else {
      const writeAge = ageInDays(write.timestamp);
      facts.lastWriteAt = write.timestamp;
      facts.lastWriteAgeDays = writeAge;
      if (writeAge > MAX_INDEX_AGE_DAYS) {
        fail('A4', `newest write is ${writeAge} days old, budget is ${MAX_INDEX_AGE_DAYS}`, [
          `${write.method} ${write.url} at ${write.timestamp}`,
        ]);
      }
    }
  }

  // --- A5/A6. Coverage, and nothing internal -------------------------------
  const xml = await fetch(SITEMAP_URL).then((r) => {
    if (!r.ok) throw new Error(`sitemap: ${SITEMAP_URL} answered ${r.status}`);
    return r.text();
  });
  const wanted = sitemapUrls(xml).map(normaliseUrl);
  const { urls: indexed, capped } = await enumerateIndexedUrls();
  facts.sitemapUrls = wanted.length;
  facts.indexedUrls = indexed.size;
  if (capped.length) report('A5', 'the sweep could not enumerate these cells fully', capped);

  const suspected = wanted.filter((u) => !indexed.has(u) && !UNINDEXABLE.has(u));
  const missing = [];
  for (const url of suspected) {
    if (await confirmMissing(url)) missing.push(url);
  }
  if (missing.length) fail('A5', `${missing.length} sitemap route(s) have no record`, missing);

  const leaked = [...indexed].filter((u) => /\/docs\/internal(\/|$)/.test(u));
  if (leaked.length) {
    fail('A6', 'internal routes are in the public search index', leaked);
  }

  // --- A7. The settings have not drifted -----------------------------------
  const settings = await getSettings();
  const drift = settingsDrift(settings);
  if (drift.length) fail('A7', 'index settings no longer match the documented configuration', drift);

  // --- B1. Searches that returned nothing. Reported, never gated -----------
  if (!process.env.ALGOLIA_ANALYTICS_API_KEY) {
    report('B1', 'SKIPPED, ALGOLIA_ANALYTICS_API_KEY is not set');
  } else {
    const end = new Date().toISOString().slice(0, 10);
    const start = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const rate = await analytics('searches/noResultRate', { startDate: start, endDate: end });
    facts.searches30d = rate.count;
    facts.noResultRate = rate.rate;
    const none = await analytics('searches/noResults', { startDate: start, endDate: end, limit: 15 });
    report(
      'B1',
      `${rate.noResultCount} of ${rate.count} searches returned nothing in 30 days (${(rate.rate * 100).toFixed(1)}%)`,
      (none.searches || []).map((s) => `${s.search} (${s.count})`)
    );
  }

  // --- B2. The crawler's own state. Reported, never gated ------------------
  if (!process.env.ALGOLIA_CRAWLER_API_KEY) {
    report('B2', 'SKIPPED, ALGOLIA_CRAWLER_USER_ID / ALGOLIA_CRAWLER_API_KEY are not set');
  } else {
    const state = await crawler();
    const cfg = await crawler('?withConfig=true');
    facts.crawlerSchedule = cfg.config?.schedule ?? null;
    facts.lastReindexEndedAt = state.lastReindexEndedAt;
    // A null schedule is the exact cause of the six-month stall, so it is a
    // failure here rather than a note -- it is the one crawler property that
    // guarantees A2 will be red in ten days' time.
    if (!cfg.config?.schedule) {
      fail('B2', 'the crawler has no schedule; it will never run again on its own');
    }
    if (state.blocked) fail('B2', 'the crawler is blocked');
    report('B2', `schedule "${cfg.config?.schedule}", last reindex ended ${state.lastReindexEndedAt}`);
  }

  return finish({ failures, reports, facts, asJson });
}

function finish({ failures, reports, facts, asJson }) {
  if (asJson) {
    console.log(JSON.stringify({ failures, reports, facts }, null, 2));
  } else {
    // Every number on every run, passing or failing. A pass with no figures
    // cannot be told apart from a pass over nothing -- which is the shape of
    // defect this file exists to catch one level up.
    console.log(`index          ${INDEX_NAME}`);
    console.log(`records        ${facts.records}`);
    console.log(`last written   ${facts.updatedAt} (${facts.indexAgeDays} days ago)`);
    if (facts.lastWriteAt) console.log(`last write op  ${facts.lastWriteAt} (${facts.lastWriteAgeDays} days ago)`);
    console.log(`coverage       ${facts.indexedUrls} indexed URLs against ${facts.sitemapUrls} in the sitemap`);
    if (facts.crawlerSchedule !== undefined) console.log(`schedule       ${JSON.stringify(facts.crawlerSchedule)}`);
    if (facts.searches30d !== undefined) {
      console.log(`searches 30d   ${facts.searches30d}, ${(facts.noResultRate * 100).toFixed(1)}% returned nothing`);
    }
    console.log('');
    for (const r of reports) {
      console.log(`  ${r.rule}  ${r.message}`);
      for (const o of r.offenders) console.log(`        ${o}`);
    }
    if (failures.length) {
      console.log('');
      for (const f of failures) {
        console.log(`FAIL  ${f.rule}  ${f.message}`);
        for (const o of f.offenders) console.log(`        ${o}`);
      }
    } else {
      console.log('Every gated rule passed.');
    }
  }
  process.exitCode = failures.length ? 1 : 0;
}

main().catch((err) => {
  console.error(`lint-algolia: ${err.message}`);
  process.exitCode = 1;
});
