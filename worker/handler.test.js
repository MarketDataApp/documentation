import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const { handleRequest, matchesRoute, cleanMarkdown } = require('./handler');

function makeRequest(url, options = {}) {
  return new Request(url, options);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// --- matchesRoute ---

describe('matchesRoute', () => {
  it('matches path starting with prefix', () => {
    expect(matchesRoute('/docs/api', '/docs/')).toBe(true);
  });

  it('matches exact path without trailing slash', () => {
    expect(matchesRoute('/docs', '/docs/')).toBe(true);
  });

  it('does not match unrelated path', () => {
    expect(matchesRoute('/other', '/docs/')).toBe(false);
  });

  it('does not match partial prefix', () => {
    expect(matchesRoute('/documentation', '/docs/')).toBe(false);
  });

  it('/docs-staging/ does not match /docs/ prefix', () => {
    expect(matchesRoute('/docs-staging/', '/docs/')).toBe(false);
  });
});

// --- cleanMarkdown ---

describe('cleanMarkdown', () => {
  it('extracts title from frontmatter as H1', () => {
    const input = '---\ntitle: Test\nsidebar_position: 1\n---\n\n# Hello\n';
    expect(cleanMarkdown(input)).toBe('# Test\n\n# Hello\n');
  });

  it('strips frontmatter without title', () => {
    const input = '---\nsidebar_position: 1\n---\n\n# Hello\n';
    expect(cleanMarkdown(input)).toBe('# Hello\n');
  });

  it('strips import statements', () => {
    const input = 'import Tabs from "@theme/Tabs";\nimport TabItem from "@theme/TabItem";\n\n# Hello\n';
    expect(cleanMarkdown(input)).toBe('# Hello\n');
  });

  it('converts TabItem to headings and strips Tabs wrappers', () => {
    const input = '<Tabs>\n<TabItem value="js" label="JavaScript">\n\ncode here\n\n</TabItem>\n</Tabs>\n';
    const result = cleanMarkdown(input);
    expect(result).toContain('### JavaScript');
    expect(result).not.toContain('<Tabs>');
    expect(result).not.toContain('<TabItem');
    expect(result).not.toContain('</TabItem>');
  });

  it('collapses excess blank lines', () => {
    const input = '# A\n\n\n\n\n# B\n';
    expect(cleanMarkdown(input)).toBe('# A\n\n# B\n');
  });
});

// --- handleRequest ---

describe('handleRequest', () => {

  // --- Non-matching hostname ---

  describe('non-matching hostname', () => {
    it('passes through requests for other hostnames', async () => {
      const passthroughResponse = new Response('origin');
      mockFetch.mockResolvedValueOnce(passthroughResponse);
      const req = makeRequest('https://other.example.com/docs/api');
      const res = await handleRequest(req);
      expect(mockFetch).toHaveBeenCalledWith(req);
      expect(res).toBe(passthroughResponse);
    });
  });

  // --- SDK PHP redirects ---

  describe('SDK PHP redirect', () => {
    it('redirects /docs/sdk-php/ paths to GitHub Pages', async () => {
      const req = makeRequest('https://www.marketdata.app/docs/sdk-php/classes/Client.html');
      const res = await handleRequest(req);
      expect(res.status).toBe(301);
      expect(res.headers.get('location')).toBe(
        'https://marketdataapp.github.io/sdk-php/classes/Client.html'
      );
    });

    it('redirects bare /docs/sdk-php', async () => {
      const req = makeRequest('https://www.marketdata.app/docs/sdk-php');
      const res = await handleRequest(req);
      expect(res.status).toBe(301);
      expect(res.headers.get('location')).toBe(
        'https://marketdataapp.github.io/sdk-php/'
      );
    });

    it('fixes doubled directory names', async () => {
      const req = makeRequest('https://www.marketdata.app/docs/sdk-php/classes/classes/Client.html');
      const res = await handleRequest(req);
      expect(res.status).toBe(301);
      expect(res.headers.get('location')).toBe(
        'https://marketdataapp.github.io/sdk-php/classes/Client.html'
      );
    });
  });

  // --- Markdown serving ---

  describe('markdown serving', () => {
    const sampleMdx = [
      '---',
      'title: Test',
      'sidebar_position: 1',
      '---',
      '',
      'import Tabs from "@theme/Tabs";',
      '',
      '# Hello',
      '',
      '<Tabs>',
      '<TabItem value="js" label="JavaScript">',
      '',
      '```js',
      'console.log("hi");',
      '```',
      '',
      '</TabItem>',
      '</Tabs>',
    ].join('\n');

    it('serves cleaned markdown for .md URL', async () => {
      mockFetch.mockResolvedValueOnce(new Response(sampleMdx, { status: 200 }));
      const req = makeRequest('https://www.marketdata.app/docs/api/stocks.md');
      const res = await handleRequest(req);
      expect(res.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
      const text = await res.text();
      expect(text).not.toContain('sidebar_position');
      expect(text).not.toContain('import ');
      expect(text).toContain('### JavaScript');
      expect(text).toContain('# Test');
      expect(text).toContain('# Hello');
    });

    it('serves markdown for Accept: text/markdown header', async () => {
      mockFetch.mockResolvedValueOnce(new Response('# Heading\n', { status: 200 }));
      const req = makeRequest('https://www.marketdata.app/docs/api/stocks', {
        headers: { Accept: 'text/markdown' },
      });
      const res = await handleRequest(req);
      expect(res.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
    });

    it('handles Accept header with trailing slash', async () => {
      mockFetch.mockResolvedValueOnce(new Response('# Heading\n', { status: 200 }));
      const req = makeRequest('https://www.marketdata.app/docs/api/options/', {
        headers: { Accept: 'text/markdown' },
      });
      const res = await handleRequest(req);
      expect(res.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
    });

    it('tries multiple candidates until one succeeds', async () => {
      mockFetch
        .mockResolvedValueOnce(new Response('', { status: 404 }))   // .md
        .mockResolvedValueOnce(new Response('', { status: 404 }))   // .mdx
        .mockResolvedValueOnce(new Response('# Found\n', { status: 200 })); // index.md
      const req = makeRequest('https://www.marketdata.app/docs/api/options.md');
      const res = await handleRequest(req);
      expect(mockFetch).toHaveBeenCalledTimes(3);
      const text = await res.text();
      expect(text).toContain('# Found');
    });

    it('serves markdown for docs-staging URLs', async () => {
      mockFetch.mockResolvedValueOnce(new Response('# Staging\n', { status: 200 }));
      const req = makeRequest('https://www.marketdata.app/docs-staging/api/stocks.md');
      const res = await handleRequest(req);
      expect(res.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
      // Should fetch from staging branch
      const fetchedUrl = mockFetch.mock.calls[0][0];
      expect(fetchedUrl).toContain('/staging/');
    });

    it('fetches from main branch for /docs/ URLs', async () => {
      mockFetch.mockResolvedValueOnce(new Response('# Prod\n', { status: 200 }));
      const req = makeRequest('https://www.marketdata.app/docs/api/stocks.md');
      await handleRequest(req);
      const fetchedUrl = mockFetch.mock.calls[0][0];
      expect(fetchedUrl).toContain('/main/');
    });

    it('falls through when no markdown candidate found', async () => {
      mockFetch
        .mockResolvedValueOnce(new Response('', { status: 404 }))
        .mockResolvedValueOnce(new Response('', { status: 404 }))
        .mockResolvedValueOnce(new Response('', { status: 404 }))
        .mockResolvedValueOnce(new Response('', { status: 404 }))
        // Route proxy fetch
        .mockResolvedValueOnce(new Response('html page', { status: 200 }));
      const req = makeRequest('https://www.marketdata.app/docs/nonexistent.md');
      const res = await handleRequest(req);
      expect(mockFetch).toHaveBeenCalledTimes(5);
    });
  });

  // --- robots.txt ---

  describe('robots.txt blocking', () => {
    it('returns 404 for /docs/robots.txt', async () => {
      const req = makeRequest('https://www.marketdata.app/docs/robots.txt');
      const res = await handleRequest(req);
      expect(res.status).toBe(404);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns 404 for /docs-staging/robots.txt', async () => {
      const req = makeRequest('https://www.marketdata.app/docs-staging/robots.txt');
      const res = await handleRequest(req);
      expect(res.status).toBe(404);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // --- Route proxying ---

  describe('route proxying', () => {
    it('proxies /docs/* to marketdata-docs.pages.dev', async () => {
      mockFetch.mockResolvedValueOnce(new Response('page', { status: 200 }));
      const req = makeRequest('https://www.marketdata.app/docs/api/stocks');
      await handleRequest(req);
      const calledWith = mockFetch.mock.calls[0][0];
      expect(new URL(calledWith.url).hostname).toBe('marketdata-docs.pages.dev');
    });

    it('proxies /docs-staging/* to staging', async () => {
      mockFetch.mockResolvedValueOnce(new Response('page', { status: 200 }));
      const req = makeRequest('https://www.marketdata.app/docs-staging/api/stocks');
      await handleRequest(req);
      const calledWith = mockFetch.mock.calls[0][0];
      expect(new URL(calledWith.url).hostname).toBe('marketdata-docs-staging.pages.dev');
    });

    it('preserves the full path when proxying', async () => {
      mockFetch.mockResolvedValueOnce(new Response('page', { status: 200 }));
      const req = makeRequest('https://www.marketdata.app/docs/api/stocks/candles');
      await handleRequest(req);
      const calledWith = mockFetch.mock.calls[0][0];
      expect(new URL(calledWith.url).pathname).toBe('/docs/api/stocks/candles');
    });

    it('passes cf.cacheEverything option', async () => {
      mockFetch.mockResolvedValueOnce(new Response('page', { status: 200 }));
      const req = makeRequest('https://www.marketdata.app/docs/api');
      await handleRequest(req);
      const fetchOptions = mockFetch.mock.calls[0][1];
      expect(fetchOptions).toEqual({ cf: { cacheEverything: true } });
    });
  });

  // --- 404 logging ---

  describe('404 logging', () => {
    it('logs 404 responses with pathname and referer', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      mockFetch.mockResolvedValueOnce(new Response('not found', { status: 404 }));
      const req = makeRequest('https://www.marketdata.app/docs/missing-page', {
        headers: { Referer: 'https://www.google.com/' },
      });
      await handleRequest(req);
      expect(consoleSpy).toHaveBeenCalledWith({
        level: '404',
        message: '/docs/missing-page',
        referer: 'https://www.google.com/',
      });
      consoleSpy.mockRestore();
    });

    it('logs empty referer when none present', async () => {
      const consoleSpy = vi.spyOn(console, 'log');
      mockFetch.mockResolvedValueOnce(new Response('not found', { status: 404 }));
      const req = makeRequest('https://www.marketdata.app/docs/missing-page');
      await handleRequest(req);
      expect(consoleSpy).toHaveBeenCalledWith({
        level: '404',
        message: '/docs/missing-page',
        referer: '',
      });
      consoleSpy.mockRestore();
    });
  });

  // --- Pass-through ---

  describe('pass-through for non-matching routes', () => {
    it('passes through requests to non-docs paths', async () => {
      const passthroughResponse = new Response('wordpress');
      mockFetch.mockResolvedValueOnce(passthroughResponse);
      const req = makeRequest('https://www.marketdata.app/blog/some-post');
      const res = await handleRequest(req);
      expect(mockFetch).toHaveBeenCalledWith(req);
      expect(res).toBe(passthroughResponse);
    });

    it('passes through root path', async () => {
      const passthroughResponse = new Response('homepage');
      mockFetch.mockResolvedValueOnce(passthroughResponse);
      const req = makeRequest('https://www.marketdata.app/');
      const res = await handleRequest(req);
      expect(mockFetch).toHaveBeenCalledWith(req);
      expect(res).toBe(passthroughResponse);
    });
  });
});
