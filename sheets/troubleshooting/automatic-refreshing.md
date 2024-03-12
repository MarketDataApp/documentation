---
title: Automatic Refreshing
sidebar_position: 7
---

The WebSocket protocol is the technology used to deliver streaming quotes, such as the ones provided by your broker platform. Unfortunately, Google Workspace Add-ons do not yet offer support for WebSockets. This is why no Google Sheets Add-on has been able to deliver a product that supports streaming quotes.

Please be aware that this workaround is not officially supported by Market Data.

## Refresh Button

Market Data has provided a refresh button in the sidebar to allow customers to refresh whenever needed. We understand some customers would like to use streaming quotes, but that is impossible due to Google Sheets limitations.

## Workaround

There is a workaround that allows your formulas to update every 2-minutes. You can embed the result of the **GOOGLEFINANCE** formula as a column attribute in any of our formulas. Please be aware that during the standard session, this will consume 195 credits for each formula you prepare in this way.

:::warning
Google Sheets has a hard limit of 20,000 [urlfetch](/sheets/troubleshooting/urlfetch) requests per day. Even if you are on a Trader plan and have 100,000 credits, Google will not allow you to make more than 20,000 requests.
:::

### Example Formulas

Place `=GOOGLEFINANCE("AAPL")` in a cell somewhere in your workbook. For this example, we'll assume it is in cell A1.

```excel-formula
=OPTIONDATA("AAPL260116C00150000","all,"&A1)
=STOCKDATA("AAPL","all,"&A1)
=INDEXDATA("VIX","all,"&A1)
```

#### Why Is GOOGLEFINANCE Needed?

The GOOGLEFINANCE formula is a special formula that updates once every two minutes. By using it as a parameter in a Market Data formula, you force the Market Data formula to refresh itself every two minutes without the need to press the refresh button manually.

#### Why Can't Market Data Formulas Do This Automatically?

Google Sheets places strict limits on the ability of third party developers such as Market Data. Google does not give us the ability to make your formulas refresh automatically. However, by using this workaround, we can trigger a refresh every 2-minutes as GOOGLEFINANCE updates.