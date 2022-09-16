---
title: Columns
sidebar_position: 7
---

The columns parameter is used to limit the results and only request the columns you need. The most common use of this feature is to embed a single numeric result from one of the end points in a spreadsheet cell.

## Parameter

    columns=<column_name1,column_name2,etc>

## Use Example

    /profile?symbol=AAPL&columns=isin,cusip

## Response Example

```json
{ "isin": "US0378331005", "cusip": "037833100" }
```

## Values

### string

Use a list of columns names separated by commas to limit the response to just the columns requested.
