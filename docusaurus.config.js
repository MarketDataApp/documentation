const { REDIRECTS } = require("./redirects");

// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require("prism-react-renderer").themes.github;
const darkCodeTheme = require("prism-react-renderer").themes.dracula;

require("dotenv").config();

// Resolved ONCE, here, and handed to plugins/build-info.js. Both halves of the
// sentinel -- /docs/build-info.json and the <meta name="build-commit"> on every
// page -- read this one value. Two call sites resolving the commit separately
// would be two ways to answer one question, and they would disagree the day
// somebody changed one of them.
//
// `builtAt` is NOT here, and the reason is sharper than "keep it out of the
// head". Docusaurus serialises this whole config -- plugin options included --
// into the client bundle, so anything placed here ships to every reader inside
// `main.<hash>.js` AND moves that hash. A clock here therefore gave every build
// a new bundle name, so:
//
//   * every deploy re-downloaded the ~635 KB primary bundle for every visitor,
//     for no content change, against a `max-age=31536000, immutable` header;
//   * every deploy stranded whoever was mid-session, which is the exact reader
//     `src/clientModules/chunkReload.js` exists to recover;
//   * two builds of one tree differed in all 265 pages, which destroys the
//     "diff the built HTML" property this file was written to protect.
//
// Measured 2026-09-04 by building the same commit twice: identical but for
// `builtAt`, and every page repainted. The plugin stamps the timestamp in its
// own `postBuild` instead, which is both the moment the value describes and
// the only place it is read.
//
// The COMMIT stays here on purpose -- one resolver feeding both the endpoint
// and the per-page tag. It is stable for a given tree, so it costs no bundle
// churn; a clock is not stable and that is the whole difference.
const { resolveGit } = require("./lib/build-info");
const BUILD_INFO = { resolved: resolveGit() };

/** @type {import('@docusaurus/types').Config} */
const config = {
  title:
    process.env.PROD == "true" ? "Market Data" : "Market Data Docs (staging)",
  tagline: "Complete Documentation For All Market Data Products & Services",

  url:
    process.env.PROD == "true"
      ? "https://www.marketdata.app/"
      : "https://www-staging.marketdata.app/",

  baseUrl: "/docs/",
  trailingSlash: true,
  noIndex: process.env.PROD !== "true",
  // "warn" on deploys so a stray link never blocks a production release, but
  // "throw" under STRICT_LINKS so the PR check (yarn lint:links) fails instead
  // of letting broken links reach the site. This was "ignore" and silently
  // accumulated 14 broken links.
  onBrokenLinks: process.env.STRICT_LINKS === "true" ? "throw" : "warn",
  onBrokenMarkdownLinks: process.env.STRICT_LINKS === "true" ? "throw" : "warn",
  favicon: "img/favicon.ico",

  organizationName: "marketdata",
  projectName: "documentation",

  headTags: [
    // The Cloudflare Zaraz loader, and PRODUCTION ONLY.
    //
    // Zaraz is configured per ZONE, and www. and www-staging. are both in the
    // marketdata.app zone. A staging build that loads this fires the same tools
    // into the same GA4 property as production, and polluted analytics cannot be
    // un-collected. The gate is therefore the same `PROD` flag that drives
    // `noIndex` and `url` above, which `deploy-docs.yml` sets only on `main`.
    //
    // The tag lives here rather than in `src/theme/Root.js` because the client
    // bundle cannot read `process.env.PROD`; only this file can. It previously
    // gated on `NODE_ENV`, which every `yarn build` sets, so staging loaded it.
    //
    // The attributes match `ZARAZ_LOADER_ATTRS` in MarketDataApp/website's
    // `src/lib/site-env.mjs` — the marketing half of the same origin — and each
    // one is load-bearing:
    //   data-cfasync="false"     keeps Rocket Loader from deferring the loader
    //                            past the pageview it exists to record
    //   referrerpolicy="origin"  sends the origin, not the measured page's path
    //
    // Cloudflare answers /cdn-cgi/zaraz/i.js at the edge. No origin serves it.
    ...(process.env.PROD == "true"
      ? [
          {
            tagName: "script",
            attributes: {
              "data-cfasync": "false",
              src: "/cdn-cgi/zaraz/i.js",
              referrerpolicy: "origin",
            },
          },
        ]
      : []),
    {
      tagName: "meta",
      attributes: {
        name: "algolia-site-verification",
        content: "BAA3BC0EFD344D0C",
      },
    },
    {
      tagName: "link",
      attributes: {
        rel: "stylesheet",
        href: "/docs/css/components.no-reset.css",
      },
    },
  ],

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: false,
        blog: false,
        theme: {
          customCss: [require.resolve("./src/css/custom.css")],
        },
        sitemap:
          process.env.PROD == "true"
            ? {
                changefreq: "weekly",
                priority: 0.5,
                // Matched against the path INCLUDING `baseUrl`, which is why
                // these name `/docs/`. Two patterns because `**` does not match
                // the section root's own empty remainder.
                //
                // This list used to carry `/tags/**`, which HAD NEVER MATCHED
                // ANYTHING: tag routes are generated per docs instance, so they
                // are `/docs/api/tags/…` and `/docs/sheets/tags/…` — neither the
                // prefix nor the middle segment is optional. Seven tag pages were
                // in the production sitemap for as long as the site has had one.
                // The pages are gone as of 2026-09-04, retired with the `tags:`
                // front matter that generated them and redirected in redirects.js,
                // so the pattern went with them rather than being corrected.
                //
                // A pattern that matches nothing is indistinguishable from one
                // that matches everything it should, because both build clean.
                // Count the locs; do not read the config.
                //
                // `/internal/` is our own reference material.
                // `plugins/noindex-head.js` marks every page there noindex, and
                // D2 fails when the sitemap advertises a noindex route — so
                // without these the build goes red rather than shipping a
                // contradiction.
                ignorePatterns: ["/docs/internal/**", "/docs/internal/"],
                filename: "sitemap.xml",
              }
            : {},
      }),
    ],
  ],

  clientModules: [
    './src/clientModules/themeCookieSync.js',
    './src/clientModules/navbarOverflow.js',
    // Recovers a reader whose session outlived the build it started in. Every
    // deploy strands whoever is mid-session: their HTML names chunk hashes the
    // new deployment no longer contains. MarketData-App/website#98 measured it
    // twice in one day. See lib/chunk-reload.js.
    './src/clientModules/chunkReload.js',
  ],

  plugins: [
    ['./plugins/build-info', BUILD_INFO],
    './plugins/theme-cookie-sync',
    './plugins/markdown-twins',
    './plugins/not-found-head',
    './plugins/noindex-head',
    './plugins/redirects-file',
    [
      "@docusaurus/plugin-content-docs",
      /** @type {import('@docusaurus/plugin-content-docs').Options} */
      {
        id: "api",
        path: "api",
        routeBasePath: "api",
        sidebarPath: require.resolve("./sidebars.js"),

        editUrl: ({ docPath }) => {
          const host = process.env.PROD == "true" ? "www.marketdata.app" : "www-staging.marketdata.app";
          return `https://${host}/docs/api/${docPath.replace(/\.mdx?$/, '.md')}`;
        },
        // Read from git history, so it needs full history at build time:
        // deploy-docs.yml and pr-checks.yml check out with fetch-depth: 0.
        // With a shallow clone every page reports the same date.
        showLastUpdateTime: true,
      },
    ],
    [
      "@docusaurus/plugin-content-docs",
      /** @type {import('@docusaurus/plugin-content-docs').Options} */
      {
        id: "sdk",
        path: "sdk",
        routeBasePath: "sdk",
        editUrl: ({ docPath }) => {
          const host = process.env.PROD == "true" ? "www.marketdata.app" : "www-staging.marketdata.app";
          return `https://${host}/docs/sdk/${docPath.replace(/\.mdx?$/, '.md')}`;
        },
        // Read from git history, so it needs full history at build time:
        // deploy-docs.yml and pr-checks.yml check out with fetch-depth: 0.
        // With a shallow clone every page reports the same date.
        showLastUpdateTime: true,
        sidebarPath: require.resolve("./sidebars.js"),
      },
    ],
    [
      "@docusaurus/plugin-content-docs",
      /** @type {import('@docusaurus/plugin-content-docs').Options} */
      {
        id: "sheets",
        path: "sheets",
        routeBasePath: "sheets",
        editUrl: ({ docPath }) => {
          const host = process.env.PROD == "true" ? "www.marketdata.app" : "www-staging.marketdata.app";
          return `https://${host}/docs/sheets/${docPath.replace(/\.mdx?$/, '.md')}`;
        },
        // Read from git history, so it needs full history at build time:
        // deploy-docs.yml and pr-checks.yml check out with fetch-depth: 0.
        // With a shallow clone every page reports the same date.
        showLastUpdateTime: true,
        sidebarPath: require.resolve("./sidebars.js"),
      },
    ],
    [
      "@docusaurus/plugin-content-docs",
      /** @type {import('@docusaurus/plugin-content-docs').Options} */
      {
        id: "account",
        path: "account",
        routeBasePath: "account",
        editUrl: ({ docPath }) => {
          const host = process.env.PROD == "true" ? "www.marketdata.app" : "www-staging.marketdata.app";
          return `https://${host}/docs/account/${docPath.replace(/\.mdx?$/, '.md')}`;
        },
        // Read from git history, so it needs full history at build time:
        // deploy-docs.yml and pr-checks.yml check out with fetch-depth: 0.
        // With a shallow clone every page reports the same date.
        showLastUpdateTime: true,
        sidebarPath: require.resolve("./sidebars.js"),
      },
    ],
    [
      "@docusaurus/plugin-content-docs",
      /** @type {import('@docusaurus/plugin-content-docs').Options} */
      {
        // Our own reference material. Reachable by typing the URL, absent from
        // the navbar because nothing in `themeConfig.navbar.items` names it.
        //
        // NOT `unlisted: true`. That front matter hides a page from the SIDEBAR
        // in a production build, which is the opposite of what this section is
        // for: the whole point is that landing on /docs/internal/<page> gives
        // you the section's menu.
        //
        // `noindex` is stamped onto the built pages by `plugins/noindex-head.js`
        // instead, and `lint:seo` M1 fails the build if a page arrives without
        // it. A `<head>` block in the MDX was tried first and does not work --
        // it renders as literal text and produces no tag. See lib/noindex-head.js.
        //
        // llms.txt does not read that tag. `internal` is excluded by stem in
        // lib/llms-txt.js, because postBuild hooks run concurrently and reading
        // a stamped page would be a race.
        id: "internal",
        path: "internal",
        routeBasePath: "internal",
        editUrl: ({ docPath }) => {
          const host = process.env.PROD == "true" ? "www.marketdata.app" : "www-staging.marketdata.app";
          return `https://${host}/docs/internal/${docPath.replace(/\.mdx?$/, '.md')}`;
        },
        // Read from git history, so it needs full history at build time:
        // deploy-docs.yml and pr-checks.yml check out with fetch-depth: 0.
        // With a shallow clone every page reports the same date.
        showLastUpdateTime: true,
        sidebarPath: require.resolve("./sidebars.js"),
      },
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      /**
       * The social card every page falls back to.
       *
       * Docusaurus emits `<meta name="twitter:card" content="summary_large_image">`
       * UNCONDITIONALLY (theme-classic SiteMetadata), while `og:image` and
       * `twitter:image` appear only when this key is set. It was not set, so all
       * 270 pages promised a large-image card and supplied no image, and every
       * shared docs link rendered as a bare URL. `lint:seo` rule F2 gates the
       * pair now, so the promise and the image cannot come apart again.
       *
       * Cropped to 1200x630 from "Facebook Cover Data" in the brand Social Media
       * Kit. The source carries a 1px semi-transparent frame (alpha 128, corners
       * 64) that flattens to a visible hairline, so the crop is inset 2px first.
       *
       * A page overrides it with frontmatter `image:`.
       */
      image: 'img/social-card.png',

      // Docusaurus emits no alt text for the card, and the two networks read
      // different names: Open Graph og:image:alt, X twitter:image:alt.
      metadata: [
        {
          property: 'og:image:alt',
          content:
            'Market Data — Get Data Anywhere, beside an illustration of charts and dashboards',
        },
        {
          name: 'twitter:image:alt',
          content:
            'Market Data — Get Data Anywhere, beside an illustration of charts and dashboards',
        },
      ],

      algolia: {
        appId: "IUHZFO750H",
        apiKey: "c29b76b827a4fa1a0ac3abe15f69ec5c",
        indexName: "Market Data Documentation",
      },

      navbar: {
        title: "",
        logo: {
          alt: "My Logo",
          src: "img/pngs/logo.png",
          href: "/",
          srcDark: "img/pngs/darkmode-logo.png",
        },

        items: [
          {
            to: "/api",
            label: "API",
            position: "left",
          },
          {
            to: "/sdk",
            label: "SDKs",
            position: "left",
          },
          {
            to: "/sheets",
            label: "Sheets Add-On",
            position: "left",
          },
          {
            to: "/account",
            label: "Accounts & Billing",
            position: "left",
          },
          {
            type: "search",
            position: "right",
          },
          {
            type: "custom-UserProfile",
            position: "right",
          },
        ],
      },
      footer: {
        style: "light",
        copyright: `<div class="footer-custom-container" >
        <p>© ${new Date().getFullYear()} Market Data. All Rights Reserved</p>
        <div class="footer-custom">
        <a target="_blank" style="font-size:15px" href="https://www.trustpilot.com/review/www.marketdata.app">See our Reviews On TrustPilot</a>
        <a target="_blank" style="font-size:15px" href="https://www.marketdata.app/privacy/">Privacy Policy</a>
        <a target="_blank" style="font-size:15px" href="https://www.marketdata.app/terms/">Terms & Conditions</a>
        <a target="_blank" style="font-size:15px" href="https://www.marketdata.app/status/">System Status</a>
        </div>
        </div>`,
      },

      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
        // Every language used in a ``` fence that Prism does not bundle by
        // default has to be listed here, or the block renders as plain text
        // with no error -- the page still builds and still looks like a code
        // block, so nothing catches it but reading one. `csharp` was missing
        // while 99 fences used it. scripts/check-highlighting.js now fails
        // the build instead.
        additionalLanguages: ['json', 'http', 'php', 'bash', 'excel-formula', 'java', 'kotlin', 'groovy', 'csharp', 'powershell', 'batch', 'ini'],
      },
    }),
};

module.exports = config;
