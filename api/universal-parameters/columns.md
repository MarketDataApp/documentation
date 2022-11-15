---
title: Columns
sidebar_position: 7
---

The columns parameter is used to limit the results of any endpoint to only the columns you need.

## Parameter

    columns=<column_name1,column_name2,etc>
    columns=-column_name


## Use Example

    https://api.marketdata.app/v1/stocks/quotes/AAPL/?columns=ask,bid
    https://api.marketdata.app/v1/stocks/quotes/AAPL/?columns=-mid


## Response Example

```json
{"ask":[152.14],"bid":[152.12]}
```

## Values

### string

Use a list of columns names separated by commas to limit the response to just the columns requested. You may also use a minus sign in front of the column name to exclude one or more columns from the default API output.

:::warning

You can not include _and_ exclude columns in the same API call. The columns parameter will be ignored if both postive and negative attributes values are used in the same API call.

:::
