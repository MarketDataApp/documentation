// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require("prism-react-renderer/themes/github");
const darkCodeTheme = require("prism-react-renderer/themes/dracula");

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "MarketData API Docs",
  tagline:
    "Real-Time & Historic Data For Stocks, Options, Crypto, Futures, Forex",
  url: "https://marketdatav1.vercel.app",
  baseUrl: "/",
  onBrokenLinks: "ignore",
  onBrokenMarkdownLinks: "warn",
  favicon: "img/favicon.ico",

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: "facebook", // Usually your GitHub org/user name.
  projectName: "docusaurus", // Usually your repo name.

  // Even if you don't use internalization, you can use this field to set useful
  // metadata like html lang. For example, if your site is Chinese, you may want
  // to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve("./sidebars.js"),
          routeBasePath: "/",
          editUrl:
            "https://github.com/AhmedCoolProjects/marketdata-work-fiverr/tree/main",
        },
        blog: false,
        theme: {
          customCss: require.resolve("./src/css/custom.css"),
        },

        sitemap: {
          changefreq: "weekly",
          priority: 0.5,
          ignorePatterns: ["/tags/**"],
          filename: "sitemap.xml",
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
        editUrl:
          "https://github.com/AhmedCoolProjects/marketdata-work-fiverr/tree/main",
      },
    ],
    [
      "@docusaurus/plugin-content-docs",
      /** @type {import('@docusaurus/plugin-content-docs').Options} */
      {
        id: "sheets-add-on",
        path: "sheets-add-on",
        routeBasePath: "sheets-add-on",
        editUrl:
          "https://github.com/AhmedCoolProjects/marketdata-work-fiverr/tree/main",

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
        editUrl:
          "https://github.com/AhmedCoolProjects/marketdata-work-fiverr/tree/main",

        sidebarPath: require.resolve("./sidebars.js"),
      },
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      algolia: {
        apiKey: "743236374ece371570e05b678e3671b4",
        appId: "2L8QIH6E44",
        indexName: "dev_marketdata_fiverr_1",
      },
      navbar: {
        title: "",
        logo: {
          alt: "My Logo",
          src: "img/pngs/logo.png",
          // href: "https://www.marketdata.app/",
          href: "/",
          // target: "_blank",
          srcDark: "img/pngs/darkmode-logo.png",
        },

        items: [
          {
            to: "/api/intro",
            label: "API",
            position: "left",
          },
          {
            to: "/sheets-add-on/help",
            label: "Sheets Add-On",
            position: "left",
          },
          {
            to: "/accounts-billing/intro",
            label: "Accounts & Billing",
            position: "left",
          },
          {
            type: "search",
            position: "right",
          },
          // { to: "/blog", label: "Blog", position: "left" },
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
