---
title: Headers
sidebar_position: 7
---

The headers parameter is used to turn off headers when using CSV output.

## Parameter

    headers=\<true\|false\>

## Use Example

    /candles/daily/AAPL?headers=false&format=csv

## Values

### true (default)

If the headers argument is not used, by default headers are turned on.

### false

Turns headers off and returns just the data points.
