import ExecutionEnvironment from '@docusaurus/ExecutionEnvironment';
import {
  RELOAD_KEY,
  isChunkLoadFailure,
  isChunkAssetError,
  readAttempts,
  shouldReload,
} from '../../lib/chunk-reload';

/**
 * Recovers a reader whose session outlived the build it started in.
 *
 * WHAT the defect is, WHY a reload rather than retaining old assets, and why
 * the guard is the important half, are all in `lib/chunk-reload.js`. This file
 * is the wiring, and it has three decisions of its own.
 *
 * ---------------------------------------------------------------------------
 * WHY TWO LISTENERS
 * ---------------------------------------------------------------------------
 *
 * They catch different halves of the same failure and neither sees both.
 *
 * `unhandledrejection` catches the router's `import()` rejecting -- the usual
 * shape, and the one that carries a `ChunkLoadError`.
 *
 * `error` in the CAPTURE phase catches the `<script>` element failing to load.
 * Resource errors do not bubble, so a listener without `true` here never runs;
 * that is the single easiest thing to get wrong in this file, and it fails
 * silently, because a page with no missing chunks looks identical either way.
 *
 * ---------------------------------------------------------------------------
 * WHY A MISSING sessionStorage MEANS DO NOTHING
 * ---------------------------------------------------------------------------
 *
 * Storage throws in a private window, with site data blocked, and inside some
 * embedded viewers. The guard against an infinite reload loop lives in that
 * storage, so without it there is no guard -- an in-memory flag is reset by
 * the very reload it is meant to bound.
 *
 * A reader whose chunk is missing for a reason a reload cannot cure would then
 * refresh forever. So the fallback is to leave the page broken, which is the
 * failure this file already accepts on its third attempt. Doing nothing is
 * recoverable; a refresh loop is not.
 *
 * ---------------------------------------------------------------------------
 * WHY THE COUNTER IS WRITTEN BEFORE THE RELOAD
 * ---------------------------------------------------------------------------
 *
 * `location.reload()` does not return, and the record has to survive into the
 * next page or it counts nothing. Writing after would be a counter that is
 * always zero -- which reads exactly like a working guard.
 */

if (ExecutionEnvironment.canUseDOM) {
  const recover = () => {
    let store;
    try {
      store = window.sessionStorage;
      // Touch it. Some browsers expose the object and throw on access.
      store.getItem(RELOAD_KEY);
    } catch {
      return; // No guard available. See the header.
    }

    const attempts = readAttempts(store.getItem(RELOAD_KEY));
    const now = Date.now();
    if (!shouldReload(attempts, now)) return;

    try {
      store.setItem(RELOAD_KEY, JSON.stringify({ n: attempts.n + 1, at: now }));
    } catch {
      return; // Could read but not write: still no guard.
    }
    window.location.reload();
  };

  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkLoadFailure(event?.reason)) recover();
  });

  // `true` is load-bearing: resource errors do not bubble.
  window.addEventListener(
    'error',
    (event) => {
      if (isChunkAssetError(event?.target)) recover();
    },
    true
  );
}
