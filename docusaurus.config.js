const { REDIRECTS } = require("./redirects");

// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require("prism-react-renderer").themes.github;
const darkCodeTheme = require("prism-react-renderer").themes.dracula;

require("dotenv").config();

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
                ignorePatterns: ["/tags/**"],
                filename: "sitemap.xml",
              }
            : {},
      }),
    ],
  ],

  clientModules: [
    './src/clientModules/themeCookieSync.js',
    './src/clientModules/navbarOverflow.js',
  ],

  plugins: [
    './plugins/theme-cookie-sync',
    './plugins/markdown-twins',
    './plugins/not-found-head',
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
