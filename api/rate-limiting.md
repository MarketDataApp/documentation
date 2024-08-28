---
title: Rate Limits
sidebar_position: 4
---

We enforce rate limits to ensure our API remains accessible and efficient for all users. We have two types of rate limits: API credits (total requests per unit of time) and a concurrent request limit (simultaneous requests).

## API Credits

Normally each API call consumes a single credit. However, **if the response includes more than a single symbol, it can consume multiple credits**. Often, users can navigate around a rate limit by making the most of the diverse filters we provide (e.g. instead of retrieving an entire option chain, apply specific filters to narrow down the results).

**The rate limit is a hard limit. Once the limit has been reached, you will no longer be able to make requests until the request counter resets.** Requests in excess of the rate limit will generate 429 responses.

### Usage Counter Reset Time

The usage counter for all plans with a daily limit resets at **9:30 AM Eastern Time** (NYSE opening bell). This reset timing is crucial for users to understand so they can plan their API usage efficiently without hitting the rate limit unexpectedly.

:::tip Managing Timezone Changes
To handle the reset time accurately regardless of your local timezone, it's recommended to use the `America/New_York` timezone identifier. This ensures that your application adjusts for any changes in Eastern Time, including daylight saving shifts, automatically.

By aligning your application's timing functions with the `America/New_York` timezone, you can ensure that your usage of the API remains within the allocated rate limits, taking into account the precise reset timing at 9:30 AM Eastern Time.
:::

## Concurrent Request Limit

To maintain the stability and performance of our API, we enforce a limit of no more than 50 concurrent requests across all subscription plans. This means that at any given time, you should not have more than 50 active API calls in progress. Requests in excess of the concurrency limit will generate 429 responses.

To adhere to this limit, it is advisable to implement a worker or thread pool mechanism in your application that does not exceed 50 workers. Each worker should handle no more than one API request at a time. This setup helps in efficiently managing API calls without breaching the concurrent request limit and ensures fair usage among all users.

## Rate Limits By Plan
Different plans have specific rate limits, with most plans enforcing a daily rate limit while our Commercial Plan uses a per minute rate limit.

|                          | Free Forever | Starter   | Trader    | Commercial       |
|--------------------------|--------------|-----------|-----------|------------------|
| Daily API Credits        | 100          | 10,000    | 100,000   | No Limit         |
| Per Minute API Credits   | No Limit     | No Limit  | No Limit  | 60,000           |
| Concurrent Request Limit | 50           | 50        | 50        | 50               |


#### Summary

- **Free Forever Plan:** 100 credits per day.
- **Starter Plan:** 10,000 credits per day.
- **Trader Plan:** 100,000 credits per day.
- **Commercial Plan:** 60,000 credits per minute.

## Credits
Each time you make a request to the API, the system will increase your credits counter. Normally each successful response will increase your counter by 1 and each call to our API will be counted as a single credit. However, **if you request multiple symbols in a single API call using the bulkquotes, the bulkcandles, or the option chain endpoint, a request will be used for each symbol that is included in the response**.

:::caution 
For users working with options, take care before repeatly requesting quotes for an entire option chain. **Each option symbol included in the response will consume a request**. If you were to download the entire SPX option chain (which has 20,000+ option symbols), you would exhaust your request limit very quickly. Use our extensive option chain filtering parameters to request only the strikes/expirations you need. 
:::

## Headers to Manage the Rate Limit
We provide the following headers in our responses to help you manage the rate limit and throttle your applications when necessary:

- `X-Api-Ratelimit-Limit`: The maximum number of requests you're permitted to make (per day for Free/Starter/Trader plans or per minute for commercial users).
- `X-Api-Ratelimit-Remaining`: The number of requests remaining in the current rate day/period.
- `X-Api-Ratelimit-Reset`: The time at which the current rate limit window resets in UTC epoch seconds.
- `X-Api-Ratelimit-Consumed`: The quantity of requests that were consumed in the current request.

## Detailed Rate Limit Rules
- Each successful response increases the counter by a minimum of 1 request.
- Only status 200/203 responses consume requests.
- NULL responses are not counted.
- Error responses are not counted.
- Requests consume more than 1 credit if the response includes prices for more than 1 symbol (i.e. options/chain or stocks/bulkquotes endpoints).
- Responses that include more than one symbol, but do not include the **bid**, **ask**, **mid**, or **last** columns _**do not**_ consume multiple credits and are counted as a single request.
- Certain free trial symbols like AAPL stock, AAPL options, the VIX index, and the VFINX mutual fund do not consume requests.

## Strategies To Avoid Rate Limiting
- Exclude the bid, ask, mid, and last columns from your option chain requests if the current price is not needed.
- Use the extensive option chain filters such as `strikeLimit` to exclude unnecessary strikes from your requests.
