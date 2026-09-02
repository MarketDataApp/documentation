'use strict';

/**
 * The User-Agent every request this repo makes to the live site carries.
 *
 * Without it, Node's fetch identifies itself only as `node`, from a GitHub
 * Actions runner — which is an Azure address, so zone analytics reports our own
 * post-deploy tests as "Microsoft Corporation / node" and files them under bot
 * traffic from a third party.
 *
 * That is not merely untidy. `tests/redirects.integration.test.js` requests
 * EVERY source in redirects.js, in both slash forms, with GET and HEAD -- four
 * requests per rule per run, aimed at exactly the paths whose 404 traffic
 * justified adding them. On 2026-09-02 a rule with no measurable human demand
 * showed roughly 46 hits in 24 hours, and the shape of that number matches this
 * suite rather than the outside world.
 *
 * So the suite that proves a redirect works also manufactures the demand that
 * appears to justify it. Naming ourselves does not stop that -- only excluding
 * these requests from a count does -- but it makes the exclusion possible,
 * which it currently is not.
 *
 * Anything analysing traffic for this site should treat a UA containing
 * `MarketDataApp-docs-probe` as ours and remove it before quoting an external
 * figure. Matched as a SUBSTRING deliberately: pinning the whole string, or a
 * version inside it, breaks silently the day either changes and quietly
 * reclassifies our own traffic as somebody else's.
 */
const PROBE_AGENT = 'MarketDataApp-docs-probe';

/** fetch options with the probe UA merged into any headers already given. */
function probeInit(init = {}) {
  return {
    ...init,
    headers: { ...(init.headers || {}), 'user-agent': PROBE_AGENT },
  };
}

module.exports = { PROBE_AGENT, probeInit };
