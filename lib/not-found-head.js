'use strict';

/**
 * Removes the tags that name a URL for the 404 page, and marks it `noindex`.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS WRONG WITH THE 404's HEAD
 * ---------------------------------------------------------------------------
 *
 * Docusaurus renders `@theme/SiteMetadata` on every route, and it emits the
 * page's own URL four times. On `404.html` all four read:
 *
 *     <link rel="canonical"  href="https://www.marketdata.app/docs/404.html/">
 *     <meta property="og:url" content="https://www.marketdata.app/docs/404.html/">
 *     <link rel="alternate" hreflang="en"        href="…/docs/404.html/">
 *     <link rel="alternate" hreflang="x-default" href="…/docs/404.html/">
 *
 * `applyTrailingSlash` appends the slash, and `/docs/404.html/` is not a route:
 * it 404s. So the page that exists to say "there is nothing here" declares a
 * preferred URL, and the URL it prefers is itself nothing.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS NOT HARMLESS, WHICH IS WHAT IT WAS FILED AS
 * ---------------------------------------------------------------------------
 *
 * docs/SEO-GAPS.md carried this as measured-not-gated on the argument that a
 * crawler drops a `404` response before it reads `rel=canonical`, so nothing
 * ever sees the tag. That argument depends on the page only ever answering
 * 404, and it does not. Measured against production on 2026-09-03:
 *
 *     /docs/404.html   308 -> /docs/404      Pages strips the .html
 *     /docs/404        200                   the 404 page, as a success
 *     /docs/404/       308 -> /docs/404
 *
 * `/docs/404` is a soft 404: a real page, served 200, crawlable, indexable,
 * carrying a canonical that points at a URL which 404s. That is the exact
 * condition the gap note named as the trigger to fix it.
 *
 * Two things follow, and this module does both:
 *
 *   1. The page names no URL of its own. A page that only ever means "not
 *      found" has no preferred URL to declare.
 *   2. The page says `noindex`. The production build sets none — `noIndex` is
 *      false there — so 200 plus no directive is an invitation. Staging
 *      already emits `noindex, nofollow` on every page including this one, so
 *      the tag is only ever ADDED where it is missing; the two arms end up
 *      saying the same thing by different routes.
 *
 * ---------------------------------------------------------------------------
 * WHY A CUT AND NOT A RE-SERIALISATION
 * ---------------------------------------------------------------------------
 *
 * `@mixmark-io/domino` is already a dependency and parses this file elsewhere,
 * so the obvious shape is parse -> remove nodes -> serialise. It is rejected
 * because serialising is a rewrite of the WHOLE document: every inline script,
 * every attribute's quoting, every entity in the body passes back out through
 * a serialiser to change one tag. The blast radius of a bug there is the page
 * itself, and the page is the only artefact this runs on.
 *
 * Cutting an exact byte range out of the original string leaves every other
 * byte untouched by construction, which is a much smaller thing to be wrong
 * about.
 *
 * The reason to reach for a DOM in the first place still has to be answered,
 * and it is the one recorded in scripts/lint-seo.js: the sibling check in
 * MarketDataApp/website read every page as having no robots tag, because its
 * minifier writes attributes UNQUOTED and REORDERED and the matcher required
 * quotes. So the scanner below is quoting-agnostic and order-agnostic. It
 * finds each `<meta>`/`<link>` by walking to its closing `>` with quote
 * tracking, and reads attributes in all four spellings — `a="b"`, `a='b'`,
 * `a=b`, and bare `a`. The self-tests feed it a minified, unquoted, reordered
 * fixture for the same reason lint-seo's do.
 */

/** The `<head …>` open tag, and the close tag that ends the region. */
const HEAD_OPEN = /<head(?=[\s>])[^>]*>/i;
const HEAD_CLOSE = '</head>';

/**
 * `a="b" c='d' e=f g` -> {a: 'b', c: 'd', e: 'f', g: ''}.
 *
 * Names are lower-cased; values are not, because `href` is one. An unquoted
 * value stops at the first `=`, which is wrong for `content=width=device-width`
 * and irrelevant here: every attribute this module DECIDES on (`rel`,
 * `property`, `name`, `hreflang`) is a single token in every spelling.
 */
function attributesOf(text) {
  const attr = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+)))?/g;
  const out = {};
  let m;
  while ((m = attr.exec(text)) !== null) {
    out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return out;
}

/** Index of the `>` that closes a tag opened at `from`, skipping quoted text. */
function closingBracket(html, from) {
  let quote = null;
  for (let i = from; i < html.length; i++) {
    const c = html[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '>') {
      return i;
    }
  }
  return -1;
}

/** Every `<meta>` and `<link>` in `html`, as {start, end, name, attrs}. */
function voidTags(html) {
  const open = /<(meta|link)(?=[\s/>])/gi;
  const out = [];
  let m;
  while ((m = open.exec(html)) !== null) {
    const close = closingBracket(html, m.index + m[0].length);
    if (close === -1) break;
    out.push({
      start: m.index,
      end: close + 1,
      name: m[1].toLowerCase(),
      attrs: attributesOf(html.slice(m.index + m[0].length, close)),
    });
    open.lastIndex = close + 1;
  }
  return out;
}

/**
 * True when a tag states this page's own address.
 *
 * `rel=alternate` is matched only WITH an `hreflang`. A feed link is also a
 * `rel=alternate` and says nothing about which URL this page is; the hreflang
 * ones do, and on the 404 both of them name `/docs/404.html/`.
 */
function namesThisPage({ name, attrs }) {
  if (name === 'link' && attrs.rel?.toLowerCase() === 'canonical') return true;
  if (name === 'link' && attrs.rel?.toLowerCase() === 'alternate' && 'hreflang' in attrs) return true;
  if (name === 'meta' && attrs.property?.toLowerCase() === 'og:url') return true;
  return false;
}

/**
 * A removed tag, named the way the head named it, for the build log.
 *
 * The URL is left out: all four carry the same one, and the log line is read to
 * answer "did it find them", not "what did they say". `lint:seo` L1 prints the
 * URL, and it only ever prints it when one survived.
 */
function describe({ name, attrs }) {
  if (attrs.hreflang) return `rel=alternate hreflang=${attrs.hreflang}`;
  return name === 'meta' ? `${attrs.property}` : `rel=${attrs.rel}`;
}

const ROBOTS = '<meta name="robots" content="noindex">';

/**
 * Rewrite the 404 page's head.
 *
 * Returns `{html, removed, addedRobots}`. Idempotent: a second pass finds
 * nothing to remove and a robots tag already present, and returns the input
 * unchanged.
 *
 * Throws when there is no head to operate on, rather than returning the input.
 * Silently doing nothing is the failure this whole change exists to end, and
 * `lint:seo` L1 would then be the only thing that noticed — one build step
 * later, in a different process.
 */
function fixNotFoundHead(html) {
  const open = HEAD_OPEN.exec(html);
  const close = html.toLowerCase().indexOf(HEAD_CLOSE);
  if (!open || close === -1 || close < open.index) {
    throw new Error('no <head>…</head> to rewrite');
  }

  const from = open.index + open[0].length;
  const head = html.slice(from, close);

  const tags = voidTags(head);
  const doomed = tags.filter(namesThisPage);
  const removed = doomed.map(describe);

  // Back to front, so an earlier cut cannot move a later tag's offsets.
  let rewritten = head;
  for (const tag of [...doomed].reverse()) {
    rewritten = rewritten.slice(0, tag.start) + rewritten.slice(tag.end);
  }

  // Appended, not prepended. `<meta charset>` has to appear in the first 1024
  // bytes of the document and Docusaurus writes it first; nothing should be
  // inserted in front of it to save four characters of head.
  const hasRobots = tags.some((t) => t.name === 'meta' && t.attrs.name?.toLowerCase() === 'robots');
  if (!hasRobots) rewritten += ROBOTS;

  return {
    html: html.slice(0, from) + rewritten + html.slice(close),
    removed,
    addedRobots: !hasRobots,
  };
}

// `voidTags` is exported so `lib/noindex-head.js` can read a head with the SAME
// parser rather than a second regular expression of its own. Two parsers that
// must agree about attribute quoting and ordering are two parsers that will
// eventually disagree, and the failure is silent: a matcher that misses a tag
// reports a clean page. `internal-head` shipped with exactly that weakness for
// one commit.
module.exports = { fixNotFoundHead, voidTags };
