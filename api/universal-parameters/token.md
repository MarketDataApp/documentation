---
title: Token
sidebar_position: 1
---

The token parameter allows you to submit a read-only access token as a parameter. If your access token is write-enabled (authorized for trading), you may not use the token as a parameter, and must submit it in a header.

:::danger Security Warning
When submitting your token in a URL, your token is exposed in server logs, cached in your browser, or otherwise made available. We do not recommend using your token as a parameter. This should only be used as a last resort in when you are unable to submit your token in a header.
:::

## Parameter

    token=<token>

## Use Example

    /profile?symbol=AAPL&token=demo

## Values

### token

Submit your read-only access token as a value.
