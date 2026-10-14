---
title: No Headers
description: Add the noheaders attribute to any Market Data Google Sheets formula, such as STOCKDATA or OPTIONDATA, to leave the header row out of the output.
sidebar_position: 1
---

Add the "noheaders" attribute to exclude the header row from the output of any Market Data formula.

## Sample Usage
```excel-formula
=STOCKDATA("AAPL", "all,noheaders")
=STOCKDATA(A1:A50, "mid,noheaders")
=OPTIONDATA(A1:A50, "bid,ask,noheaders")
=OPTIONDATA("AAPL271217C00250000", "bid,ask,noheaders", "1/5/2026", "2/5/2026")
```

## Syntax
```excel-formula
=FORMULA("symbol", "attribute1, attribute2, noheaders")
```

Add `noheaders` anywhere in the attribute list of any Market Data formula. Ensure that all attributes are seperated by commas.

## Notes

:::info

The `noheaders` attribute is needed whenever the output has more than one row or column: several attributes, several symbols or contracts, or a date range. A single attribute for a single symbol and date returns one cell with no header.

:::
