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

Relative dates allow Market Data formulas to continually modify the date sent to the formula based on the current date. The only keywords currently supported at present are `today` and `yesterday`, but additional keywords and key phrases are planeed for the future.

- `today` Equivalent to today's date. This keyword can be used interchangably with Sheets' built-in formula `today()`.

- `yesterday` Yesterday's date. The same as Sheets formula `today()-1`.

:::caution Coming Soon

The following relative date parameters are planned for the future and have not yet been implemented.

:::

- **Weekly Parameters** Weekly keyphrases let you select a day of the week in the current, previous, or following week.
  - `this [day of the week]` Works the same way as specifying the day without adding _this_. The day in the _current_ week. For example, if today is Tuesday and the expression is `this Monday`, the date returned would be yesterday. If the expression were `this Wednesday` the date returned would be tomorrow. The word _this_ is optional. If it is omitted, the keyword will still return the date in the current week that corresponds with the day mentioned.

  - `last [day of the week]` The day in the _previous_ week. For example, if today is Tuesday and the expression used is `last Monday`, it would not refer to the Monday that occurred yesterday, but the Monday 8 days prior that ocurred in the previous week.

  - `next [day of the week]` The day in the _following_ week. For example, if today is Monday and the expression is `next Tuesday` it would not refer to tomorrow, but the Tuesday that ocurrs 8 days from now.

- **Monthly Dates** Monthly keyphrases let you select a specific day of a specific month.

  - **[ordinal number] of [the|this] month** - The nth day of the current month. For example, if today is September 10th and the phrase used is, `8th of this month` the date returned would be September 8. The keyphrase `of [the/this] month` is optional. Using a single ordinal number `8th` will also return the 8th of the current month.

  - **[ordinal number] of last month** - The nth day of the current month. For example, if today is December 15th and the phrase used is, `8th of last month` the date returned would be November 8.

  - **[ordinal number] of next month** - The nth day of the following month. For example, if today is December 15th and the phrase used is, `8th of next month` the date returned would be January 8 of the following year.

  - **last day of [the|this|last|next] month** - Using the `last day of` keyword will always select the final day of the month. Since months can end on the 28th, 29th, 30th, or 31st, this keyword allows you to always select the final day of a month. For example: `last day of this month`, `last day of next month`. It can also be used to select the last day in February without needing to determine wheether the current year is a leap year, `last day of february`.

  - **[ordinal number] [day of the week] of [the|this|last|next] month** - Combine ordinal numbers and weekdays to specify a specific day of the week in the current, previous, or following month. For example, ``3nd Friday of last month``.

  - **last [day of the week] of [the|this|last|next] month** - Selects the last day of the week in a month relative to the current month. If the last Monday of the month is needed, instead of using the keyphrase `4th Monday of this month`, it is safer to use `last Monday of this month`, since months can have 4 or 5 Mondays, depending on length. 

  - **last [day of the week] in [month]** - Selects the last day of the week in a specific month. For example, Memorial Day could be selected by using the keyphrase `last Monday in May`.

- **Yearly Dates** Yearly keyphrases let you select a specific day of in the current, previous, or following year.

  - **[month] [number]** A specific date in the current year. For example `Feburary 18` would return February 18 of the current year.

  - **[month] [number] [this|last|next] year** A specific date in the current, previous, or following year. For example, if today was Dec 31, 2022, `Feburary 18 next year` would return February 18, 2023.

- **Option Dates** Option-related dates let you target specific dates that are useful for options traders. Dates are based on the US option expirations calendar.

  - **[month] [year] expiration** - The standard monthly option expiration date for [month] during [year]. [year] is optional. This is useful for targeting the expiration date for a specific month. Although options normally expire the 3rd Friday, sometimes market holidays can modify this schedule. Using an option expiration keyphrase will ensure that you always obtain the exact date that options expire in a specific month. For example, if today was January 1, 2022, using `December expiration` or `December 2022 expiration` would both return _December 16, 2022_.

  - **[this|last|next] month's expiration** - Returns the monthly option expirate date for the current, previous, or following month relative to the current month. For example if today is October 5, 2022, and `next month's expiration` is used, the date returned would be _November 18, 2022_.




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
