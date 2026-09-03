'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SCRIPT = path.resolve(__dirname, '..', 'check-example-parity.js');
const { fixturesOf, offFixtureTickers, tabsOf, tabsBlocks } = require(SCRIPT);

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

test('a renamed heading does not drop a page out of the check', () => {
  // The fail-open this replaced: 16 groups became 15, exit 0, no complaint.
  const under = (heading) => `---\ntitle: T\n---\n\n${heading}\n\n<Tabs>\n`
    + '<TabItem value="HTTP" label="HTTP">\n\n`AAPL`\n\n</TabItem>\n'
    + '<TabItem value="Go" label="Go">\n\n`MSFT`\n\n</TabItem>\n</Tabs>\n';
  for (const heading of ['## Request Example', '## Example Request', '### Code Examples']) {
    const r = run(under(heading));
    assert.strictEqual(r.code, 1, `heading ${heading} was not compared`);
    assert.match(r.out, /different requests/);
  }
});

test('a second block with one language tab is not compared against the first', () => {
  // Response Attributes carries a <Tabs> too. It is read like any other block
  // now that nothing is matched by heading, and it is not a parity question
  // because it holds a single language tab -- not because of where it sits.
  const src = page({
    HTTP: '**GET** https://api.marketdata.app/v1/stocks/quotes/AAPL/',
    Python: '```python\nclient.stocks.quotes("AAPL")\n```',
  }) + '\n## Response Attributes\n\n<Tabs>\n<TabItem value="HTTP" label="HTTP">\n\nMSFT only here\n\n</TabItem>\n</Tabs>\n';
  assert.strictEqual(run(src).code, 0);
});

test('the tripwire fires when the walk finds almost nothing', () => {
  // This check earned its floor: it once read only "## Request Example", and
  // five pages kept their tabs elsewhere -- 38 tabs nothing had compared, while
  // the run printed a confident "16 tab group(s)".
  const r = run(page({
    HTTP: '**GET** https://api.marketdata.app/v1/stocks/quotes/AAPL/',
    Python: '```python\nclient.stocks.quotes("AAPL")\n```',
  }), ['--floor', '999']);
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /below the floor of 999/);
  assert.match(r.out, /tripwire for a walk that stopped matching/);
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

test('tabsBlocks finds tabs under any heading, not just Request Example', () => {
  // The check used to read only "## Request Example". Renaming that heading
  // dropped a page's tabs out of the run silently, and five pages already kept
  // their language tabs under other headings -- 38 tabs nothing had ever
  // compared. Nothing is matched by heading now.
  const src = '## Code Examples\n\n<Tabs>\n<TabItem value="Go" label="Go">x</TabItem>\n</Tabs>\n';
  assert.strictEqual(tabsBlocks(src).length, 1);
  assert.strictEqual(tabsOf(tabsBlocks(src)[0]).length, 1);
});

test('tabsBlocks keeps two independent Tabs blocks apart', () => {
  // Two blocks on one page demonstrate two different requests on purpose.
  // Flattening them would compare one against the other and fail a correct page.
  const src = '<Tabs>\n<TabItem value="Go" label="Go">`AAPL`</TabItem>\n</Tabs>\n\n'
    + '<Tabs>\n<TabItem value="Go" label="Go">`MSFT`</TabItem>\n</Tabs>\n';
  assert.strictEqual(tabsBlocks(src).length, 2);
});

test('tabsOf reports the outer path of a nested tab', () => {
  const body = '<TabItem value="Single" label="Single Symbol">\n<Tabs>\n<TabItem value="Go" label="Go">\nbody\n</TabItem>\n</Tabs>\n</TabItem>';
  const tabs = tabsOf(body);
  assert.strictEqual(tabs.length, 1);
  assert.strictEqual(tabs[0].label, 'Go');
  assert.strictEqual(tabs[0].group, 'Single Symbol > ');
});
