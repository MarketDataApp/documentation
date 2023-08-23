---
title: Rate Limiting
sidebar_position: 3
---

Different plans have specific rate limits, with most plans enforcing a daily rate limit while our Commercial Plan uses a per minute rate limit.

## Rate Limits By Plan

- **Free Forever Plan:** 100 requests/prices per day.
- **Starter Plan:** 1000 requests/prices per day.
- **Trader Plan:** 100,000 requests/prices per day.
- **Commercial Plan:** Advertised as 1000 requests/prices per second (measured as 60,000 prices per minute).

## Headers to Manage Rate Limit
We provide the following headers in our responses to help you manage the rate limit:

- `X-Api-RateLimit-Limit`: The maximum number of requests you're permitted to make (per day for Free/Starter/Trader plans or per minute for commercial users).
- `X-Api-RateLimit-Remaining`: The number of requests remaining in the current rate day/period.
- `X-Api-RateLimit-Reset`: The time at which the current rate limit window resets in UTC epoch seconds.
- `X-Api-RateLimit-Consumed`: The quantity of requests that were consumed in the current request.

## Specific Rules
- Each request consumes a minimum of 1 request.
- Requests may consume more than 1 request if they include more than 1 symbol (e.g., OPTIONCHAIN endpoint).
- NULL responses are not counted.
- Error responses are not counted.
- Certain free trial symbols like AAPL stocks, AAPL options, VIX index do not consume prices or requests.

:::caution
A full SPX option chain can include more than 20,000 symbols (and consume 20,000 prices in a single request). Use our extensive filtering before making complete option chain requests.
:::
