import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const { handleRequest, cleanMarkdown } = require('./handler');

function makeRequest(url, options = {}) {
  return new Request(url, options);
}

beforeEach(() => {
  vi.clearAllMocks();
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

  // --- Non-docs paths on known hostnames ---

  describe('non-docs paths on known hostnames', () => {
    it('passes through non-docs paths on www.marketdata.app', async () => {
      const passthroughResponse = new Response('wordpress');
      mockFetch.mockResolvedValueOnce(passthroughResponse);
      const req = makeRequest('https://www.marketdata.app/blog/some-post');
      const res = await handleRequest(req);
      expect(mockFetch).toHaveBeenCalledWith(req);
      expect(res).toBe(passthroughResponse);
    });

    it('passes through non-docs paths on www-staging.marketdata.app', async () => {
      const passthroughResponse = new Response('origin');
      mockFetch.mockResolvedValueOnce(passthroughResponse);
      const req = makeRequest('https://www-staging.marketdata.app/other/page');
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

  // --- cdn-cgi redirect ---

  describe('cdn-cgi redirect', () => {
    it('redirects misrouted cdn-cgi paths embedded in docs paths', async () => {
      const req = makeRequest('https://www.marketdata.app/docs/api/stocks/prices/cdn-cgi/zaraz/i.js');
      const res = await handleRequest(req);
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBe('https://www.marketdata.app/cdn-cgi/zaraz/i.js');
    });

    it('redirects cdn-cgi at top-level docs path', async () => {
      const req = makeRequest('https://www.marketdata.app/docs/cdn-cgi/zaraz/i.js');
      const res = await handleRequest(req);
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBe('https://www.marketdata.app/cdn-cgi/zaraz/i.js');
    });

    it('redirects misrouted cdn-cgi on staging hostname', async () => {
      const req = makeRequest('https://www-staging.marketdata.app/docs/api/stocks/cdn-cgi/zaraz/i.js');
      const res = await handleRequest(req);
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBe('https://www-staging.marketdata.app/cdn-cgi/zaraz/i.js');
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

    it('includes canonical Link header pointing to production HTML URL', async () => {
      mockFetch.mockResolvedValueOnce(new Response('# Page\n', { status: 200 }));
      const req = makeRequest('https://www.marketdata.app/docs/api/stocks.md');
      const res = await handleRequest(req);
      expect(res.headers.get('link')).toBe(
        '<https://www.marketdata.app/docs/api/stocks/>; rel="canonical"'
      );
    });

    it('canonical Link header points to production even for staging requests', async () => {
      mockFetch.mockResolvedValueOnce(new Response('# Staging\n', { status: 200 }));
      const req = makeRequest('https://www-staging.marketdata.app/docs/api/stocks.md');
      const res = await handleRequest(req);
      expect(res.headers.get('link')).toBe(
        '<https://www.marketdata.app/docs/api/stocks/>; rel="canonical"'
      );
    });

    it('serves markdown for llms.txt spec index.html.md URL', async () => {
      mockFetch.mockResolvedValueOnce(new Response('# Options\n', { status: 200 }));
      const req = makeRequest('https://www.marketdata.app/docs/options/index.html.md');
      const res = await handleRequest(req);
      expect(res.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
      const text = await res.text();
      expect(text).toContain('# Options');
      // Should try options.md first (stem = "options")
      const fetchedUrl = mockFetch.mock.calls[0][0];
      expect(fetchedUrl).toContain('/options.md');
    });

    it('canonical URL is correct for index.html.md requests', async () => {
      mockFetch.mockResolvedValueOnce(new Response('# Options\n', { status: 200 }));
      const req = makeRequest('https://www.marketdata.app/docs/options/index.html.md');
      const res = await handleRequest(req);
      expect(res.headers.get('link')).toBe(
        '<https://www.marketdata.app/docs/options/>; rel="canonical"'
      );
    });

    it('canonical URL strips /index from index.md requests', async () => {
      mockFetch.mockResolvedValueOnce(new Response('# Plans\n', { status: 200 }));
      const req = makeRequest('https://www.marketdata.app/docs/account/plans/index.md');
      const res = await handleRequest(req);
      expect(res.headers.get('link')).toBe(
        '<https://www.marketdata.app/docs/account/plans/>; rel="canonical"'
      );
    });

    it('handles nested path with index.html.md', async () => {
      mockFetch.mockResolvedValueOnce(new Response('# Candles\n', { status: 200 }));
      const req = makeRequest('https://www.marketdata.app/docs/api/stocks/candles/index.html.md');
      const res = await handleRequest(req);
      expect(res.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
      const fetchedUrl = mockFetch.mock.calls[0][0];
      expect(fetchedUrl).toContain('/api/stocks/candles.md');
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

    it('serves markdown for staging URLs (www-staging hostname)', async () => {
      mockFetch.mockResolvedValueOnce(new Response('# Staging\n', { status: 200 }));
      const req = makeRequest('https://www-staging.marketdata.app/docs/api/stocks.md');
      const res = await handleRequest(req);
      expect(res.headers.get('content-type')).toBe('text/markdown; charset=utf-8');
      // Should fetch from staging branch
      const fetchedUrl = mockFetch.mock.calls[0][0];
      expect(fetchedUrl).toContain('/staging/');
    });

    it('fetches from main branch for www.marketdata.app URLs', async () => {
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


  // --- Route proxying ---

  describe('route proxying', () => {
    it('proxies /docs/* on www.marketdata.app to production Pages', async () => {
      mockFetch.mockResolvedValueOnce(new Response('page', { status: 200 }));
      const req = makeRequest('https://www.marketdata.app/docs/api/stocks');
      await handleRequest(req);
      const calledWith = mockFetch.mock.calls[0][0];
      expect(new URL(calledWith.url).hostname).toBe('www-marketdata-app.pages.dev');
    });

    it('proxies /docs/* on www-staging.marketdata.app to staging Pages', async () => {
      mockFetch.mockResolvedValueOnce(new Response('page', { status: 200 }));
      const req = makeRequest('https://www-staging.marketdata.app/docs/api/stocks');
      await handleRequest(req);
      const calledWith = mockFetch.mock.calls[0][0];
      expect(new URL(calledWith.url).hostname).toBe('www-staging-marketdata-app.pages.dev');
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

    it('handles bare /docs path (no trailing slash)', async () => {
      mockFetch.mockResolvedValueOnce(new Response('page', { status: 200 }));
      const req = makeRequest('https://www.marketdata.app/docs');
      await handleRequest(req);
      const calledWith = mockFetch.mock.calls[0][0];
      expect(new URL(calledWith.url).hostname).toBe('www-marketdata-app.pages.dev');
    });
  });

  // --- Client-redirect stub → 301 conversion ---

  describe('client-redirect stub conversion', () => {
    const stubHtml = (target) => [
      '<!DOCTYPE html>',
      '<html>',
      '  <head>',
      '    <meta charset="UTF-8">',
      `    <meta http-equiv="refresh" content="0; url=${target}">`,
      `    <link rel="canonical" href="${target}" />`,
      '  </head>',
      '  <script>',
      `    window.location.href = '${target}' + window.location.search + window.location.hash;`,
      '  </script>',
      '</html>',
    ].join('\n');

    it('converts meta-refresh stub into 301 with absolute Location', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(stubHtml('/docs/api/options/chain/'), {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        })
      );
      const req = makeRequest('https://www.marketdata.app/docs/api/options/strikes/');
      const res = await handleRequest(req);
      expect(res.status).toBe(301);
      expect(res.headers.get('location')).toBe(
        'https://www.marketdata.app/docs/api/options/chain/'
      );
    });

    it('uses staging hostname in Location for staging requests', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(stubHtml('/docs/api/options/chain/'), {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        })
      );
      const req = makeRequest('https://www-staging.marketdata.app/docs/api/options/strikes/');
      const res = await handleRequest(req);
      expect(res.status).toBe(301);
      expect(res.headers.get('location')).toBe(
        'https://www-staging.marketdata.app/docs/api/options/chain/'
      );
    });

    it('passes through absolute URL targets unchanged', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(stubHtml('https://example.com/somewhere'), {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        })
      );
      const req = makeRequest('https://www.marketdata.app/docs/some/page/');
      const res = await handleRequest(req);
      expect(res.status).toBe(301);
      expect(res.headers.get('location')).toBe('https://example.com/somewhere');
    });

    it('does not transform large HTML responses', async () => {
      const largeBody = '<!DOCTYPE html><html><body>' + 'x'.repeat(5000) + '</body></html>';
      mockFetch.mockResolvedValueOnce(
        new Response(largeBody, {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        })
      );
      const req = makeRequest('https://www.marketdata.app/docs/api/stocks/');
      const res = await handleRequest(req);
      expect(res.status).toBe(200);
    });

    it('does not transform small HTML responses without meta-refresh', async () => {
      const html = '<!DOCTYPE html><html><body><p>Tiny real page</p></body></html>';
      mockFetch.mockResolvedValueOnce(
        new Response(html, {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        })
      );
      const req = makeRequest('https://www.marketdata.app/docs/api/stocks/');
      const res = await handleRequest(req);
      expect(res.status).toBe(200);
      expect(await res.text()).toContain('Tiny real page');
    });

    it('does not transform non-HTML responses that happen to contain meta-refresh text', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('meta http-equiv="refresh" content="0; url=/somewhere"', {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        })
      );
      const req = makeRequest('https://www.marketdata.app/docs/api/stocks/');
      const res = await handleRequest(req);
      expect(res.status).toBe(200);
    });

    it('does not transform non-2xx responses', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(stubHtml('/docs/api/options/chain/'), {
          status: 404,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        })
      );
      const req = makeRequest('https://www.marketdata.app/docs/api/options/strikes/');
      const res = await handleRequest(req);
      expect(res.status).toBe(404);
    });

    it('accepts single-quoted meta-refresh attributes', async () => {
      const body = "<html><head><meta http-equiv='refresh' content='0; url=/docs/other/'></head></html>";
      mockFetch.mockResolvedValueOnce(
        new Response(body, {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        })
      );
      const req = makeRequest('https://www.marketdata.app/docs/api/other/redirect/');
      const res = await handleRequest(req);
      expect(res.status).toBe(301);
      expect(res.headers.get('location')).toBe('https://www.marketdata.app/docs/other/');
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
});
