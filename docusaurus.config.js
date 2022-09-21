// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require("prism-react-renderer/themes/github");
const darkCodeTheme = require("prism-react-renderer/themes/dracula");

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "Market Data Docs",
  tagline: "The Complete Reference For All Market Data Products & Services",
  url: "https://docs-staging.marketdata.app/",
  baseUrl: "/",
  onBrokenLinks: "ignore",
  onBrokenMarkdownLinks: "warn",
  favicon: "img/favicon.ico",

  organizationName: "marketdata",
  projectName: "documentation",

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
      }),
    ],
  ],

  plugins: [
    [
      "@docusaurus/plugin-content-docs",
      /** @type {import('@docusaurus/plugin-content-docs').Options} */
      {
        id: "api",
        path: "api",
        routeBasePath: "api",
        sidebarPath: require.resolve("./sidebars.js"),
        editUrl: "https://github.com/MarketDataApp/documentation/tree/dev",
      },
    ],
    [
      "@docusaurus/plugin-content-docs",
      /** @type {import('@docusaurus/plugin-content-docs').Options} */
      {
        id: "sheets-add-on",
        path: "sheets-add-on",
        routeBasePath: "sheets-add-on",
        editUrl: "https://github.com/MarketDataApp/documentation/tree/dev",

        sidebarPath: require.resolve("./sidebars.js"),
      },
    ],
    [
      "@docusaurus/plugin-content-docs",
      /** @type {import('@docusaurus/plugin-content-docs').Options} */
      {
        id: "accounts-billing",
        path: "accounts-billing",
        routeBasePath: "accounts-billing",
        editUrl: "https://github.com/MarketDataApp/documentation/tree/dev",

        sidebarPath: require.resolve("./sidebars.js"),
      },
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      algolia: {
        apiKey: "616ed612753f947f246c4b57617af1ac",
        appId: "TSE3E81M2L",
        indexName: "first_index",
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
            to: "/sheets-add-on",
            label: "Sheets Add-On",
            position: "left",
          },
          {
            to: "/accounts-billing",
            label: "Accounts & Billing",
            position: "left",
          },
          {
            type: "search",
            position: "right",
          },
          {
            href: "https://github.com/AhmedCoolProjects/marketdata-work-fiverr",
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
        <a target="_blank" style="font-size:15px" href="https://www.marketdata.app/privacy">Privacy Policy</a>
        <a target="_blank" style="font-size:15px" href="https://www.marketdata.app/terms">Terms & Conditions</a>
        <a target="_blank" style="font-size:15px" href="https://stats.uptimerobot.com/6Kv3zIow0A">System Status</a>
        </div>
        </div>`,
      },

      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
    }),
};

module.exports = config;
