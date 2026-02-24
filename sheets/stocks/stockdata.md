---
title: STOCKDATA
sidebar_position: 1
tags:
  - "Sheets: High Usage"
sidebar_custom_props:
  badge: h
---

Fetches a current stock quote or historical stock candles from Market Data. It can also fetch a single historical candle for multiple stocks.

## Sample Usage For Quotes
```excel-formula
=STOCKDATA("AAPL")
```
### Bulk Quotes
```excel-formula
=STOCKDATA("AAPL,MSFT,TSLA")
=STOCKDATA("AAPL,MSFT,TSLA", "all")
=STOCKDATA(A1:A500, "bid,ask,last")
```

## Sample Usage For Candles
```excel-formula
=STOCKDATA("AAPL", "close", "1/1/2021", "1/31/2021", "hourly")
=STOCKDATA("AAPL", "all", TODAY()-30, 30)
```
### Bulk Candles
```excel-formula
=STOCKDATA("AAPL,MSFT,TSLA", "all", "today")
=STOCKDATA("AAPL,MSFT,TSLA", "all", "12/20/2023")
=STOCKDATA(A1:A3, "all", "12/20/2023")
```
## Syntax
```excel-formula
=STOCKDATA(symbols, [historial attributes|quote attributes], start date, end date, resolution)
```
- **symbols** _(REQUIRED)_ One or more ticker symbols for the stocks.

- **[historial attributes | quote attributes]** _(Optional)_ Use a historical or quote attribute:

  - **"price"** _(OPTIONAL)_ Special dual-mode quote/candle attribute.
    - Displays the midpoint price during the regular and sessions.
    - Displays the closing price of the previous session outside of market hours.

  - **historical attributes** _(OPTIONAL – "close" by default)_ Use one of the following attributes when requesting historical candles:
    - "open" – The opening price of the stock.
    - "high" – The high price of the stock.
    - "low" – The low price of the stock.
    - "close" – The closing price of the stock.
    - "volume" – The number of shares traded.
    - "all" – Returns all values.
    - "symbol" - The ticker symbol of the stock. _Only returned when using a bulk candles formula._ 
    - "adjusted" - Adjust intraday data for splits. 
    - "unadjusted" - Do not adjust daily data for splits.

  - **quote attributes** _(OPTIONAL – "mid" by default)_ Use one of the following attributes when requesting a quote:
    - "mid", "mark" – The midpoint price of the stock.
    - "bid" – The bid price of the stock.
    - "ask" – The ask price of the stock.
    - "last" – The last price of the stock.
    - "bidSize" – The quantity of shares offered at the bid price.
    - "askSize" – The quantity of shares offered at the ask price.
    - "volume" – The quantity of shares traded.
    - "symbol" - The ticker symbol of the stock. _Only returned when using a bulk quotes formula._ 
    - "all" – Returns all values.

- **start date** _(OPTIONAL)_ The start date when fetching historical data. If start date is specified, but endDate is not, only the single day’s data is returned. Multiple tickers may be used if only a single day's data is being returned.

- **end date** _(OPTIONAL)_ The end date when fetching historical data, or the number of calendar days (not trading days) from startDate for which to return data.

- **resolution** _(OPTIONAL)_ The duration of each candle when fetching historical candles. Daily resolution is default if no value is specified. Use one of the following resolutions:
  - Minutely Resolutions: (_minutely_, _1_, _3_, _5_, _15_, _30_, _45_, ...)
  - Hourly Resolutions: (_hourly_, _H_, _1H_, _2H_, ...)
  - Daily Resolutions: (_daily_, _D_, _1D_, _2D_, ...)
  - Weekly Resolutions: (_weekly_, _W_, _1W_, _2W_, ...)
  - Monthly Resolutions: (_monthly_, _M_, _1M_, _2M_, ...)
  - Yearly Resolutions: (_yearly_, _Y_, _1Y_, _2Y_, ...)

## Price vs Close vs Last vs Mid

When you are looking for a single price for a stock, depending on what data you would like the `STOCKDATA` formula to return during the extended session (or when the market is closed), it may make sense to use the "close", "last", or "mid" attributes instead of STOCKDATA's default "price" attribute.

| Function Call                     | During The Regular Session               | During The Extended Session              | Market Closed, Holidays, etc.                 |
|-----------------------------------|------------------------------------------|------------------------------------------|-----------------------------------------------|
| `=STOCKDATA("AAPL")`              | Midpoint bid/ask of the regular session  | Midpoint bid/ask of the extended session | Closing price of the previous regular session |
| `=STOCKDATA("AAPL", "PRICE")`     | Midpoint bid/ask of the regular session  | Midpoint bid/ask of the extended session | Closing price of the previous regular session |
| `=STOCKDATA("AAPL", "CLOSE")`     | Last trade of the regular session        | Closing price of the previous session    | Closing price of the previous regular session |
| `=STOCKDATA("AAPL", "LAST")`      | Last trade of the regular session        | Last trade of the extended session       | Last trade of the previous extended session   |
| `=STOCKDATA("AAPL", "MID")`       | Midpoint bid/ask of the regular session  | Midpoint bid/ask of the extended session | No data                                       |

## Usage Information

### Data Availability

The `STOCKDATA` function can return both quotes and candles, depending on whether date parameters are specified. The data type you receive depends on your user type and exchange entitlements.

:::info What are entitlements?
Entitlements are permissions granted by exchanges that allow access to their data. To get quotes, users need to sign the [IEX agreement](/account/entitlements). To get candles, users need to sign the [UTP agreement](/account/entitlements). [Learn more about entitlements](/account/entitlements).
:::

#### Quotes (No Date Parameters)

When you use `STOCKDATA` without date parameters, it returns quote data. The type of quote you receive depends on your user type and IEX entitlement. This may include a real-time quote, a 15-minute delayed quote or historical (1 day old) quote, depending on the plan or access level. Real-time quotes are not currently available.

| User Type | IEX Entitlement | Quote Type |
|-----------|----------------|------------|
| Non-Professional | ✅ | Real-time |
| Non-Professional | ❌ | 15-min delayed |
| Professional | ✅ | Real-time |
| Professional | ❌ | Historical (1 day old) |
| Unknown | ✅ | Real-time |
| Unknown | ❌ | Historical (1 day old) |

#### Current Day Candles

When you use `STOCKDATA` with date parameters to request candles from the current trading session (today), you receive current day candle data. **Real-time candle data is not available for candles under any plan or entitlement.** The type of candle data you receive depends on your user type and UTP entitlement. This may include 15-minute delayed candles or historical candles (1 day old), depending on the plan or access level.

| User Type | UTP Entitlement | Candle Type |
|-----------|----------------|-------------|
| Non-Professional | ✅ | 15-min delayed |
| Non-Professional | ❌ | 15-min delayed |
| Professional | ✅ | 15-min delayed |
| Unknown | Any | Historical (1 day old) |

#### Historical Candles

When you use `STOCKDATA` with date parameters to request candles from past dates, you receive historical candle data. Historical candles can use any resolution (intraday, daily, weekly, etc.) from past trading sessions. **Historical data is available to all users regardless of exchange entitlements.** However, the age of historical data you can access depends on your plan:

| Plan | Historical Data Availability |
|------|------------------------------|
| Free Forever | 1 year |
| Trial Plans (Starter, Trader) | 1 year |
| Starter | 5 years |
| Trader, Quant, Prime | No limit (full access) |

:::info Plan Limits
If you attempt to access historical data older than your plan's limit permits, the formula will return an error. [Learn more about plan limits](/account/plan-limits).
:::

## Notes
- All parameters must be enclosed in quotation marks or be references to cells containing text. A possible exception is when endDate is specified as a number of days.
- Results with a single data point will be returned as a value within a single cell. Multiple data points will be returned as an expanded array with column headers.
- If any date parameters are specified, the request is considered historical and only the historical attributes are allowed.
- Dates and times are returned in the same timezone of the exchange.
- When writing bulk candles formulas, only a single date is allowed. Date ranges are not permitted. Only daily candles are supported for bulk candles.