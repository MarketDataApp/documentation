---
title: OPTIONLOOKUP
sidebar_position: 1
---

Look-up the OCC option symbol from text or 4 cell references containing (1) underlying symbol, (2) expiration date, (3) strike, (4) call or put. 

:::tip

It is not necessary to know the exact date of the option expiration. The formula will assume the monthly option expiration if both the month and the year are provided. If only the month is provided with no day or year, the formula will assume an unexpired option for the current year or the next year.

:::


## Sample Usage

    OPTIONLOOKUP("AAPL 7/21/2023 200 Call")
    OPTIONLOOKUP("AAPL 7/2023 $200 Call")
    OPTIONLOOKUP("AAPL July 2023 200 Call")
    OPTIONLOOKUP("AAPL Jan 200 Call")
    OPTIONLOOKUP(A1:D1)

## Syntax

    OPTIONLOOKUP("text")

- **text** _(REQUIRED)_ Text or 4 cell references containing (1) underlying symbol, (2) expiration date, (3) strike, (4) call or put. 

## Notes

:::info

All parameters must be enclosed in quotation marks or be references to 4 cells containing (1) underlying symbol, (2) expiration date, (3) strike, (4) call or put. 

:::
