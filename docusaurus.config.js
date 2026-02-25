// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require("prism-react-renderer").themes.github;
const darkCodeTheme = require("prism-react-renderer").themes.dracula;

require("dotenv").config();

/** @type {import('@docusaurus/types').Config} */
const config = {
  title:
    process.env.PROD == "true" ? "Market Data" : "Market Data Docs (dev)",
  tagline: "Complete Documentation For All Market Data Products & Services",

  url:
    process.env.PROD == "true"
      ? "https://www.marketdata.app/"
      : "https://www-staging.marketdata.app/",

  baseUrl: "/docs/",
  noIndex: process.env.PROD !== "true",
  onBrokenLinks: "ignore",
  onBrokenMarkdownLinks: "warn",
  favicon: "img/favicon.ico",

  organizationName: "marketdata",
  projectName: "documentation",

  headTags: [
    {
      tagName: "meta",
      attributes: {
        name: "algolia-site-verification",
        content: "BAA3BC0EFD344D0C",
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
        blog: false,
        theme: {
          customCss: require.resolve("./src/css/custom.css"),
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

  plugins: [
    [
      "@docusaurus/plugin-client-redirects",
      {
        redirects: [
          {
            from: "/api/troubleshooting/http-status-codes",
            to: "/api/troubleshooting",
          },
          {
            from: "/sheets/troubleshooting/common-error-messages",
            to: "/sheets/troubleshooting",
          },
          {
            from: "/api/universal-parameters/feed",
            to: "/api/universal-parameters/mode",
          },
          {
            from: "/sheets/automatic-refreshing",
            to: "/sheets/automatic-refresh",
          },
          {
            from: "/sheets/stockdata",
            to: "/sheets/stocks/stockdata",
          },
          {
            from: "/sheets/earnings",
            to: "/sheets/stocks/earnings",
          },
          {
            from: "/sheets/optiondata",
            to: "/sheets/options/optiondata",
          },
          {
            from: "/sheets/optionlookup",
            to: "/sheets/options/optionlookup",
          },
          {
            from: "/sheets/optionchain",
            to: "/sheets/options/optionchain",
          },
          {
            from: "/sheets/marketstatus",
            to: "/sheets/markets/marketstatus",
          },
        ],
      },
    ],
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
            href: "https://github.com/MarketDataApp/documentation",
            label: "GitHub",
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
        additionalLanguages: ['json', 'http', 'php', 'bash', 'excel-formula'],
      },
    }),
};

module.exports = config;
