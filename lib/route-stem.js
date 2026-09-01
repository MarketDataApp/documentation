'use strict';

/**
 * The route path with `baseUrl` taken off: "/docs/api/tags/" -> "api/tags/".
 */
function routeSuffix(routePath, baseUrl) {
  return routePath
    .replace(new RegExp(`^${baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), '')
    .replace(/^\/+/, '');
}

/**
 * Turns a built route path into the stem the candidate list is resolved
 * against: "/docs/api/stocks/candles/" -> "api/stocks/candles".
 *
 * Returns null for the docs root, which has no source of its own.
 *
 * Shared rather than duplicated because two plugins depend on agreeing:
 * markdown-twins WRITES a twin at a path derived from the stem, and llms-txt
 * READS that same file back. Two copies that drifted would not fail loudly --
 * the index would quietly lose entries for the routes they disagreed about.
 */
function stemOf(routePath, baseUrl) {
  return routeSuffix(routePath, baseUrl).replace(/\/+$/, '') || null;
}

module.exports = { routeSuffix, stemOf };
