---
title: No Headers
sidebar_position: 1
---

Add the "noheaders" attribute to exclude the header row from the output of any Market Data formula.

## Sample Usage
```excel-formula
=STOCKQUOTE("AAPL","all,noheaders")
=STOCKDATA("AAPL", "all,noheaders")
=OPTIONDATA("AAPL271217C00250000", "bid,ask,noheaders", "1/5/2026", "2/5/2026")
```

## Syntax
```excel-formula
=FORMULA("symbol", "attribute1, attribute2, noheaders")
```

Add `noheaders` anywhere in the attribute list of any Market Data formula. Ensure that all attributes are seperated by commas.

## Notes

:::info

The `noheaders` attribute is only needed if you've requested more than one attribute. If you request a single attribute in any Market Data formula, the output will be a single cell with no headers.

:::
