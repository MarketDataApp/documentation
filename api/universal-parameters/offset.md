---
title: Offset
description: Use the offset parameter with limit to paginate a Market Data API response, starting the returned values at a position you choose.
sidebar_position: 5
---

The offset parameter is used together with limit to allow you to implement pagination in your application. Offset will allow you to return values starting at a certain value.

## Parameter

    offset=\<number\>

## Use Example

    /candles/daily/AAPL?limit=10&offset=10

## Values

### integer (required)

The limit parameter accepts any positive integer as an input.
