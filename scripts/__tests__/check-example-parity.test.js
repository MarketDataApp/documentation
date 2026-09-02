'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SCRIPT = path.resolve(__dirname, '..', 'check-example-parity.js');
const { fixturesOf, offFixtureTickers, tabsOf, requestSection } = require(SCRIPT);

/** Run the checker over one temp page. Returns { code, out }. */
function run(content, args = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'parity-'));
  const file = path.join(dir, 'page.mdx');
  fs.writeFileSync(file, content, 'utf8');
  try {
    const out = execFileSync('node', [SCRIPT, file, ...args], { encoding: 'utf8' });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status, out: `${e.stdout || ''}${e.stderr || ''}` };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** A page with one tab per language, each holding the given body. */
function page(bodies, heading = '## Request Example') {
  const tabs = Object.entries(bodies)
    .map(([lang, body]) => `<TabItem value="${lang}" label="${lang}">\n\n${body}\n\n</TabItem>`)
    .join('\n');
  return `---\ntitle: Test\n---\n\n${heading}\n\n<Tabs>\n${tabs}\n</Tabs>\n\n## Response Example\n\nnothing\n`;
}

test('passes when every tab makes the same request', () => {
  const r = run(page({
    HTTP: '**GET** https://api.marketdata.app/v1/stocks/candles/D/AAPL/?from=2024-01-01&to=2024-01-31',
    Python: '```python\nclient.stocks.candles("AAPL", from_date="2024-01-01", to_date="2024-01-31")\n```',
  }));
  assert.strictEqual(r.code, 0);
  assert.match(r.out, /same request in every language tab/);
});

test('fails when one tab uses a different date range', () => {
  const r = run(page({
    HTTP: '**GET** https://api.marketdata.app/v1/stocks/candles/D/AAPL/?from=2024-01-01&to=2024-01-31',
    Python: '```python\nclient.stocks.candles("AAPL", from_date="2020-01-01", to_date="2020-12-31")\n```',
  }));
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /different requests/);
  assert.match(r.out, /2020-01-01/);
});

test('fails when one tab drops a parameter its siblings pass', () => {
  const r = run(page({
    HTTP: '**GET** https://api.marketdata.app/v1/stocks/candles/D/AAPL/?from=2024-01-01&to=2024-01-31',
    Java: '```java\nclient.stocks().candles("AAPL");\n```',
  }));
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /different requests/);
});

test('fails when one tab uses a different ticker', () => {
  const r = run(page({
    HTTP: '**GET** https://api.marketdata.app/v1/stocks/quotes/AAPL/',
    Go: '```go\napi.StockQuote().Symbol("MSFT").Get()\n```',
  }));
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /MSFT/);
});

test('accepts each language\'s own spelling of the same date', () => {
  const r = run(page({
    HTTP: '**GET** https://api.marketdata.app/v1/markets/status/?from=2024-01-01&to=2024-01-31',
    Java: '```java\n.from(LocalDate.of(2024, 1, 1)).to(LocalDate.of(2024, 1, 31))\n```',
    'C#': '```csharp\nfrom: new DateOnly(2024, 1, 1), to: new DateOnly(2024, 1, 31)\n```',
  }));
  assert.strictEqual(r.code, 0);
});

test('ignores a result echoed in a comment', () => {
  const r = run(page({
    HTTP: '**GET** https://api.marketdata.app/v1/options/lookup/AAPL%2012/17/2027%20250%20Call/',
    JavaScript: '```js\nconst d = await client.options.lookup("AAPL 12/17/2027 250 Call");\nconsole.log(d.optionSymbol);  // "AAPL271217C00250000"\n```',
  }));
  assert.strictEqual(r.code, 0);
});

test('does not read an enum member as a ticker', () => {
  const r = run(page({
    HTTP: '**GET** https://api.marketdata.app/v1/funds/candles/D/VFINX/',
    Java: '```java\nclient.funds().candles("VFINX", Resolution.DAILY);\n```',
    PHP: '```php\n$client->funds->candles("VFINX", Resolution::DAILY);\n```',
  }));
  assert.strictEqual(r.code, 0);
});

test('nested tabs are compared as separate groups', () => {
  // "Single Symbol" and "Multiple Symbols" demonstrate different requests on
  // purpose, so they must not be compared against each other.
  const inner = (body) => `<TabItem value="HTTP" label="HTTP">\n\n${body}\n\n</TabItem>\n<TabItem value="Python" label="Python">\n\n${body}\n\n</TabItem>`;
  const src = `---\ntitle: Test\n---\n\n## Request Examples\n\n<Tabs>\n<TabItem value="Single" label="Single Symbol">\n\n<Tabs>\n${inner('`AAPL`')}\n</Tabs>\n\n</TabItem>\n<TabItem value="Multiple" label="Multiple Symbols">\n\n<Tabs>\n${inner('`AAPL,META,MSFT`')}\n</Tabs>\n\n</TabItem>\n</Tabs>\n\n## Response Example\n\nnothing\n`;
  const r = run(src);
  assert.strictEqual(r.code, 0);
  assert.match(r.out, /2 tab group/);
});

test('a single-tab page is not a parity question', () => {
  const r = run(page({ HTTP: '**GET** https://api.marketdata.app/v1/stocks/quotes/AAPL/' }));
  assert.strictEqual(r.code, 0);
  assert.match(r.out, /0 tab group/);
});

test('reports an off-fixture ticker without failing', () => {
  const r = run(page({
    HTTP: '**GET** https://api.marketdata.app/v1/stocks/quotes/TSLA/',
    Python: '```python\nclient.stocks.quotes("TSLA")\n```',
  }));
  assert.strictEqual(r.code, 0);
  assert.match(r.out, /outside the canonical fixture set/);
  assert.match(r.out, /TSLA/);
});

test('only the Request Example section is compared', () => {
  const src = page({
    HTTP: '**GET** https://api.marketdata.app/v1/stocks/quotes/AAPL/',
    Python: '```python\nclient.stocks.quotes("AAPL")\n```',
  }) + '\n## Response Attributes\n\n<Tabs>\n<TabItem value="HTTP" label="HTTP">\n\nMSFT only here\n\n</TabItem>\n</Tabs>\n';
  assert.strictEqual(run(src).code, 0);
});

test('fixturesOf normalises the three date spellings to one token', () => {
  assert.deepStrictEqual(fixturesOf('from=2024-01-01'), ['2024-01-01']);
  assert.deepStrictEqual(fixturesOf('LocalDate.of(2024, 1, 1)'), ['2024-01-01']);
  assert.deepStrictEqual(fixturesOf('new DateOnly(2024, 1, 1)'), ['2024-01-01']);
});

test('fixturesOf keeps OCC symbols whole', () => {
  assert.deepStrictEqual(fixturesOf('quotes("AAPL271217C00250000")'), ['AAPL271217C00250000']);
});

test('offFixtureTickers ignores an interpolated output line', () => {
  assert.deepStrictEqual([...offFixtureTickers('console.log(`FY${y} Q${q}`)')], []);
});

test('requestSection returns null for a page with no examples', () => {
  assert.strictEqual(requestSection('# Title\n\n## Response Example\n\nnothing\n'), null);
});

test('tabsOf reports the outer path of a nested tab', () => {
  const body = '<TabItem value="Single" label="Single Symbol">\n<Tabs>\n<TabItem value="Go" label="Go">\nbody\n</TabItem>\n</Tabs>\n</TabItem>';
  const tabs = tabsOf(body);
  assert.strictEqual(tabs.length, 1);
  assert.strictEqual(tabs[0].label, 'Go');
  assert.strictEqual(tabs[0].group, 'Single Symbol > ');
});
