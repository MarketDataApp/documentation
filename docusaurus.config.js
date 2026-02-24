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
      : "https://www.marketdata.app/",

  baseUrl: process.env.PROD == "true" ? "/docs/" : "/docs-staging/",
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
        content: "20865DD38D745690",
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
          const branch = process.env.PROD == "true" ? "main" : "dev";
          return `https://raw.githubusercontent.com/MarketDataApp/documentation/${branch}/api/${docPath}`;
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
          const branch = process.env.PROD == "true" ? "main" : "dev";
          return `https://raw.githubusercontent.com/MarketDataApp/documentation/${branch}/sdk/${docPath}`;
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
          const branch = process.env.PROD == "true" ? "main" : "dev";
          return `https://raw.githubusercontent.com/MarketDataApp/documentation/${branch}/sheets/${docPath}`;
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
          const branch = process.env.PROD == "true" ? "main" : "dev";
          return `https://raw.githubusercontent.com/MarketDataApp/documentation/${branch}/account/${docPath}`;
        },
        sidebarPath: require.resolve("./sidebars.js"),
      },
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      algolia: {
        apiKey: "61b9ada0eff725c3350523c78c53917d",
        appId: "XRC74FGPQA",
        indexName: "prod_index",
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
