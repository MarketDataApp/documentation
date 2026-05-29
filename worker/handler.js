/**
 * Cloudflare Worker to proxy /docs/ paths from www.marketdata.app
 * and www-staging.marketdata.app to Cloudflare Pages deployments.
 *
 * Routing:
 * - www.marketdata.app/docs/*         → www-marketdata-app.pages.dev/docs/*
 * - www-staging.marketdata.app/docs/* → www-staging-marketdata-app.pages.dev/docs/*
 *
 * The path is preserved as-is (including the /docs/ prefix).
 * Cloudflare Pages serves files from a matching directory structure in the
 * build output, so no path rewriting is needed.
 *
 * Requests that don't match any route (e.g. the main WordPress site)
 * are passed through unchanged.
 */

const { cleanMdx } = require('../lib/mdx-to-md');

/**
 * Hostname-based routing: maps each hostname to its Cloudflare Pages target.
 */
const TARGETS = {
  'www.marketdata.app': 'www-marketdata-app.pages.dev',
  'www-staging.marketdata.app': 'www-staging-marketdata-app.pages.dev',
};

/**
 * Routes incoming requests to the appropriate Cloudflare Pages deployment
 * based on the hostname. Non-matching requests pass through to the
 * default origin (WordPress on cPanel).
 *
 * @param {Request} request - The incoming request
 * @returns {Promise<Response>}
 */
async function handleRequest(request) {
  const url = new URL(request.url);
  const publicHostname = url.hostname;
  const target = TARGETS[publicHostname];

  if (!target) {
    return fetch(request);
  }

  const isDocsPath = url.pathname.startsWith('/docs/') || url.pathname === '/docs';

  if (!isDocsPath) {
    return fetch(request);
  }

  // Redirect misrouted cdn-cgi paths (e.g. Zaraz relative URL requests from deep doc pages)
  // e.g. /docs/api/stocks/prices/cdn-cgi/zaraz/i.js → /cdn-cgi/zaraz/i.js
  const cdnCgiIndex = url.pathname.indexOf('/cdn-cgi/');
  if (cdnCgiIndex !== -1) {
    const cdnCgiPath = url.pathname.slice(cdnCgiIndex);
    return Response.redirect(`https://${url.hostname}${cdnCgiPath}`, 302);
  }

  // Redirect legacy SDK PHP docs to GitHub Pages
  const sdkPhpPrefix = '/docs/sdk-php/';
  if (url.pathname.startsWith(sdkPhpPrefix) || url.pathname === '/docs/sdk-php') {
    let subpath = url.pathname.slice(sdkPhpPrefix.length);
    // Fix doubled directory names (e.g. classes/classes/ → classes/)
    subpath = subpath.replace(/^(\w+)\/\1\//, '$1/');
    return Response.redirect(`https://marketdataapp.github.io/sdk-php/${subpath}`, 301);
  }

  // Serve raw markdown for .md URLs or Accept: text/markdown header
  const wantsMd = url.pathname.endsWith('.md');
  const acceptsMd = (request.headers.get('accept') || '').includes('text/markdown');

  if (wantsMd || acceptsMd) {
    const docsPrefix = '/docs/';
    let stem;
    if (wantsMd) {
      // Support llms.txt spec: /docs/options/index.html.md → stem "options"
      const indexHtmlMd = '/index.html.md';
      if (url.pathname.endsWith(indexHtmlMd)) {
        stem = url.pathname.slice(docsPrefix.length, -indexHtmlMd.length);
      } else {
        stem = url.pathname.slice(docsPrefix.length, -3).replace(/\/index$/, '');
      }
    } else {
      stem = url.pathname.replace(/\/$/, '').slice(docsPrefix.length);
    }
    const branch = url.hostname === 'www-staging.marketdata.app' ? 'staging' : 'main';
    const base = `https://raw.githubusercontent.com/MarketDataApp/documentation/${branch}`;
    const candidates = [
      `${base}/${stem}.md`,
      `${base}/${stem}.mdx`,
      `${base}/${stem}/index.md`,
      `${base}/${stem}/index.mdx`,
    ];
    for (const candidate of candidates) {
      const res = await fetch(candidate);
      if (res.ok) {
        const text = cleanMdx(await res.text(), {
          baseUrl: 'https://www.marketdata.app/docs',
        });
        const canonicalUrl = `https://www.marketdata.app/docs/${stem}/`;
        return new Response(text, {
          headers: {
            'content-type': 'text/markdown; charset=utf-8',
            'link': `<${canonicalUrl}>; rel="canonical"`,
          },
        });
      }
    }
  }

  url.hostname = target;
  const response = await fetch(new Request(url, request), { cf: { cacheEverything: true } });

  // Convert Docusaurus client-redirect stubs into proper HTTP 301 redirects.
  // The plugin-client-redirects plugin emits tiny HTML files with a
  // <meta http-equiv="refresh"> tag. Intercepting them here gives us proper
  // redirect semantics for non-browser clients (curl, fetch, bots, LLM scrapers).
  const contentType = response.headers.get('content-type') || '';
  if (response.ok && contentType.startsWith('text/html')) {
    const body = await response.clone().text();
    if (body.length < 4096) {
      const refreshMatch = body.match(
        /<meta\s+http-equiv=["']refresh["']\s+content=["']\s*\d+\s*;\s*url=([^"']+)["']/i
      );
      if (refreshMatch) {
        const redirectPath = refreshMatch[1];
        const absoluteTarget = redirectPath.startsWith('http')
          ? redirectPath
          : `https://${publicHostname}${redirectPath}`;
        return Response.redirect(absoluteTarget, 301);
      }
    }
  }

  if (response.status === 404) {
    const pathname = new URL(request.url).pathname;
    const referer = request.headers.get('referer');
    console.log({ level: '404', message: pathname, referer: referer || '' });
  }

  return response;
}

module.exports = { handleRequest, TARGETS };
