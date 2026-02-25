/**
 * Cloudflare Worker to proxy /docs/ and /docs-staging/ paths
 * from www.marketdata.app to Cloudflare Pages deployments.
 *
 * Last deployed: 2026-02-24
 *
 * Routing:
 * - www.marketdata.app/docs/*         → marketdata-docs.pages.dev/docs/*
 * - www.marketdata.app/docs-staging/* → marketdata-docs-staging.pages.dev/docs-staging/*
 *
 * The path is preserved as-is (including the /docs/ or /docs-staging/ prefix).
 * Cloudflare Pages serves files from a matching directory structure in the
 * build output, so no path rewriting is needed.
 *
 * Requests that don't match any route (e.g. the main WordPress site)
 * are passed through unchanged.
 */

const ORIGINAL_HOSTNAME = 'www.marketdata.app';

/**
 * Route definitions mapping URL path prefixes to Cloudflare Pages targets.
 * Order matters: /docs-staging/ must come before /docs/ to avoid
 * /docs-staging/* being matched by the /docs/ prefix.
 */
const ROUTES = [
  {
    prefix: '/docs-staging/',
    target: 'marketdata-docs-staging.pages.dev',
  },
  {
    prefix: '/docs/',
    target: 'marketdata-docs.pages.dev',
  },
];

/**
 * Checks whether a URL path matches a route, handling both
 * trailing-slash (/docs-staging/) and no-trailing-slash (/docs-staging) forms.
 *
 * @param {string} pathname - The URL path to check (e.g. "/docs-staging/api")
 * @param {string} prefix - The route prefix to match (e.g. "/docs-staging/")
 * @returns {boolean}
 */
function matchesRoute(pathname, prefix) {
  return pathname.startsWith(prefix) || pathname === prefix.slice(0, -1);
}

/**
 * Converts raw MDX/markdown source into clean markdown by stripping
 * frontmatter, imports, and converting Docusaurus components to headings.
 *
 * @param {string} text - Raw file contents
 * @returns {string}
 */
function cleanMarkdown(text) {
  // Strip frontmatter
  text = text.replace(/^---\n[\s\S]*?\n---\n*/, '');
  // Strip import statements
  text = text.replace(/^import\s+.*;\s*\n/gm, '');
  // Convert <TabItem> to ### headings, strip <Tabs> wrappers
  text = text.replace(/<Tabs>\n?/g, '');
  text = text.replace(/<\/Tabs>\n?/g, '');
  text = text.replace(/<TabItem\s+(?:[^>"]*(?:"[^"]*")?)*?label="([^"]*)"(?:[^>"]*(?:"[^"]*")?)*?>\n?/g, '### $1\n\n');
  text = text.replace(/<\/TabItem>\n?/g, '');
  // Clean up excess blank lines
  text = text.replace(/\n{3,}/g, '\n\n').trim() + '\n';
  return text;
}

/**
 * Routes incoming requests to the appropriate Cloudflare Pages deployment
 * based on the URL path. Non-matching requests pass through to the
 * default origin (WordPress on cPanel).
 *
 * @param {Request} request - The incoming request
 * @returns {Promise<Response>}
 */
async function handleRequest(request) {
  const url = new URL(request.url);

  if (url.hostname !== ORIGINAL_HOSTNAME) {
    return fetch(request);
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
  const docsPrefix = url.pathname.startsWith('/docs-staging/') ? '/docs-staging/'
    : url.pathname.startsWith('/docs/') ? '/docs/' : null;

  if (docsPrefix) {
    const wantsMd = url.pathname.endsWith('.md');
    const acceptsMd = (request.headers.get('accept') || '').includes('text/markdown');

    if (wantsMd || acceptsMd) {
      const stem = wantsMd
        ? url.pathname.slice(docsPrefix.length, -3)
        : url.pathname.replace(/\/$/, '').slice(docsPrefix.length);
      const branch = docsPrefix === '/docs-staging/' ? 'staging' : 'main';
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
          const text = cleanMarkdown(await res.text());
          return new Response(text, {
            headers: { 'content-type': 'text/markdown; charset=utf-8' },
          });
        }
      }
    }
  }

  for (const route of ROUTES) {
    if (matchesRoute(url.pathname, route.prefix)) {
      // Docs sites don't serve robots.txt; block stale cached copies
      if (url.pathname.endsWith('/robots.txt')) {
        return new Response('', { status: 404 });
      }

      url.hostname = route.target;
      const response = await fetch(new Request(url, request), { cf: { cacheEverything: true } });

      if (response.status === 404) {
        const pathname = new URL(request.url).pathname;
        const referer = request.headers.get('referer');
        console.log({ level: '404', message: pathname, referer: referer || '' });
      }

      return response;
    }
  }

  return fetch(request);
}

module.exports = { handleRequest, matchesRoute, cleanMarkdown, ROUTES, ORIGINAL_HOSTNAME };
