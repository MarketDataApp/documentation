---
title: No Headers
sidebar_position: 1
---

Add the "noheaders" attribute to exclude the header row from the output of any Market Data formula.

## Sample Usage

    STOCKQUOTE("AAPL","all,noheaders")
    INDEXQUOTE("SPX", "all,noheaders")
    OPTIONDATA("AAPL240119C00150000", "bid,ask,noheaders", "9/23/2022", "10/23/2022")

## Syntax

    FORMULA("symbol", "attribute1, attribute2, noheaders")

Add `noheaders` anywhere in the attribute list of any Market Data formula. Ensure that all attributes are seperated by commas.

## Notes

:::info

The `noheaders` attribute is only needed if you've requested more than one attribute. If you request a single attribute in any Market Data formula, the output will be a single cell with no headers.

:::
