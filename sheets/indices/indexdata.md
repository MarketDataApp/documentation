---
title: INDEXDATA
sidebar_position: 1
---

Fetches a current or historical index price from Market Data.

## Sample Usage
```excel-formula
=INDEXDATA("SPX")
=INDEXDATA("SPX", "all")
=INDEXDATA("SPX", "close", "9/23/2022", "10/23/2022", "hourly")
=INDEXDATA("SPX", "all", TODAY()-30, 30)
```

## Syntax
```excel-formula
=INDEXDATA(symbol, [historial attribute|quote attribute], startDate, endDate, resolution)
```

- **symbol** _(REQUIRED)_ The index symbol, without any leading or trailing index identifiers. For example, use DJI do not use $DJI, ^DJI, .DJI, DJI.X, etc.

- **[historial attributes | quote attributes]** _(Optional)_ Use a historical or quote attribute:

  - **historical attributes** _(OPTIONAL – "close" by default)_ Use one of the following attributes when requesting historical candles:

    - `"open"` – The opening price of the index.
    - `"high"` – The high price of the index.
    - `"low"` – The low price of the index.
    - `"close"` – The closing price of the index.
    - `"date"` - The date/time of the candle.
    - `"all"` – Returns all values.

  - **quote attributes** _(OPTIONAL – "mid" by default)_ Use one of the following attributes when requesting a quote:
    - `"price"`, `"mid"`, `"mark"`, `"last"` – The price of the index.
    - `"date"` - The date/time of the index quote.
    - `"all"` – Returns all values.

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
- All parameters must be enclosed in quotation marks or be references to cells containing text. A possible exception is when endDate is specified as a number of days.
- Real-time or current day results will be returned as a value within a single cell unless specific attributes are requested. Historical data, even for a single day, will be returned as an expanded array with column headers.
- If any date parameters are specified, the request is considered historical and only the historical attributes are allowed.
- Dates and times are returned in the same timezone of the exchange.