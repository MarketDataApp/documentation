// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require("prism-react-renderer/themes/github");
const darkCodeTheme = require("prism-react-renderer/themes/dracula");

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "MarketData API Docs",
  tagline:
    "Real-Time & Historic Data For Stocks, Options, Crypto, Futures, Forex",
  url: "https://your-docusaurus-test-site.com",
  baseUrl: "/",
  onBrokenLinks: "throw",
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
        },
        blog: false,
        theme: {
          customCss: require.resolve("./src/css/custom.css"),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: "",
        logo: {
          alt: "My Logo",
          src: "img/logo.png",
          // href: "https://www.marketdata.app/",
          href: "/",
          // target: "_blank",
        },
        items: [
          // {
          //   type: "doc",
          //   docId: "intro",
          //   position: "left",
          //   label: "Documentation",
          // },
          // { to: "/blog", label: "Blog", position: "left" },
          // {
          //   href: "https://github.com/facebook/docusaurus",
          //   label: "GitHub",
          //   position: "right",
          // },
        ],
      },
      footer: {
        style: "dark",
        links: [
          {
            title: "More",
            items: [
              {
                label: "Previews On TrustPilot",
                href: "https://www.trustpilot.com/review/www.marketdata.app",
              },
              {
                label: "Privacy Policy",
                href: "https://www.marketdata.app/privacy",
              },
              {
                label: "Terms & Conditions",
                href: "https://www.marketdata.app/terms",
              },
              {
                label: "System Status",
                href: "https://stats.uptimerobot.com/6Kv3zIow0A",
              },
            ],
          },
        ],
        logo: {
          alt: "MarketData Logo",
          src: "/img/logo.png",
          href: "https://www.marketdata.app/",
          width: "300px",
          target: "_blank",
        },
        copyright: `Copyright © ${new Date().getFullYear()} MarketData API Docs, Inc. All Rights Reserved.`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
    }),
};

module.exports = config;
