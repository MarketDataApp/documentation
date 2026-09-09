---
title: Headers Parameter
description: Set headers=false on any CSV request to drop the header row and return only the data points; headers are on by default when the parameter is omitted.
sidebar_label: Headers
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
