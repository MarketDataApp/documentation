'use strict';

/**
 * The build sentinel's CI half: the wiring no build can see.
 *
 * ---------------------------------------------------------------------------
 * What this asks that nothing else can
 * ---------------------------------------------------------------------------
 *
 * `plugins/build-info.js` asserts, on every build, that the sentinel it writes
 * and the pages beside it name one real commit. That is everything a build can
 * know about itself. Three more things decide whether the DEPLOYED sentinel is
 * worth reading, and all three live in `deploy-docs.yml`:
 *
 *   D1  the build's PROD and the orchestrator's `environment` come from ONE
 *       step, so a production deploy cannot carry a sentinel saying `staging`
 *   D2  the dispatch payload's `commit_sha` is the value the build resolved,
 *       so the post-deploy comparison compares one question
 *   D3  exactly one `_headers` rule matches the sentinel, and it is `no-store`
 *
 * D3 is the one with a history. `_headers` is NOT first-match-wins: every
 * matching rule applies and a repeated header name APPENDS. A `/docs/*.js` rule
 * already did exactly that on staging, serving
 * `cache-control: public, max-age=31536000, immutable, public, max-age=31536000, immutable`,
 * and it was found by the orchestrator rather than by anything in this
 * repository. On the sentinel the same overlap is worse than untidy: a cached
 * sentinel answers about a PREVIOUS deploy while looking exactly as
 * authoritative as a fresh one, which is strictly worse than having none.
 *
 * ---------------------------------------------------------------------------
 * Why a test rather than care
 * ---------------------------------------------------------------------------
 *
 * Each of these is a pairing whose halves sit tens of lines apart in a file
 * nobody reads top to bottom, and each half looks ordinary alone. This and
 * `workflows.test.js` are the only checks here that can fail BEFORE a workflow
 * runs; everything else about CI is discovered by pushing, and a deploy-time
 * discovery about the sentinel arrives as a confident wrong answer rather than
 * as a failure.
 *
 * ---------------------------------------------------------------------------
 * Every check is driven by a mutation, and the mutations verify themselves
 * ---------------------------------------------------------------------------
 *
 * A gate nobody has broken is a gate nobody has tested. Each check below is run
 * twice: once against the real workflow, where it must pass, and once against a
 * copy with the defect it exists to catch, where it must fail. `mutate()`
 * throws when its pattern matches nothing, so a mutation that stops applying --
 * after any edit to the workflow's wording -- reports itself instead of quietly
 * testing an unchanged file. Two of the sibling repository's cases were
 * vacuous until that guard was added.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { SENTINEL_FILE } = require('../../lib/build-info');

const WORKFLOW = path.resolve(__dirname, '../../.github/workflows/deploy-docs.yml');
const REAL = fs.readFileSync(WORKFLOW, 'utf8');

// ---------------------------------------------------------------------------
// Reading the workflow
// ---------------------------------------------------------------------------

/**
 * The `run:` block of one named step, comments stripped.
 *
 * Comments are stripped for the reason `workflows.test.js` records: its first
 * version matched `cache: pnpm` inside a comment explaining why a job has none,
 * and reported that job as misconfigured. This workflow holds far more prose
 * than YAML, and every string looked for below appears in that prose too.
 */
function runBlockOf(yml, name) {
  const start = yml.indexOf(`- name: ${name}`);
  assert.notEqual(start, -1, `deploy-docs.yml has no step named "${name}"`);
  const after = yml.slice(start);
  const runAt = after.indexOf('run: |');
  assert.notEqual(runAt, -1, `the "${name}" step has no block run:`);
  const lines = [];
  for (const line of after.slice(runAt + 'run: |'.length).split('\n').slice(1)) {
    if (line.trim() === '') continue;
    if (/^\s{0,9}\S/.test(line)) break; // the next step, at a shallower indent
    if (/^\s*#/.test(line)) continue;
    lines.push(line);
  }
  return lines.join('\n');
}

/** `${{ x }}` -> `x`, whitespace flattened, so two spellings compare equal. */
const expr = (s) => s?.replace(/\$\{\{\s*(.*?)\s*\}\}/g, '$1').replace(/\s+/g, ' ').trim();

/** The generated `_headers`, as [{ pattern, headers }]. */
function generatedHeaders(yml) {
  const block = runBlockOf(yml, 'Generate cache headers');
  assert.match(block, />\s*build\/_headers/, '_headers must still be written to build/_headers');

  const baseUrl = runBlockOf(yml, 'Set environment').match(/echo\s+"base_url=([^"]*)"/)?.[1];
  assert.equal(baseUrl, 'docs', 'the base path both environments share');

  const args = [...block.matchAll(/"([^"]*)"/g)].map((m) => m[1].replace(/\$\{BASE_URL\}/g, baseUrl));
  const rules = [];
  for (const line of args) {
    if (line.startsWith('/')) rules.push({ pattern: line, headers: [] });
    else if (line.trim() && rules.length) rules[rules.length - 1].headers.push(line.trim());
  }
  // This whole check reads one parse. A printf rewritten in a shape the parse
  // does not understand must FAIL here, not pass by finding no rules to object
  // to -- the difference between "nothing was wrong" and "nothing was read".
  assert.ok(rules.length >= 3, `parsed only ${rules.length} rule(s) out of the printf`);
  return rules;
}

/** Cloudflare's `*` splat, which is all these rules use. */
function matches(pattern, url) {
  const re = pattern
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${re}$`).test(url);
}

// ---------------------------------------------------------------------------
// The checks
// ---------------------------------------------------------------------------

const CHECKS = {
  /**
   * D1. The sentinel's `environment` comes from PROD, which the build reads.
   * The orchestrator's target comes from the payload. Resolved separately --
   * two `if` blocks, or a literal on either side -- a production deploy could
   * carry a sentinel saying `staging` with every check in both repositories
   * green: the site correct, and only the thing that says WHICH site it is
   * wrong.
   */
  'the build and the dispatch read one env step'(yml) {
    assert.equal(expr(yml.match(/PROD:\s*(\$\{\{[^}]*\}\})/)?.[1]), 'steps.env.outputs.prod');
    assert.equal(expr(yml.match(/"environment":\s*"(\$\{\{[^}]*\}\})"/)?.[1]), 'steps.env.outputs.environment');
  },

  /**
   * D1, second half. Two outputs of one step is one resolver only while they
   * agree, and they are written by two separate `echo`s.
   */
  'prod and environment are set in the same branch'(yml) {
    const branches = runBlockOf(yml, 'Set environment').split(/\bthen\b|\belse\b|\bfi\b/);
    const seen = [];
    for (const branch of branches) {
      const outs = Object.fromEntries([...branch.matchAll(/echo\s+"([a-z_]+)=([^"]*)"/g)].map((m) => [m[1], m[2]]));
      if (!('prod' in outs) && !('environment' in outs)) continue;
      seen.push(outs);
      assert.equal(
        outs.prod === 'true',
        outs.environment === 'production',
        `a branch sets prod=${JSON.stringify(outs.prod)} beside environment=${JSON.stringify(outs.environment)}`
      );
    }
    // A parse that matched nothing would satisfy every assertion above it.
    assert.equal(seen.length, 2, 'expected exactly two branches to set the pair');
    assert.ok(
      seen.some((o) => o.environment === 'production') && seen.some((o) => o.environment === 'staging'),
      'both environments must be reachable'
    );
  },

  /**
   * D2. `resolveGit()` prefers GITHUB_SHA, which is `github.sha`. The
   * orchestrator is told `commit_sha`, and MarketData-App/website's post-deploy
   * smoke compares a deployed sentinel against the sha it dispatched. Two
   * expressions would make that comparison assert that two different questions
   * happen to have the same answer, which is not a check.
   */
  'the dispatch names the commit the build reads'(yml) {
    const payload = yml.match(/"commit_sha":\s*"(\$\{\{[^}]*\}\})"/)?.[1];
    assert.ok(payload, 'the dispatch payload no longer sets commit_sha');
    assert.equal(expr(payload), 'github.sha');

    // GITHUB_SHA set on the Build step would take precedence over the checkout
    // silently, and the two would disagree with nothing to show it.
    const build = yml.slice(yml.indexOf('- name: Build'), yml.indexOf('- name: Restructure build output'));
    assert.doesNotMatch(build, /GITHUB_SHA:/, 'the Build step must not override GITHUB_SHA');
  },

  /** D3. One claimant, and it is `no-store`. */
  'one cache rule claims the sentinel, and it is no-store'(yml) {
    const url = `/docs/${SENTINEL_FILE}`;
    const claimants = generatedHeaders(yml).filter((r) => matches(r.pattern, url));

    assert.equal(
      claimants.length,
      1,
      `${claimants.length} rule(s) match ${url}: ${claimants.map((r) => r.pattern).join(', ') || 'none'}.\n` +
        '_headers is NOT first-match-wins -- every matching rule applies and a\n' +
        'repeated header name APPENDS, so two rules serve two Cache-Control values\n' +
        'with no rule about which wins. The fix is `! Cache-Control` in the specific\n' +
        'rule, unsetting before setting, with the broad rule FIRST. That ordering is\n' +
        'load-bearing: reversed, the file still parses and still deploys.'
    );
    assert.deepEqual(
      claimants[0].headers.map((h) => h.toLowerCase()),
      ['cache-control: no-store'],
      'a cached sentinel answers about a previous deploy while looking authoritative'
    );
  },

  /**
   * D3, second half. Rename the sentinel in `lib/build-info.js` and the cache
   * rule stops matching: the build still succeeds, the endpoint still answers,
   * and it starts answering about whatever the edge happens to hold.
   */
  'the rule names the file the plugin writes'(yml) {
    assert.ok(
      generatedHeaders(yml).some((r) => r.pattern === `/docs/${SENTINEL_FILE}`),
      `deploy-docs.yml has no rule for /docs/${SENTINEL_FILE}`
    );
  },
};

for (const [name, check] of Object.entries(CHECKS)) {
  test(name, () => check(REAL));
}

// ---------------------------------------------------------------------------
// The mutations
// ---------------------------------------------------------------------------

/** Apply one edit, and fail loudly when it applies to nothing. */
function mutate(from, to) {
  const count = REAL.split(from).length - 1;
  assert.equal(count, 1, `mutation anchor appears ${count} time(s), expected once: ${JSON.stringify(from)}`);
  return REAL.replace(from, to);
}

/** The same guard, for an edit that spans lines. */
function mutateRegex(re, to) {
  const hits = REAL.match(new RegExp(re, re.flags.includes('g') ? re.flags : `${re.flags}g`)) ?? [];
  assert.equal(hits.length, 1, `mutation pattern matched ${hits.length} time(s), expected once: ${re}`);
  return REAL.replace(re, to);
}

const MUTATIONS = [
  {
    what: 'PROD hardcoded instead of read from the env step',
    yml: () => mutate('PROD: ${{ steps.env.outputs.prod }}', 'PROD: true'),
    breaks: 'the build and the dispatch read one env step',
  },
  {
    what: 'the dispatch environment hardcoded',
    yml: () => mutate('"environment": "${{ steps.env.outputs.environment }}"', '"environment": "production"'),
    breaks: 'the build and the dispatch read one env step',
  },
  {
    what: 'the production branch left saying staging',
    yml: () => mutate('echo "environment=production"', 'echo "environment=staging"'),
    breaks: 'prod and environment are set in the same branch',
  },
  {
    what: 'the env step reduced to one branch',
    yml: () => mutate('echo "prod=true"', 'echo "prod=maybe"'),
    breaks: 'prod and environment are set in the same branch',
  },
  {
    what: 'the dispatched sha taken from a different expression',
    yml: () => mutate('"commit_sha": "${{ github.sha }}"', '"commit_sha": "${{ github.event.head_commit.id }}"'),
    breaks: 'the dispatch names the commit the build reads',
  },
  {
    what: 'GITHUB_SHA overridden on the Build step',
    yml: () => mutate('          PROD: ${{ steps.env.outputs.prod }}', '          PROD: ${{ steps.env.outputs.prod }}\n          GITHUB_SHA: deadbeef'),
    breaks: 'the dispatch names the commit the build reads',
  },
  {
    what: 'a broad rule added above, doubling Cache-Control on the sentinel',
    yml: () =>
      mutate(
        '            "/${BASE_URL}/assets/*" \\',
        '            "/${BASE_URL}/*" \\\n            "  Cache-Control: public, max-age=600" \\\n            "" \\\n            "/${BASE_URL}/assets/*" \\'
      ),
    breaks: 'one cache rule claims the sentinel, and it is no-store',
  },
  {
    what: 'the sentinel given a lifetime instead of no-store',
    yml: () => mutate('"  Cache-Control: no-store"', '"  Cache-Control: public, max-age=60"'),
    breaks: 'one cache rule claims the sentinel, and it is no-store',
  },
  {
    what: 'the cache rule left naming the old filename',
    yml: () => mutate('"/${BASE_URL}/build-info.json"', '"/${BASE_URL}/build-info.txt"'),
    breaks: 'the rule names the file the plugin writes',
  },
  {
    // Not a defect on its own -- a heredoc would generate the same file. The
    // point is that a shape this parse cannot read must FAIL, rather than find
    // no rules and report no overlap. "Nothing was wrong" and "nothing was
    // read" are the same output without the floor.
    what: 'the printf rewritten in a shape the parse cannot read',
    yml: () =>
      mutateRegex(
        /printf '%s\\n' \\[\s\S]*?> build\/_headers/,
        "cat > build/_headers <<'EOF'\n/docs/build-info.json\n  Cache-Control: no-store\nEOF"
      ),
    breaks: 'one cache rule claims the sentinel, and it is no-store',
  },
  {
    what: 'the generated file written somewhere the deploy does not read',
    yml: () => mutate('> build/_headers', '> build/cache-headers'),
    breaks: 'one cache rule claims the sentinel, and it is no-store',
  },
  {
    what: 'the base path changed on one side only',
    yml: () => mutate('echo "base_url=docs"', 'echo "base_url=documentation"'),
    breaks: 'one cache rule claims the sentinel, and it is no-store',
  },
];

for (const { what, yml, breaks } of MUTATIONS) {
  test(`fails when ${what}`, () => {
    assert.throws(() => CHECKS[breaks](yml()), assert.AssertionError, `"${breaks}" passed a broken workflow`);
  });
}

test('every check is driven by at least one mutation', () => {
  // Without this, a check added later is exercised only by the workflow that is
  // already correct -- which is the state every one of these was written to
  // leave behind.
  const covered = new Set(MUTATIONS.map((m) => m.breaks));
  assert.deepEqual([...Object.keys(CHECKS)].filter((n) => !covered.has(n)), []);
});
