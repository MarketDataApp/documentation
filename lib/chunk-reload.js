'use strict';

/**
 * Decides whether a failed JavaScript chunk should cost the reader a reload.
 *
 * ---------------------------------------------------------------------------
 * THE DEFECT
 * ---------------------------------------------------------------------------
 *
 * Docusaurus content-hashes every route chunk and code-splits lazily -- this
 * build emits about 290 of them. A reader who loaded a page BEFORE a deploy is
 * holding HTML that names the old hashes. Their next click asks the router for
 * a chunk the new deployment does not contain, the import rejects, and the
 * navigation dies with nothing on screen to explain it.
 *
 * **Every deploy strands whoever is mid-session, for as long as they keep the
 * tab open.** Measured from production by the sibling watch in
 * `MarketData-App/website` (issue #98) on 2026-09-03, twice in one day, each
 * within half an hour of a docs deploy:
 *
 *   16:53:47Z..17:08:47Z   4x /docs/assets/js/c82cc3eb.91d1b87d.js
 *                          2x /docs/assets/js/51d3168d.8423fcd8.js
 *   20:53:47Z..21:08:47Z   6x /docs/assets/js/172a41b4.6c982ebc.js
 *
 * Every CI job was green through both windows, and correctly so: there is
 * nothing wrong with the new build. The 404 is for a file the PREVIOUS build
 * had, asked for by a page the previous build served. Nothing that inspects an
 * artefact can see it, because it is a property of two builds and a reader in
 * between.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS DOES AND DOES NOT FIX
 * ---------------------------------------------------------------------------
 *
 * It does not prevent the 404. It converts a dead page into one reload, which
 * fetches the current HTML and therefore the current chunk names.
 *
 * The alternative -- retaining the previous build's assets so the old hash
 * keeps resolving -- was considered and rejected as disproportionate. Pages
 * serves the merged build directory as a complete snapshot, so an old chunk
 * survives only if it is still IN that directory; keeping it means merging the
 * previous build's `assets/` into every new one, across two repositories and
 * an orchestrator this repo does not deploy from, plus a pruning policy or the
 * directory grows without bound.
 *
 * ---------------------------------------------------------------------------
 * WHY THE GUARD IS THE IMPORTANT HALF
 * ---------------------------------------------------------------------------
 *
 * A reload that re-fails must not reload again. The obvious version of this
 * fix is an infinite refresh loop on any reader whose chunk is missing for a
 * reason a reload cannot cure -- a genuinely broken deploy, an edge cache
 * still serving stale HTML that names the same dead chunk, a blocked asset
 * host. **A broken page is bad; a page that reloads forever is worse**, and it
 * is worse in a way the reader cannot escape without closing the tab.
 *
 * So: at most `MAX_ATTEMPTS` reloads per session, at least `MIN_INTERVAL_MS`
 * apart. After that the page stays broken and quiet.
 */

/** Where the attempt record lives. Session-scoped: a new tab starts clean. */
const RELOAD_KEY = 'docs:chunk-reload';

/**
 * Two, not one. One covers the ordinary case -- a deploy landed mid-session.
 * A second covers the reader who is unlucky enough to be reloaded into another
 * deploy, which is exactly the population this exists for and is not rare when
 * deploys come in a run. Three would not fix a case two cannot.
 */
const MAX_ATTEMPTS = 2;

/**
 * Far longer than a reload takes, so the second attempt cannot be spent inside
 * the first one's page load. It also makes a wedged loop visibly slow rather
 * than a flicker, which is the difference between a reader waiting and a
 * reader losing the tab.
 */
const MIN_INTERVAL_MS = 30_000;

/**
 * True when a rejected promise is webpack failing to fetch a chunk.
 *
 * Matched on BOTH the error name and the message. `ChunkLoadError` is what
 * webpack constructs, but the name does not survive every browser's
 * serialisation of a cross-origin script failure, and the message text is what
 * remains. Either alone leaves a real failure unhandled.
 */
function isChunkLoadFailure(reason) {
  if (!reason) return false;
  const name = typeof reason === 'object' ? String(reason.name ?? '') : '';
  const message = typeof reason === 'string' ? reason : String(reason.message ?? '');
  return name === 'ChunkLoadError' || /Loading (CSS )?chunk \S+ failed/i.test(message);
}

/**
 * True when a resource error names one of our own build assets.
 *
 * The path fragment is `/assets/js/` rather than `/docs/assets/js/` so this
 * does not have to know the `baseUrl`, which differs between a local build and
 * the deployed site.
 *
 * A third-party script failing is NOT this -- reloading would not fix it, and
 * an advert blocker refusing a request would put every reader into the guard.
 */
function isChunkAssetError(target) {
  if (!target || target.tagName !== 'SCRIPT') return false;
  return /\/assets\/js\/[^/]+\.js(\?|$)/.test(String(target.src ?? ''));
}

/**
 * Read an attempt record without trusting what is in storage.
 *
 * Anything unparseable, or shaped wrongly, counts as no record rather than as
 * an error: the reader gets their reload, and the worst case is one extra.
 */
function readAttempts(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { n: 0, at: 0 };
    const n = Number.isInteger(parsed.n) && parsed.n >= 0 ? parsed.n : 0;
    const at = Number.isFinite(parsed.at) ? parsed.at : 0;
    return { n, at };
  } catch {
    return { n: 0, at: 0 };
  }
}

/** Whether to reload now, given what this session has already tried. */
function shouldReload({ n, at }, now) {
  if (n >= MAX_ATTEMPTS) return false;
  return now - at >= MIN_INTERVAL_MS;
}

module.exports = {
  RELOAD_KEY,
  MAX_ATTEMPTS,
  MIN_INTERVAL_MS,
  isChunkLoadFailure,
  isChunkAssetError,
  readAttempts,
  shouldReload,
};
