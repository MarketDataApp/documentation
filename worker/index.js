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

addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request));
});
