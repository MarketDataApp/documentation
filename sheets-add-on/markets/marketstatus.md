---
title: MARKETSTATUS
sidebar_position: 1
---

Get the past, present, or future status for a stock market for a single date or multiple dates. The formula will respond with "open" for trading days or "closed" for weekends or market holidays.

## Sample Usage

    MARKETSTATUS()
    MARKETSTATUS("US","all","1/1/2022","12/31/2022")
    MARKETSTATUS("US","status","yesterday")

## Syntax

    MARKETSTATUS(country, [attributes], start date, end date)

- **country** _(OPTIONAL)_ The two-letter country code. Currently only the US is supported.

- **[attributes]** _(OPTIONAL)_ Use one or more of the following attributes:

  - "date" – The date that the market was either open or closed.
  - "status" – The status of the market, either `open` or `closed`.
  - "all" – Returns all values.

- **start date** _(OPTIONAL)_ The start date when fetching the market's status. If start date is specified, but end date is not, only the single day’s data is returned.

- **end date** _(OPTIONAL)_ The end date when fetching the market's status, or the number of calendar days (not trading days) from the `start date` from which to return data.

## Notes

:::info Notes

All parameters must be enclosed in quotation marks or be references to cells containing text. A possible exception is when end date is specified as a number of days.

:::
