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
        sidebarPath: require.resolve("./sidebars.js"),
      },
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
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
        additionalLanguages: ['json', 'http', 'php', 'bash', 'excel-formula', 'java', 'kotlin', 'groovy'],
      },
    }),
};

module.exports = config;
