---
title: Optiondata
sidebar_position: 2
---

Fetches a current or historical option quote from Market Data.

## Sample Usage

    OPTIONDATA("AAPL230120C00150000")

    OPTIONDATA("AAPL230120C00150000", "bid")

    OPTIONDATA("AAPL230120C00150000", "ask", "1/1/2021", "1/31/2021")

    OPTIONDATA("AAPL230120C00150000", "all", TODAY()-30, 30)

## Syntax

    OPTIONDATA(optionSymbol, [attributes], startDate, endDate)

- **optionSymbol** _(REQUIRED)_ Use the current OCC option symbol format for the option symbol, even for historic options prior to the symbol format change in 2010.
- **attribute** _(OPTIONAL "price" by default)_ Use one of the following attributes:

  - "price", "mid", "mark" – The midpoint price of the option.
  - "bid" – The bid price of the option.
  - "ask" – The ask price of the option.
  - "last" – The last price of the option. Depending on the liquidity of the symbol, the last traded price could have occurred one second ago or one day ago.
  - "bidSize" – The quantity of contracts offered at the bid price.
  - "askSize" – The quantity of contracts offered at the ask price.
  - "volume" – The number of contracts negotiated during the day.
  - "openInterest" – The number of open contracts.
  - "underlyingPrice" – The price of the underlying ticker at the time of this option quote.
  - "underlyingPrice" – The price of the underlying security at the time of this option quote.
  - "inTheMoney" – Will return TRUE if the option contract was in the money at the time of the quote or FALSE if the contract was not in the money at the time of the quote.
  - "underlyingPrice" – The price of the underlying security at the time of this option quote.
  - "all" – Returns all values.
  - "noheaders" – Returns values without column headers.

- **startDate** _(OPTIONAL)_ – The start date when fetching historical data. If start date is specified, but endDate is not, only the single day’s data is returned.

- **endDate** _(OPTIONAL)_ – The end date when fetching historical data, or the number of calendar days (not trading days) from startDate for which to return data.

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
