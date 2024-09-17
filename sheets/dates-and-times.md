---
title: Dates and Times
sidebar_position: 7
---

All Market Data formulas support advanced date-handling features to allow you to work with dates in a way that works best for your spreadsheet. Formulas will accept any of the following date formats:

- **American Numeric Notation** Dates and times in MM/DD/YYYY format. For example, closing bell on Dec 30, 2020 for the NYSE would be: 12/30/2020 4:00 PM.

- **Timestamp** An ISO 8601 timestamp in the format YYYY-MM-DD. For example, closing bell on Dec 30, 2020 for the NYSE would be: 2020-12-30 16:00:00.

- **Unix** Dates and times in unix format (seconds after the unix epoch). For example, closing bell on Dec 30, 2020 for the NYSE would be: 1609362000.

- **Spreadsheet** Dates and times in spreadsheet format (days after the Excel epoch). For example, closing bell on Dec 30, 2020 for the NYSE would be: 44195.66667

- **Relative Dates and Times** Keywords or key phrases that indicate specific days, relative to the current date. For example, "today" or "yesterday".

- **Option Expiration Dates** Keyphrase that select specific dates that correspond with dates in the US option expiration calendar.


## Relative Dates and Times

Relative dates allow Market Data formulas to continually modify the date sent to the formula based on the current date. We have a lot of relative date keywords supported already and quite a few more planned for the future, so keep an eye out on this section for continual improvements to this feature.

- **Time-based Parameters** Time keyphrases let you select a specific time of day, relative to the current time. Time-based parameters are typically used to model intraday stock movements.

  - `now` The current time. Use this keyword to select the current open candle, for example. This is the same as the Google Sheets built-in formula `now()`. Please note that due to technical limitations by Google Sheets, `now()` cannot be embedded in or referenced by any Market Data formula. Use the `now` relative keyword as a replacement.

  - `-[number] minutes` Use negative minutes to specify a time in the past _n_ minutes before. When this is used alone, it is relative to the current time. When used in conjunction in `from` field (i.e. the starting date/time), it is relative to the `to` field (i.e. the ending date/time). For example, if the current time is 10:30 AM, but 10:00 AM is used in the `to` field and `-10 minutes` in the `from` field, then the starting time will be 9:50 AM. The query would return values from 9:50 AM to 10:00 AM. However, if the `to` field were to be omitted, then the same query would return data from 10:20 AM to 10:30 AM since `-10 minutes` would be relative to the current time of 10:30 AM.
  
  - `[number] minutes ago` The `minutes ago` keyword lets you select a relative time, _n_ minutes before the current time. For example, if the time is 10:00 AM then `30 minutes ago` would refer to 9:30 AM of the current day.
 
  - `-[number] hours` Use negative hours to specify a time in the past _n_ hours before. When this is used alone, it is relative to the current time. When used in conjunction in `from` field (i.e. the starting date/time), it is relative to the `to` field (i.e. the ending date/time). For example, if the current time is 10:30 AM, but 10:00 AM is used in the `to` field and `-1 hour` in the `from` field, then the starting time will be 9:00 AM. The query would return values from 9:00 AM to 10:00 AM. However, if the `to` field were to be omitted, then the same query would return data from 9:30 AM to 10:30 AM since `-1 hour` would be relative to the current time of 10:30 AM.
    
  - `[number] hours ago` The `hours ago` keyword lets you select a relative time, _n_ hours before the current time. For example, if the time is 4:00 PM then `4 hours ago` would refer to 12:00 PM of the current day.

- **Daily Parameters** Daily keyphrases let you select a specific day, relative to the current day.

  - `today` Equivalent to today's date. This keyword can be used interchangeably with Sheets' built-in formula `today()`.

  - `yesterday` Yesterday's date. The same as Sheets formula `today()-1`.
 
  - `-[number] days` Use negative days to specify a time in the past _n_ days before. When this is used alone, it is relative to the current day. When used in conjunction in `from` field (i.e. the starting date), it is relative to the `to` field (i.e. the ending date). For example, if the current date is January 20, but January 10 is used in the `to` field and `-5 days` in the `from` field, then the starting day will be January 5. The query would return values from January 5 to January 10. However, if the `to` field were to be omitted, then the same query would return data from January 15 to January 20 since `-5 days` would be relative to the current date of January 20.

  - `[number] days ago` The `days ago` keyword lets you select a relative day, _n_ days before the current date. For example, if today is January 5, 2024, then using `2 days ago` would select the date January 3, 2024.
 
- **Weekly Parameters** Weekly keyphrases let you select a day of the week in the current, previous, or following week.

  - `-[number] weeks` Use negative weeks to specify a date in the past _n_ weeks before. When this is used alone, it is relative to the current day. When used in conjunction in `from` field (i.e. the starting date), it is relative to the date in the `to` field (i.e. the ending date). For example, if the current date is October 15, 2023 but October 8 is used in the `to` field and `-1 week` in the `from` field, then the starting day will be October 2, 2023. The query would return values from October 2 to October 8. However, if the `to` field were to be omitted, then the same query would return data from October 9 to October 15 since `-5 days` would be relative to the current date of January 20.

  - `[number] weeks ago` The `weeks ago` keyword lets you select a relative week, _n_ weeks before the current date. For example, if today is January 1, 2024, then using `2 weeks ago` would select the date January 3, 2024.

- **Monthly Dates** Monthly keyphrases let you select a specific day of a specific month.

  - `-[number] months` Use negative months to specify a date in the past _n_ months before. When this is used alone, it is relative to the current day. When used in conjunction in `from` field (i.e. the starting date), it is relative to the date in the `to` field (i.e. the ending date). For example, if the current date is October 15 but October 8 is used in the `to` field and `-1 month` in the `from` field, then the starting day will be September 8. The query would return values from September 8 to October 8. However, if the `to` field were to be omitted, then the same query would return data from September 15 to October since `-1 month` would be relative to the current date of October 15.

  - `[number] months ago` The months ago keyword lets you select a relative date, _n_ months before the current date. For example, if today is January 5, 2024, then using `3 months ago` would select the date October 5, 2023.

- **Yearly Dates** Yearly keyphrases let you select a specific day of in the current, previous, or following year.

  - `-[number] years` Use negative months to specify a date in the past _n_ years before. When this is used alone, it is relative to the current day. When used in conjunction in `from` field (i.e. the starting date), it is relative to the date in the `to` field (i.e. the ending date). For example, if the current date is October 15, 2023 but October 8, 2023 is used in the `to` field and `-1 year` in the `from` field, then the starting day will be September 8, 2022. The query would return values from September 8, 2022 to October 8, 2023. However, if the `to` field were to be omitted, then the same query would return data from September 15, 2022 to October 15, 2023 since `-1 year` would be relative to the current date of October 15, 2023.

  - `[number] years ago` The years ago keyword lets you select a relative date, 365 days before the current date. For example, if today is January 5, 2024, then using `2 years ago` would select the date January 5, 2022.

:::caution Coming Soon

The following relative date parameters are planned for the future and have not yet been implemented.

:::

- **Time-based Parameters** Time keyphrases let you select a specific time of day, relative to the current time. Time-based parameters are typically used to model intraday stock movements.

  - `at open`, `opening bell`, `market open` These keyphrases let you select the opening time for the market day. The phase is relative to each exchange's opening time. For example, if you were trading AAPL in the United States, using `at open` would set a time of 9:30 AM ET. 

  - `at close`, `closing bell`, `market close` These keyphrases let you select the closing time for the market day. The phase is relative to each exchange's closing time. For example, if you were trading AAPL in the United States, using `at close` would set a time of 4:00 PM ET.

  - `[number] [minutes|hours] before [open|close]` These before keyword lets you select a relative time before market open or close. For example `30 minutes before close` would select the time 3:30 PM ET if you are trading a stock on a U.S. exchange.

  - `[number] [minutes|hours] after [open|close]` These after keyword lets you select a relative time after market open or close. For example `1 hour after open` would select the time 10:30 AM ET if you are trading a stock on a U.S. exchange.

- **Weekly Parameters** Weekly keyphrases let you select a day of the week in the current, previous, or following week.

  - `this [day of the week]` Works the same way as specifying the day without adding _this_. The day in the _current_ week. For example, if today is Tuesday and the expression is `this Monday`, the date returned would be yesterday. If the expression were `this Wednesday` the date returned would be tomorrow. The word _this_ is optional. If it is omitted, the keyword will still return the date in the current week that corresponds with the day mentioned.

  - `last [day of the week]` The day in the _previous_ week. For example, if today is Tuesday and the expression used is `last Monday`, it would not refer to the Monday that occurred yesterday, but the Monday 8 days prior that occurred in the previous week.

  - `next [day of the week]` The day in the _following_ week. For example, if today is Monday and the expression is `next Tuesday` it would not refer to tomorrow, but the Tuesday that occurs 8 days from now.

- **Monthly Dates** Monthly keyphrases let you select a specific day of a specific month.

  - `[ordinal number] of [the|this] month` - The nth day of the current month. For example, if today is September 10th and the phrase used is, `8th of this month` the date returned would be September 8. The keyphrase `of [the/this] month` is optional. Using a single ordinal number `8th` will also return the 8th of the current month.

  - `[ordinal number] of last month` - The nth day of the current month. For example, if today is December 15th and the phrase used is, `8th of last month` the date returned would be November 8.

  - `ordinal number] of next month` - The nth day of the following month. For example, if today is December 15th and the phrase used is, `8th of next month` the date returned would be January 8 of the following year.

  - `last day of [the|this|last|next] month` - Using the `last day of` keyword will always select the final day of the month. Since months can end on the 28th, 29th, 30th, or 31st, this keyword allows you to always select the final day of a month. For example: `last day of this month`, `last day of next month`. It can also be used to select the last day in February without needing to determine whether the current year is a leap year, `last day of february`.

  - `ordinal number] [day of the week] of [the|this|last|next] month` - Combine ordinal numbers and weekdays to specify a specific day of the week in the current, previous, or following month. For example, ``3nd Friday of last month``.

  - `last [day of the week] of [the|this|last|next] month` - Selects the last day of the week in a month relative to the current month. If the last Monday of the month is needed, instead of using the keyphrase `4th Monday of this month`, it is safer to use `last Monday of this month`, since months can have 4 or 5 Mondays, depending on length. 

  - `last [day of the week] in [month` - Selects the last day of the week in a specific month. For example, Memorial Day could be selected by using the keyphrase `last Monday in May`.

- **Yearly Dates** Yearly keyphrases let you select a specific day of in the current, previous, or following year.

  - `[month] [number]` A specific date in the current year. For example `February 18` would return February 18 of the current year.

  - `[month] [number] [this|last|next] year` A specific date in the current, previous, or following year. For example, if today was Dec 31, 2022, `February 18 next year` would return February 18, 2023.

## Option Expiration Dates

Option expiration dates let you target the expiration dates for option contracts. Dates are based on the US option expirations calendar and are only meant for use with US markets.

:::caution

Option date parameters are planned for the future and have not yet been implemented.

---

Option-related keyphrases cannot be used to return expiration dates far in the future for options which have not yet been traded or for options in the past which have already expired. For example, if today is January 15, 2023, you couldn't use `November 2023's 1st weekly expiration` since weekly options for November would not exist yet. The formula will return a `No data` response if you try to request an expiration that does not exist, whether in the future or the past.

:::

- **Monthly Expirations** - Target a relative month or specific month's option expiration date.

  - `[month] [year] expiration` - The standard monthly option expiration date for [month] during [year]. This is useful for targeting the expiration date for a specific month. Although options normally expire the 3rd Friday, sometimes market holidays can modify this schedule. Using an option expiration keyphrase will ensure that you always obtain the exact date that options expire in a specific month. For example, if today was January 1, 2022, using `December expiration` or `December 2022 expiration` would both return _December 16, 2022_. 

    - [year] is optional. If [month] is used without [year] the lookup is relative to the current date and expired options will not be returned. For example, if today is April 8, 2022, `January expiration` will return January 20, 2023 and not the options which expired in January of 2022.

  - `this|last|next] month's expiration` - Returns the monthly option expiration date for the current, previous, or following month relative to the current month. For example if today is October 5, 2022, and `next month's expiration` is used, the date returned would be _November 18, 2022_.

:::tip

Not all underlying tickers offer weekly or quarterly options. Before building a spreadsheet that uses them, ensure that your underlying offers weekly or quarterly option contracts.

:::

- **Weekly Expirations** - Target a relative week or specific week's option expiration date.

  - `[this|last|next] week's expiration` - Returns the weekly option expiration date for the current, previous, or following week relative to the current week. For example if today is October 5, 2022, and `next week's expiration` is used, the date returned would be _October 14, 2022_.

  - `expiration in [number] weeks` - Returns closest expiration that will occur [number] weeks from today without taking into account the current week. For example, if today is August 1, 2022 the phrase `expiration in 6 weeks` would return September 16, 2022.

  - `[month] [year] [ordinal number] weekly expiration` - Returns the nth option expiration date for [month] during [year]. When both a month and year are combined, this can be used to lookup a weekly option date for an expired or unexpired option. For example, `March 2020's 2nd expiration` would return _March 14, 2020_.

- **Quarterly Expirations** - Returns a quarterly expiration date for a relative date or specifically targeted date.

  - `[ordinal number] quarter's expiration` - Returns the quarterly option expiration date for the 1st, 2nd, 3rd, or 4th quarter in the current financial year. For example if today is March 1, 2022, and `4th quarter's expiration` is used, the date returned would be _December 30, 2022_. This will lookup both expired and unexpired options.

  - `[this|last|next] quarter's expiration` - Returns the quarterly option expiration date for the current, previous, or following quarter relative to the current date. For example if today is March 1, 2022, and `this quarter's expiration` is used, the date returned would be _March 31, 2022_.

  - `[expiration in [number] quarters` - Returns closest quarterly expiration that will occur [number] quarters from today without taking into account the current quarter. For example, if today is March 1, 2022 the phrase `expiration in 2 quarters` would return September 30, 2022.

  - `[year] [ordinal number] quarter expiration` - Returns the option expiration date for [nth] quarter during [year]. For example, `2020's 2nd quarter expiration` would return _June 30, 2020_.

- **Specific Contract Expirations** - Target a specific date based on when a contract is first traded or when it expires.

  - `at expiration` - Returns the expiration date for the option contract. This must be used in the context of a specific option contract. For example, if you used at expiration with AAPL230120C00150000, the date returned would be January 20, 2023.

  - `first traded` - Returns the date when the contract was traded for the first time. This must be used in the context of a specific option contract. For example, if you used first traded with AAPL230120C00150000, the date returned would be September 14, 2020.
