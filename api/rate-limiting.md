---
title: Rate Limiting
sidebar_position: 3
---

Different plans have specific rate limits, with most plans enforcing a daily rate limit while our Commercial Plan uses a per minute rate limit. Normally each API call consumes a single request. However, if the response includes more than a single symbol, it can consume multiple requests.

## Rate Limits By Plan

|                       | Free Forever | Starter   | Trader    | Commercial Plans |
|-----------------------|--------------|-----------|-----------|------------------|
| Daily Requests        | 100          | 10,000     | 100,000    | No Limit         |
| Requests Per Minute   | No Limit     | No Limit  | No Limit  | 60,000            |

- **Free Forever Plan:** 100 requests/prices per day.
- **Starter Plan:** 10,000 requests/prices per day.
- **Trader Plan:** 100,000 requests/prices per day.
- **Commercial Plan:** Advertised as 1000 requests/prices per second, but measured each minute. (e.g. 60,000 per minute)

## Prices vs Requests
Each time you or our Add-on makes a request to the API, the system will increase your daily request counter. Normally prices and requests are interchangable. Each call to our API will normally be counted as a single request. However, **if you request prices for multiple symbols in a single API call using the option chain endpoint, a request will be used for each symbol that is included in the response**. Once this limit has been reached, you will no longer be able to make requests until the next day.

:::caution For users working with options, take care before repeatly requesting quotes for an entire option chain. Each option symbol you request will consume a request. If you were to download the entire SPX option chain (which has 20,000+ option symbols), you would exhaust your daily request limit very quickly. Use our extensive option chain filtering parameters to request only the prices you need. :::

## Headers to Manage Rate Limit
We provide the following headers in our responses to help you manage the rate limit:

- `X-Api-RateLimit-Limit`: The maximum number of requests you're permitted to make (per day for Free/Starter/Trader plans or per minute for commercial users).
- `X-Api-RateLimit-Remaining`: The number of requests remaining in the current rate day/period.
- `X-Api-RateLimit-Reset`: The time at which the current rate limit window resets in UTC epoch seconds.
- `X-Api-RateLimit-Consumed`: The quantity of requests that were consumed in the current request.

## Detailed Rules
- Each successful response increases the counter by a minimum of 1 request.
- Only status 200/203 responses consume requests.
- NULL responses are not counted.
- Error responses are not counted.
- Responses may consume more than 1 request if the response includes prices for more than 1 symbol (e.g., an OPTIONCHAIN endpoint).
- Responses that include more than one symbol, but do not include the bid, ask, or mid columns **do not** consume prices and are counted as a single request.
- Certain free trial symbols like AAPL stocks, AAPL options, VIX index do not consume prices or requests.
