'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cleanMdx } = require('../mdx-to-md');

// --- Frontmatter ---

test('extracts title from frontmatter and prepends as H1', () => {
  const input = '---\ntitle: Test\nsidebar_position: 1\n---\n\nBody.\n';
  assert.equal(cleanMdx(input), '# Test\n\nBody.\n');
});

test('strips frontmatter without a title field', () => {
  const input = '---\nsidebar_position: 1\nslug: /foo\n---\n\n# Hello\n';
  assert.equal(cleanMdx(input), '# Hello\n');
});

test('handles quoted frontmatter title', () => {
  const input = '---\ntitle: "Quoted Title"\n---\n\nBody.\n';
  assert.equal(cleanMdx(input), '# Quoted Title\n\nBody.\n');
});

test('no frontmatter passes through unchanged structure', () => {
  const input = '# Hello\n\nBody.\n';
  assert.equal(cleanMdx(input), '# Hello\n\nBody.\n');
});

// --- Imports ---

test('strips theme imports outside code fences', () => {
  const input = 'import Tabs from "@theme/Tabs";\nimport TabItem from "@theme/TabItem";\n\n# Hello\n';
  assert.equal(cleanMdx(input), '# Hello\n');
});

test('preserves imports inside code fences (the long-standing bug fix)', () => {
  const input = [
    '# Example',
    '',
    '```typescript',
    'import { MarketDataClient } from "marketdata-sdk-js";',
    'const c = new MarketDataClient();',
    '```',
    '',
  ].join('\n');
  const result = cleanMdx(input);
  assert.match(result, /import \{ MarketDataClient \} from "marketdata-sdk-js"/);
});

test('strips prose-level imports but keeps fenced ones in the same doc', () => {
  const input = [
    'import Tabs from "@theme/Tabs";',
    '',
    '# Doc',
    '',
    '```js',
    'import foo from "bar";',
    '```',
    '',
  ].join('\n');
  const result = cleanMdx(input);
  assert.ok(!result.includes('@theme/Tabs'), 'theme import should be stripped');
  assert.match(result, /import foo from "bar"/);
});

// --- Tabs / TabItem ---

test('converts TabItem to ### heading and strips Tabs wrapper', () => {
  const input = '<Tabs>\n<TabItem value="js" label="JavaScript">\n\ncode\n\n</TabItem>\n</Tabs>\n';
  const result = cleanMdx(input);
  assert.match(result, /### JavaScript/);
  assert.ok(!result.includes('<Tabs>'));
  assert.ok(!result.includes('<TabItem'));
  assert.ok(!result.includes('</TabItem>'));
  assert.ok(!result.includes('</Tabs>'));
});

test('handles TabItem with label before value', () => {
  const input = '<TabItem label="PHP" value="php">\nbody\n</TabItem>\n';
  const result = cleanMdx(input);
  assert.match(result, /### PHP/);
});

// --- Admonitions ---

test('converts :::tip to GitHub Alert', () => {
  const input = ':::tip\nUse the SDK.\n:::\n';
  const result = cleanMdx(input);
  assert.match(result, /> \[!TIP\]/);
  assert.match(result, /> Use the SDK\./);
});

test('preserves admonition custom title as bold', () => {
  const input = ':::info Premium Parameter\nThis is paid.\n:::\n';
  const result = cleanMdx(input);
  assert.match(result, /> \[!NOTE\]/);
  assert.match(result, /> \*\*Premium Parameter\*\*/);
  assert.match(result, /> This is paid\./);
});

test('admonition mapping covers all Docusaurus levels', () => {
  const cases = [
    [':::note\nx\n:::', 'NOTE'],
    [':::tip\nx\n:::', 'TIP'],
    [':::info\nx\n:::', 'NOTE'],
    [':::warning\nx\n:::', 'WARNING'],
    [':::caution\nx\n:::', 'CAUTION'],
    [':::danger\nx\n:::', 'CAUTION'],
  ];
  for (const [input, expected] of cases) {
    const result = cleanMdx(input);
    assert.match(result, new RegExp(`\\[!${expected}\\]`), `${input} should map to ${expected}`);
  }
});

test('admonition containing a code fence preserves the fence inside the blockquote', () => {
  const input = [
    ':::info',
    'Install from GitHub:',
    '',
    '```bash',
    'pnpm add github:MarketDataApp/sdk-js',
    '```',
    ':::',
    '',
  ].join('\n');
  const result = cleanMdx(input);
  assert.match(result, /> \[!NOTE\]/);
  assert.match(result, /> ```bash/);
  assert.match(result, /> pnpm add github:MarketDataApp\/sdk-js/);
  assert.match(result, /> ```$/m);
});

test('multi-line admonition body each line gets blockquote prefix', () => {
  const input = ':::warning\nline one\nline two\n\nline four\n:::\n';
  const result = cleanMdx(input);
  // Every body line begins with `> ` (or `>` for blank)
  const lines = result.trim().split('\n');
  // Skip the [!WARNING] line; rest should be blockquoted
  for (const line of lines.slice(1)) {
    assert.match(line, /^>( |$)/);
  }
});

// --- Link rewriting ---

test('rewrites /api/... to absolute URL with default baseUrl', () => {
  const input = 'See [the API](/api/stocks/quotes) for details.\n';
  const result = cleanMdx(input);
  assert.match(result, /\[the API\]\(https:\/\/www\.marketdata\.app\/docs\/api\/stocks\/quotes\)/);
});

test('rewrites same-SDK link to relative .md when sdk + sourcePath given', () => {
  const result = cleanMdx('See [Client](/sdk/js/client) docs.\n', {
    sourcePath: 'sdk/js/stocks/quotes.mdx',
    sdk: 'js',
  });
  assert.match(result, /\[Client\]\(\.\.\/client\.md\)/);
});

test('rewrites same-SDK link from root file to ./neighbor.md', () => {
  const result = cleanMdx('See [Auth](/sdk/js/authentication).\n', {
    sourcePath: 'sdk/js/client.mdx',
    sdk: 'js',
  });
  assert.match(result, /\[Auth\]\(\.\/authentication\.md\)/);
});

test('rewrites cross-SDK link to absolute URL', () => {
  const result = cleanMdx('Also see [Python](/sdk/py/client).\n', {
    sourcePath: 'sdk/js/client.mdx',
    sdk: 'js',
  });
  assert.match(result, /\[Python\]\(https:\/\/www\.marketdata\.app\/docs\/sdk\/py\/client\)/);
});

test('preserves #anchor when rewriting same-SDK link', () => {
  const result = cleanMdx('See [Result Pattern](/sdk/js/client#ResultPattern).\n', {
    sourcePath: 'sdk/js/stocks/quotes.mdx',
    sdk: 'js',
  });
  assert.match(result, /\[Result Pattern\]\(\.\.\/client\.md#ResultPattern\)/);
});

test('preserves external URLs untouched', () => {
  const input = 'See [GitHub](https://github.com/MarketDataApp).\n';
  assert.match(cleanMdx(input), /\[GitHub\]\(https:\/\/github\.com\/MarketDataApp\)/);
});

test('rewrites links whose label contains a code span with brackets', () => {
  // Real-world case from sdk/js/stocks/quotes.mdx
  const input = 'Returns [`MarketDataResult<StockQuote[] | Blob>`](/sdk/js/client#MarketDataResult).\n';
  const result = cleanMdx(input, {
    sourcePath: 'sdk/js/stocks/quotes.mdx',
    sdk: 'js',
  });
  assert.match(result, /\]\(\.\.\/client\.md#MarketDataResult\)/);
});

test('rewrites links whose label contains balanced [...] brackets', () => {
  const input = 'See [name [v2] field](/sdk/js/client) details.\n';
  const result = cleanMdx(input, {
    sourcePath: 'sdk/js/index.mdx',
    sdk: 'js',
  });
  assert.match(result, /\]\(\.\/client\.md\)/);
});

test('preserves bare #anchor links', () => {
  const input = 'Jump to [the section](#section).\n';
  assert.match(cleanMdx(input), /\[the section\]\(#section\)/);
});

test('rewrites image paths the same way as links', () => {
  const input = '![Logo](/img/logo.svg)\n';
  const result = cleanMdx(input);
  assert.match(result, /!\[Logo\]\(https:\/\/www\.marketdata\.app\/docs\/img\/logo\.svg\)/);
});

test('rewrites /sdk/{sdk}/ (root with trailing slash) to relative index.md', () => {
  const result = cleanMdx('Back to [JS SDK](/sdk/js/).\n', {
    sourcePath: 'sdk/js/stocks/quotes.mdx',
    sdk: 'js',
  });
  assert.match(result, /\[JS SDK\]\(\.\.\/index\.md\)/);
});

// --- Source-aware link resolution (linkTargets) ---

test('linkTargets: directory link resolves to README.md', () => {
  const linkTargets = {
    'client': 'client.md',
    'stocks': 'stocks/README.md',
    'stocks/quotes': 'stocks/quotes.md',
    '': 'README.md',
  };
  const result = cleanMdx('Browse [Stocks](/sdk/js/stocks) for details.\n', {
    sourcePath: 'sdk/js/client.mdx',
    sdk: 'js',
    linkTargets,
  });
  assert.match(result, /\[Stocks\]\(\.\/stocks\/README\.md\)/);
});

test('linkTargets: sibling file gets ./neighbor.md (collapsed prefix)', () => {
  const linkTargets = {
    'stocks/quotes': 'stocks/quotes.md',
    'stocks/candles': 'stocks/candles.md',
  };
  const result = cleanMdx('See [Candles](/sdk/js/stocks/candles).\n', {
    sourcePath: 'sdk/js/stocks/quotes.mdx',
    sdk: 'js',
    linkTargets,
  });
  assert.match(result, /\[Candles\]\(\.\/candles\.md\)/);
});

test('linkTargets: file at root from subdir gets ../client.md', () => {
  const linkTargets = { 'client': 'client.md' };
  const result = cleanMdx('See [Client](/sdk/js/client).\n', {
    sourcePath: 'sdk/js/stocks/quotes.mdx',
    sdk: 'js',
    linkTargets,
  });
  assert.match(result, /\[Client\]\(\.\.\/client\.md\)/);
});

test('linkTargets: directory link from inside that directory uses ./README.md', () => {
  const linkTargets = {
    'stocks': 'stocks/README.md',
    'stocks/quotes': 'stocks/quotes.md',
  };
  const result = cleanMdx('Back to [Stocks home](/sdk/js/stocks).\n', {
    sourcePath: 'sdk/js/stocks/quotes.mdx',
    sdk: 'js',
    linkTargets,
  });
  assert.match(result, /\[Stocks home\]\(\.\/README\.md\)/);
});

test('linkTargets: root /sdk/{sdk}/ from a subdirectory file resolves to ../README.md', () => {
  const linkTargets = { '': 'README.md', 'client': 'client.md' };
  const result = cleanMdx('Home: [JS SDK](/sdk/js/).\n', {
    sourcePath: 'sdk/js/stocks/quotes.mdx',
    sdk: 'js',
    linkTargets,
  });
  assert.match(result, /\[JS SDK\]\(\.\.\/README\.md\)/);
});

// --- Empty components ---

test('strips <DocCardList /> self-closing', () => {
  const input = '# Sections\n\n<DocCardList />\n';
  const result = cleanMdx(input);
  assert.ok(!result.includes('DocCardList'));
});

test('strips <DocCardList>...</DocCardList> paired', () => {
  const input = '# Sections\n\n<DocCardList>fallback</DocCardList>\n';
  const result = cleanMdx(input);
  assert.ok(!result.includes('DocCardList'));
});

test('strips JSX style={{...}} attribute from tags', () => {
  const input = '<img src="/x.svg" style={{width: "256px"}} alt="x" />\n';
  const result = cleanMdx(input);
  assert.ok(!result.includes('style='));
});

// --- MDX comments ---

test('strips {/* MDX comments */}', () => {
  const input = 'Before {/* this is hidden */} after.\n';
  const result = cleanMdx(input);
  assert.ok(!result.includes('hidden'));
  assert.match(result, /Before\s+after\./);
});

// --- Cleanup / shape ---

test('collapses 3+ blank lines to 2', () => {
  const input = '# A\n\n\n\n\n# B\n';
  assert.equal(cleanMdx(input), '# A\n\n# B\n');
});

test('ensures trailing newline', () => {
  const input = '# Trailing';
  assert.equal(cleanMdx(input).at(-1), '\n');
});

// --- Idempotency ---

test('cleanMdx is idempotent', () => {
  const input = [
    '---',
    'title: Idempotent',
    'sidebar_position: 1',
    '---',
    '',
    'import Tabs from "@theme/Tabs";',
    '',
    '# Idempotent',
    '',
    ':::tip Pro Tip',
    'Use [the API](/api/stocks) wisely.',
    ':::',
    '',
    '<Tabs>',
    '<TabItem value="js" label="JavaScript">',
    '',
    '```typescript',
    'import { MarketDataClient } from "marketdata-sdk-js";',
    '```',
    '',
    '</TabItem>',
    '</Tabs>',
    '',
  ].join('\n');
  const once = cleanMdx(input);
  const twice = cleanMdx(once);
  assert.equal(twice, once, 'second pass should produce identical output');
});

// --- Composite real-world-ish doc ---

test('processes a representative SDK page end-to-end', () => {
  const input = [
    '---',
    'title: Quotes',
    'sidebar_position: 2',
    '---',
    '',
    'import Tabs from "@theme/Tabs";',
    'import TabItem from "@theme/TabItem";',
    '',
    'Fetch [stock quotes](/api/stocks/quotes). See also [Client](/sdk/js/client#MarketDataClient).',
    '',
    ':::tip',
    'Use bulk endpoints for >1 symbol.',
    ':::',
    '',
    '<Tabs>',
    '<TabItem value="single" label="Single Symbol">',
    '',
    '```typescript',
    'import { MarketDataClient } from "marketdata-sdk-js";',
    'const r = await client.stocks.quotes("AAPL");',
    '```',
    '',
    '</TabItem>',
    '</Tabs>',
    '',
  ].join('\n');
  const result = cleanMdx(input, {
    sourcePath: 'sdk/js/stocks/quotes.mdx',
    sdk: 'js',
  });
  assert.match(result, /^# Quotes\n\n/);
  assert.match(result, /\[stock quotes\]\(https:\/\/www\.marketdata\.app\/docs\/api\/stocks\/quotes\)/);
  assert.match(result, /\[Client\]\(\.\.\/client\.md#MarketDataClient\)/);
  assert.match(result, /> \[!TIP\]\n> Use bulk endpoints/);
  assert.match(result, /### Single Symbol/);
  assert.match(result, /import \{ MarketDataClient \} from "marketdata-sdk-js"/);
  assert.ok(!result.includes('@theme/Tabs'));
  assert.ok(!result.includes('sidebar_position'));
});
