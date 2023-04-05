---
title: MARKETSTATUS
sidebar_position: 1
---

Get the past, present, or future status for a stock market. The formula will respond with "open" for trading days or "closed" for weekends or market holidays.

## Sample Usage

    MARKETSTATUS()
    MARKETSTATUS("US","all","1/1/2022","12/31/2022")
    MARKETSTATUS("US","status","yesterday")

## Syntax

    MARKETSTATUS(country, [attributes], start date, end date)

- **country** _(OPTIONAL)_ The two-letter country code. Currently only the US is supported.

- **[attributes]** _(OPTIONAL)_ Use one or more of the following attributes:

  - "date" – The opening price of the stock.
  - "status" – The high price of the stock.
  - "all" – Returns all values.

- **startDate** _(OPTIONAL)_ The start date when fetching historical data. If start date is specified, but end date is not, only the single day’s data is returned.

- **endDate** _(OPTIONAL)_ The end date when fetching historical data, or the number of calendar days (not trading days) from startDate for which to return data.

## Notes

:::info Notes

All parameters must be enclosed in quotation marks or be references to cells containing text. A possible exception is when end date is specified as a number of days.

:::
