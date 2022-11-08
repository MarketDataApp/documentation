---
title: INDEXQUOTE
sidebar_position: 3
---

Fetches a real-time index price from Market Data.

## Sample Usage

    INDEXQUOTE("SPX")
    INDEXQUOTE("SPX", "all")
    INDEXQUOTE("DJI,NDX,SPX")
    INDEXQUOTE(A1:C1, "all")

## Syntax

    INDEXQUOTE(symbol, attribute)

- **symbol** _(REQUIRED)_ The index symbol, without any leading or trailing index identifiers. For example, use DJI do not use $DJI, ^DJI, .DJI, DJI.X, etc.
- **attribute** _(OPTIONAL – "mid" by default)_ Use one or more of the following attributes when requesting a quote:
    - `"price"`, `"mid"`, `"mark"`, `"last"` – The current price of the index.
    - `"date"` - The date/time of the index quote.
    - `"all"` – Returns all values.

## Notes

:::info

All parameters must be enclosed in quotation marks or be references to cells containing text. A possible exception is when endDate is specified as a number of days.

---

Results will be returned as a value within a single cell if only one attribute is requested.

---

Dates and times are returned in the same timezone of the exchange.

:::
