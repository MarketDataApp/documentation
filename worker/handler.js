/**
 * Cloudflare Worker to proxy /docs/ paths from www.marketdata.app
 * and www-staging.marketdata.app to Cloudflare Pages deployments.
 *
 * Routing:
 * - www.marketdata.app/docs/*         → marketdata-docs.pages.dev/docs/*
 * - www-staging.marketdata.app/docs/* → marketdata-docs-staging.pages.dev/docs/*
 *
 * The path is preserved as-is (including the /docs/ prefix).
 * Cloudflare Pages serves files from a matching directory structure in the
 * build output, so no path rewriting is needed.
 *
 * Requests that don't match any route (e.g. the main WordPress site)
 * are passed through unchanged.
 */

/**
 * Hostname-based routing: maps each hostname to its Cloudflare Pages target.
 */
const TARGETS = {
  'www.marketdata.app': 'marketdata-docs.pages.dev',
  'www-staging.marketdata.app': 'marketdata-docs-staging.pages.dev',
};

/**
 * Converts raw MDX/markdown source into clean markdown by stripping
 * frontmatter, imports, and converting Docusaurus components to headings.
 *
 * @param {string} text - Raw file contents
 * @returns {string}
 */
function cleanMarkdown(text) {
  // Extract title from frontmatter, then strip it
  const fmMatch = text.match(/^---\n([\s\S]*?)\n---/);
  let title = '';
  if (fmMatch) {
    const titleMatch = fmMatch[1].match(/^title:\s*(.+)$/m);
    if (titleMatch) title = titleMatch[1].trim().replace(/^["']|["']$/g, '');
  }
  text = text.replace(/^---\n[\s\S]*?\n---\n*/, '');
  // Add title as H1 if present
  if (title) text = `# ${title}\n\n${text}`;
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
 * based on the hostname. Non-matching requests pass through to the
 * default origin (WordPress on cPanel).
 *
 * @param {Request} request - The incoming request
 * @returns {Promise<Response>}
 */
async function handleRequest(request) {
  const url = new URL(request.url);
  const target = TARGETS[url.hostname];

  if (!target) {
    return fetch(request);
  }

  const isDocsPath = url.pathname.startsWith('/docs/') || url.pathname === '/docs';

  if (!isDocsPath) {
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
  const wantsMd = url.pathname.endsWith('.md');
  const acceptsMd = (request.headers.get('accept') || '').includes('text/markdown');

  if (wantsMd || acceptsMd) {
    const docsPrefix = '/docs/';
    const stem = wantsMd
      ? url.pathname.slice(docsPrefix.length, -3)
      : url.pathname.replace(/\/$/, '').slice(docsPrefix.length);
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
        const text = cleanMarkdown(await res.text());
        return new Response(text, {
          headers: { 'content-type': 'text/markdown; charset=utf-8' },
        });
      }
    }
  }

  // Docs sites don't serve robots.txt; block stale cached copies
  if (url.pathname.endsWith('/robots.txt')) {
    return new Response('', { status: 404 });
  }

  url.hostname = target;
  const response = await fetch(new Request(url, request), { cf: { cacheEverything: true } });

  if (response.status === 404) {
    const pathname = new URL(request.url).pathname;
    const referer = request.headers.get('referer');
    console.log({ level: '404', message: pathname, referer: referer || '' });
  }

  return response;
}

module.exports = { handleRequest, cleanMarkdown, TARGETS };
