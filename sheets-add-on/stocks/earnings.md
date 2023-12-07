---
title: EARNINGS
sidebar_position: 3
---

:::info Premium Endpoint
This endpoint can only be used with paid plans. Free plans or trial plans will not work.
:::

Fetches current or historical earnings data for a stock ticker.

## Sample Usage

    EARNINGS("AAPL")
    EARNINGS("AAPL", "all,noheaders")
    EARNINGS("AAPL", "year,quarter,eps,eps surprise", "1/1/2021", "12/31/2021")

## Syntax

    EARNINGS(symbol, [attributes], start date, end date)

- **symbol** _(REQUIRED)_ The stock’s ticker symbol.

- **[attributes]** _(OPTIONAL)_ Use one or more attributes to customize the response:
  - "symbol" – The ticker symbol for the stock.
  - "year" – The fiscal year for the earnings report.
  - "quarter" – The fiscal quarter for the earnings report.
  - "date" – The date of the earnings report. This is usually expressed as the last day of the quarter.
  - "report date" – The date the company reported the earnings.
  - "report time" - The time the company plans to report earnings.
  - "currency" - The currency earnings are reported in.
  - "reported eps" - The earnings per share reported by the company.
  - "estimated eps" - The estimated earnings per share by Wall Street.
  - "surprise eps" - The difference in eps between Wall Street and the actual earnings report.
  - "surprise eps percent" - The difference in percentage terms between the reported EPS and estimated EPS.
  - "updated" - The date and time the earnings data for this ticker was lasted refreshed.
  - "all" – Returns all values.

- **start date** _(OPTIONAL)_ The start date when fetching data. If start date is specified, but end date is not, only the single day’s data is returned.

- **end date** _(OPTIONAL)_ The end date when fetching data, or the number of calendar days (not trading days) from start date for which to return data.

## Notes

Non-GAAP earnings are reported for most tickers. If the company does not report non-GAAP earnings, GAAP earnings will be used instead.
