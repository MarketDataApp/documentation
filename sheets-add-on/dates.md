---
title: Dates
sidebar_position: 3
---

All Market Data formulas support advanced date-handling features to allow you to work with dates in a way that works best for your spreadsheet. Formulas will accept any of the following date formats:

- **American Numeric Notation** Dates and times in MM/DD/YYYY format. For example, closing bell on Dec 30, 2020 for the NYSE would be: 12/30/2020 4:00 PM.

- **Timestamp** An ISO 8601 timestamp in the format YYYY-MM-DD. For example, closing bell on Dec 30, 2020 for the NYSE would be: 2020-12-30 16:00:00.

- **Unix** Dates and times in unix format (seconds after the unix epoch). For example, closing bell on Dec 30, 2020 for the NYSE would be: 1609362000.

- **Spreadsheet** Dates and times in spreadsheet format (days after the Excel epoch). For example, closing bell on Dec 30, 2020 for the NYSE would be: 44195.66667

- **Relative Dates** Keywords or key phrases that indicate specific days, relative to the current date. For example, "today" or "yesterday".


## Relative Dates

The only keywords currently supported are _today_ and _yesterday_.

    STOCKDATA("AAPL")

    STOCKDATA("AAPL", "open")

    STOCKDATA("AAPL", "close", "1/1/2021", "1/31/2021", "hourly")

    STOCKDATA("AAPL", "all", TODAY()-30, 30)

## Syntax

    STOCKDATA(symbol, [historial attribute|quote attribute], startDate, endDate, resolution)

- **symbol** _(REQUIRED)_ The stock’s ticker symbol.

- **[historial attributes | quote attributes]** _(Optional)_ Use a historical or quote attribute:

  - **historical attributes** _(OPTIONAL – "close" by default)_ Use one of the following attributes when requesting historical candles:

    - "open" – The opening price of the stock.
    - "high" – The high price of the stock.
    - "low" – The low price of the stock.
    - "close" – The closing price of the stock.
    - "volume" – The number of shares traded.
    - "all" – Returns all values.

  - **quote attributes** _(OPTIONAL – "mid" by default)_ Use one of the following attributes when requesting a quote:
    - "price", "mid", "mark" – The midpoint price of the stock.
    - "bid" – The bid price of the stock.
    - "ask" – The ask price of the stock.
    - "last" – The last price of the stock.
    - "bidSize" – The quantity of shares offered at the bid price.
    - "askSize" – The quantity of shares offered at the ask price.
    - "volume" – The quantity of shares traded.
    - "all" – Returns all values.

- **startDate** _(OPTIONAL)_ The start date when fetching historical data. If start date is specified, but endDate is not, only the single day’s data is returned.

- **endDate** _(OPTIONAL)_ The end date when fetching historical data, or the number of calendar days (not trading days) from startDate for which to return data.

- **resolution** _(OPTIONAL)_ The duration of each candle when fetching historical candles. Daily resolution is default if no value is specified. Use one of the following resolutions:
  - Minutely Resolutions: (_minutely_, _1_, _3_, _5_, _15_, _30_, _45_, ...)
  - Hourly Resolutions: (_hourly_, _H_, _1H_, _2H_, ...)
  - Daily Resolutions: (_daily_, _D_, _1D_, _2D_, ...)
  - Weekly Resolutions: (_weekly_, _W_, _1W_, _2W_, ...)
  - Monthly Resolutions: (_monthly_, _M_, _1M_, _2M_, ...)
  - Yearly Resolutions: (_yearly_, _Y_, _1Y_, _2Y_, ...)

## Notes

:::info Notes

All parameters must be enclosed in quotation marks or be references to cells containing text. A possible exception is when endDate is specified as a number of days.

---

Real-time or current day results will be returned as a value within a single cell unless specific attributes are requested. Historical data, even for a single day, will be returned as an expanded array with column headers.

---

If any date parameters are specified, the request is considered historical and only the historical attributes are allowed.

---

Dates and times are returned in the same timezone of the exchange.

:::
