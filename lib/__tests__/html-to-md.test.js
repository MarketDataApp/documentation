'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cleanHtml } = require('../html-to-md');

// cleanHtml covers the routes that have NO Markdown source, so every case here
// is built HTML rather than MDX. The MDX converter's tests are in
// mdx-to-md.test.js and neither file's subject is on the other's path.

const page = (body, { title = 'Tags | Market Data Docs (staging)' } = {}) =>
  `<!DOCTYPE html><html><head><title>${title}</title></head><body>` +
  `<nav class="navbar">NAVBAR</nav>` +
  `<div id="__docusaurus"><div class="main-wrapper">${body}</div></div>` +
  `<footer>FOOTER</footer></body></html>`;

// --- The content root ---

test('converts the content root and leaves the navbar and footer out', () => {
  const md = cleanHtml(page('<main><h1>Tags</h1><p>Body.</p></main>'));
  assert.equal(md, '# Tags\n\nBody.\n');
});

test('keeps content that sits outside <main> but inside .main-wrapper', () => {
  // The docs root: src/pages/index.tsx renders <HomepageHeader /> as a sibling
  // of <main>, so selecting <main> would drop the page's own <h1>.
  const md = cleanHtml(
    page('<header class="hero"><h1>Market Data Docs</h1></header><main><p>Cards.</p></main>')
  );
  assert.equal(md, '# Market Data Docs\n\nCards.\n');
});

test('falls back to <main> when there is no .main-wrapper', () => {
  const html = '<html><head><title>T</title></head><body><main><h1>Only main</h1></main></body></html>';
  assert.equal(cleanHtml(html), '# Only main\n');
});

test('returns null when the page has neither, so the caller can fail', () => {
  assert.equal(cleanHtml('<html><body><p>Nothing.</p></body></html>'), null);
});

// --- Chrome ---

test('strips script, style, svg and iframe', () => {
  const md = cleanHtml(
    page('<main><h1>T</h1><script>x=1</script><style>a{}</style><svg><path/></svg><iframe></iframe><p>Kept.</p></main>')
  );
  assert.equal(md, '# T\n\nKept.\n');
});

test('strips the form, which is what /docs/search/ is made of', () => {
  const md = cleanHtml(page('<div class="container"><h1>Search the documentation</h1><form><input name="q"></form></div>'));
  assert.equal(md, '# Search the documentation\n');
});

test('strips the zero-width hash-link anchor Docusaurus hangs off each heading', () => {
  const md = cleanHtml(
    page('<main><h1>Tags</h1><h2 id="A">A<a href="#A" class="hash-link" aria-label="Direct link to A">​</a></h2></main>')
  );
  assert.equal(md, '# Tags\n\n## A\n');
});

test('strips doc chrome: sidebar, TOC, breadcrumbs and pagination', () => {
  const md = cleanHtml(
    page(
      '<main><div class="theme-doc-sidebar-container">SIDEBAR</div>' +
        '<nav class="theme-doc-breadcrumbs">CRUMBS</nav>' +
        '<div class="theme-doc-toc-desktop">TOC</div>' +
        '<h1>T</h1><p>Body.</p>' +
        '<nav class="pagination-nav">PAGER</nav></main>'
    )
  );
  assert.equal(md, '# T\n\nBody.\n');
});

// --- Links ---

test('absolutises root-relative links against the origin', () => {
  const md = cleanHtml(page('<main><h1>T</h1><p><a href="/docs/api/">API</a></p></main>'), {
    origin: 'https://www.marketdata.app',
  });
  assert.equal(md, '# T\n\n[API](https://www.marketdata.app/docs/api/)\n');
});

test('leaves absolute, protocol-relative and anchor links alone', () => {
  const md = cleanHtml(
    page('<main><h1>T</h1><p><a href="https://x.test/a">A</a> <a href="//y.test/b">B</a> <a href="#c">C</a></p></main>'),
    { origin: 'https://www.marketdata.app' }
  );
  assert.equal(md, '# T\n\n[A](https://x.test/a) [B](//y.test/b) [C](#c)\n');
});

// --- Title ---

test('takes the site name off <title> when the body has no h1', () => {
  const md = cleanHtml(page('<main><p>Body.</p></main>'), {
    siteTitle: 'Market Data Docs (staging)',
  });
  assert.equal(md, '# Tags\n\nBody.\n');
});

test('does not prepend a title when the body already opens with an h1', () => {
  const md = cleanHtml(page('<main><h1>Real Heading</h1><p>Body.</p></main>'), {
    siteTitle: 'Market Data Docs (staging)',
  });
  assert.equal(md, '# Real Heading\n\nBody.\n');
});

test('keeps the whole <title> when it does not end in the site name', () => {
  const md = cleanHtml(page('<main><p>Body.</p></main>', { title: 'Standalone' }), {
    siteTitle: 'Market Data Docs (staging)',
  });
  assert.equal(md, '# Standalone\n\nBody.\n');
});

// --- Images ---

test('renders an image as its alt text and never its src', () => {
  const md = cleanHtml(
    page('<main><h1>T</h1><p><img alt="Market Data API" src="data:image/png;base64,AAAA"></p></main>')
  );
  assert.equal(md, '# T\n\n(image: Market Data API)\n');
});

test('drops an image with no alt text rather than emitting an empty link', () => {
  const md = cleanHtml(page('<main><h1>T</h1><p><img src="/docs/a.png">Text.</p></main>'));
  assert.equal(md, '# T\n\nText.\n');
});

// --- Tables ---

test('renders a table as GFM rather than a run of cell text', () => {
  const md = cleanHtml(
    page('<main><h1>T</h1><table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table></main>')
  );
  assert.equal(md, '# T\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n');
});

test('expands colspan so every row lands on the same grid', () => {
  const md = cleanHtml(
    page('<main><h1>T</h1><table><tr><th colspan="2">Span</th></tr><tr><td>1</td><td>2</td></tr></table></main>')
  );
  assert.equal(md, '# T\n\n| Span |  |\n| --- | --- |\n| 1 | 2 |\n');
});

test('escapes a pipe inside a cell', () => {
  const md = cleanHtml(page('<main><h1>T</h1><table><tr><td>a|b</td></tr></table></main>'));
  assert.equal(md, '# T\n\n| a\\|b |\n| --- |\n');
});

// --- Shape ---

test('ends with exactly one newline and no trailing blank lines', () => {
  const md = cleanHtml(page('<main><h1>T</h1><p>Body.</p><div></div><div></div></main>'));
  assert.equal(md.endsWith('Body.\n'), true);
  assert.equal(/\n\n$/.test(md), false);
});

test('collapses the gaps left where stripped nodes were', () => {
  const md = cleanHtml(
    page('<main><h1>T</h1><script>a</script><script>b</script><script>c</script><p>Body.</p></main>')
  );
  assert.equal(md, '# T\n\nBody.\n');
});

// --- normalise(): four repairs Turndown cannot make for itself ---

test('moves a link that wraps a heading inside that heading', () => {
  // The tag pages: <a href><h2>News</h2></a>, which Turndown emits as a
  // literal "[", a blank line, "## News", a blank line, "](url)".
  const md = cleanHtml(
    page('<main><h1>T</h1><article><a href="/docs/api/stocks/news/"><h2>News</h2></a><p>Blurb.</p></article></main>'),
    { origin: 'https://www.marketdata.app' }
  );
  assert.equal(md, '# T\n\n## [News](https://www.marketdata.app/docs/api/stocks/news/)\n\nBlurb.\n');
});

test('keeps the rest of a wrapping link\'s content beside the heading', () => {
  // The docs root's feature cards, which also carry an image and a blurb.
  const md = cleanHtml(
    page(
      '<main><h1>T</h1><a href="/docs/api/"><img alt="Market Data API" src="/a.png">' +
        '<h3>Market Data API</h3><p>A complete reference.</p></a></main>'
    ),
    { origin: 'https://www.marketdata.app' }
  );
  assert.equal(
    md,
    '# T\n\n(image: Market Data API)\n\n### [Market Data API](https://www.marketdata.app/docs/api/)\n\nA complete reference.\n'
  );
});

test('drops a link left empty by a stripped child', () => {
  // /docs/search/ links the Algolia logo, which is an <svg>.
  const md = cleanHtml(page('<div class="container"><h1>Search</h1><a href="https://www.algolia.com/"><svg></svg></a></div>'));
  assert.equal(md, '# Search\n');
});

test('keeps a link whose only child is an image with alt text', () => {
  const md = cleanHtml(page('<main><h1>T</h1><a href="/docs/api/"><img alt="API" src="/a.png"></a></main>'), {
    origin: 'https://www.marketdata.app',
  });
  assert.equal(md, '# T\n\n[(image: API)](https://www.marketdata.app/docs/api/)\n');
});

test('parenthesises a tag count so it does not run into the tag name', () => {
  const md = cleanHtml(
    page('<main><h1>Tags</h1><ul><li><a class="tag_a tagWithCount_b" href="/docs/api/tags/api-beta/">API: Beta<span>1</span></a></li></ul></main>'),
    { origin: 'https://www.marketdata.app' }
  );
  assert.match(md, /\[API: Beta \(1\)\]\(https:\/\/www\.marketdata\.app\/docs\/api\/tags\/api-beta\/\)/);
  assert.doesNotMatch(md, /API: Beta1/);
});

test('drops the duplicate of a themed image pair', () => {
  // Docusaurus renders one <img> for light and one for dark, same alt text.
  const md = cleanHtml(
    page('<main><h1>T</h1><p><img alt="Market Data API" src="/light.png"><img alt="Market Data API" src="/dark.png"></p></main>')
  );
  assert.equal(md, '# T\n\n(image: Market Data API)\n');
});

test('keeps two adjacent images when their alt text differs', () => {
  const md = cleanHtml(page('<main><h1>T</h1><p><img alt="One" src="/a.png"><img alt="Two" src="/b.png"></p></main>'));
  assert.equal(md, '# T\n\n(image: One)(image: Two)\n');
});
