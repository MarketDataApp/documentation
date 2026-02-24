/**
 * Context7 chat widget configuration.
 *
 * Each entry maps a URL pattern to a Context7 library. The first matching
 * entry wins — order matters when patterns overlap.
 *
 * To enable a new widget, uncomment its entry and update the library path
 * if needed. No other files need to change.
 */
const CONTEXT7_WIDGETS = [
  {
    pathPattern: /\/sdk\/py(\/|$)/,
    library: '/websites/marketdata_app_sdk_py',
    displayName: 'the Market Data Python SDK',
    placeholder: 'Ask about the Python SDK...',
  },
  {
    pathPattern: /\/sdk\/php(\/|$)/,
    library: '/websites/marketdata_app_sdk_php',
    displayName: 'the Market Data PHP SDK',
    placeholder: 'Ask about the PHP SDK...',
  },
  {
    pathPattern: /\/sdk\/go(\/|$)/,
    library: '/websites/marketdata_app_sdk_go',
    displayName: 'the Market Data Go SDK',
    placeholder: 'Ask about the Go SDK...',
  },
  {
    pathPattern: /\/sheets(\/|$)/,
    library: '/websites/marketdata_app_sheets',
    displayName: 'the Market Data Sheets Add-on',
    placeholder: 'Ask about the Sheets Add-on...',
  },
  {
    pathPattern: /\/api(\/|$)/,
    library: '/websites/marketdata_app_api',
    displayName: 'the Market Data API',
    placeholder: 'Ask about the Market Data API...',
  },
];

module.exports = CONTEXT7_WIDGETS;
