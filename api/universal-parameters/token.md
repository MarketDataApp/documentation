---
title: Token
sidebar_position: 0
---

The token parameter allows you to submit a read-only access token as a parameter.

:::danger Security Warning
When submitting your token in a URL, your token is exposed in server logs, cached in your browser, or otherwise made available. We do not recommend using your token as a parameter. This should only be used as a last resort in when you are unable to submit your token in a header.
:::

## Parameter

    token=\<token\>

## Use Example

    https://api.marketdata.app/v1/stocks/quotes/SPY/?token=put-your-token-here

## Values

### Token

Submit your read-only access token as a value.
