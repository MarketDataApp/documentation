---
title: Limit
sidebar_position: 4
---

The `limit` parameter allows you to limit the number of results for a particular API call or override an endpoint’s default limits to get more data.

- Default Limit: 10,000
- Maximum Limit: 50,000

In the example below, the daily candle endpoint by default returns the last 252 daily bars. By using limit you could modify the behavior return the last two weeks or 10 years of data.

## Parameter

    limit=\<number\>

## Use Example

    /candles/daily/AAPL?limit=10

    /candles/daily/AAPL?limit=2520

## Values

### integer (required)

The limit parameter accepts any positive integer as an input.
