---
title: Columns
description: Use the columns parameter on any Market Data endpoint to return only the fields you name, such as columns=ask,bid, which suppresses the status output.
sidebar_position: 6
---

The columns parameter is used to limit the results of any endpoint to only the columns you need.

## Parameter

## Use Example

```
https://api.marketdata.app/v1/stocks/quotes/AAPL/?columns=ask,bid
```

## Response Example

```json
{ "ask": [152.14], "bid": [152.12] }
```

## Values

### string

Use a list of columns names separated by commas to limit the response to just the columns requested.

:::caution

When using the columns parameter the `s` status output is suppressed from the response.

:::
