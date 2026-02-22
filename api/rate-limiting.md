---
title: Rate Limits
sidebar_position: 4
---

We enforce rate limits to ensure our API remains accessible and efficient for all users. We have two types of limits: API credits (total credits per unit of time) and a concurrent request limit (simultaneous requests).

For troubleshooting, use:
- [429: Credit Limit Reached](/api/troubleshooting/running-out-of-credits)
- [429: Too Many Concurrent Requests](/api/troubleshooting/too-many-concurrent-requests)

## API Credits

Normally each API call consumes a single credit. However, **if the response includes more than a single symbol, it can consume multiple credits**. Often, users can navigate around a rate limit by making the most of the diverse filters we provide (e.g. instead of retrieving an entire option chain, apply specific filters to narrow down the results).

**The credit limit is a hard limit. Once the limit has been reached, you can no longer make API calls until the credit counter resets.** Calls in excess of the limit return `429` responses.

### Usage Counter Reset Time

The usage counter for all plans with a daily limit resets at **9:30 AM Eastern Time** (NYSE opening bell). This reset timing is crucial for users to understand so they can plan their API usage efficiently without hitting the rate limit unexpectedly.

This reset time is also a safety control: if a script runs out of control overnight, a 9:30 AM reset limits impact to one trading day budget instead of potentially consuming two trading-day budgets across midnight.

:::tip Managing Timezone Changes
To handle the reset time accurately regardless of your local timezone, it's recommended to use the `America/New_York` timezone identifier. This ensures that your application adjusts for any changes in Eastern Time, including daylight saving shifts, automatically.

By aligning your application's timing functions with the `America/New_York` timezone, you can ensure that your usage of the API remains within the allocated rate limits, taking into account the precise reset timing at 9:30 AM Eastern Time.
:::

## Concurrent Request Limit

To maintain the stability and performance of our API, we enforce a limit of no more than 50 concurrent requests across all subscription plans. This means that at any given time, you should not have more than 50 active API calls in progress. Requests in excess of the concurrency limit will generate 429 responses.

To adhere to this limit, it is advisable to implement a worker or thread pool mechanism in your application that does not exceed 50 workers. Each worker should handle no more than one API request at a time. This setup helps in efficiently managing API calls without breaching the concurrent request limit and ensures fair usage among all users.

## Rate Limits By Plan
Different plans have specific rate limits. Free/Starter/Trader use daily limits, while Quant/Prime use per-minute limits.

|                          | Free Forever | Starter   | Trader    | Quant      | Prime       |
|--------------------------|--------------|-----------|-----------|------------|-------------|
| Daily API Credits        | 100          | 10,000    | 100,000   | No Limit   | No Limit    |
| Per Minute API Credits   | No Limit     | No Limit  | No Limit  | 10,000     | 100,000     |
| Concurrent Request Limit | 50           | 50        | 50        | 50         | 50          |


#### Summary

- **Free Forever Plan:** 100 credits per day.
- **Starter Plan:** 10,000 credits per day.
- **Trader Plan:** 100,000 credits per day.
- **Quant Plan:** 10,000 credits per minute.
- **Prime Plan:** 100,000 credits per minute.

## Credits
Each time you call the API, the system increases your credits counter. Normally each successful response consumes 1 credit. However, **if you request multiple symbols in a single API call using `stocks/quotes`, `stocks/prices`, `stocks/bulkcandles`, or `options/chain`, credits are consumed per symbol included in the response**.

:::caution 
For users working with options, take care before repeatedly requesting quotes for an entire option chain. **Each option symbol included in the response consumes credits**. If you download the entire SPX option chain (which has 20,000+ option symbols), you can exhaust your credit limit very quickly. Use our option chain filters to request only the strikes and expirations you need.
:::

## Headers to Manage the Rate Limit
We provide the following headers in our responses to help you manage the rate limit and throttle your applications when necessary:

- `X-Api-Ratelimit-Limit`: The maximum number of API credits permitted (per day for Free/Starter/Trader plans or per minute for Quant/Prime users).
- `X-Api-Ratelimit-Remaining`: The number of API credits remaining in the current rate day/period.
- `X-Api-Ratelimit-Reset`: The time at which the current rate limit window resets in UTC epoch seconds.
- `X-Api-Ratelimit-Consumed`: The quantity of API credits consumed by the current request.

## Detailed Rate Limit Rules
- Each successful response increases the counter by a minimum of 1 credit.
- Only status 200/203 responses consume credits.
- NULL responses are not counted.
- Error responses are not counted.
- Requests consume more than 1 credit if the response includes prices for more than one symbol (for example, `options/chain` or `stocks/quotes` bulk requests).
- Responses that include more than one symbol, but do not include the **bid**, **ask**, **mid**, or **last** columns _**do not**_ consume multiple credits and are counted as a single credit.
- Certain free trial symbols like AAPL stock, AAPL options, the VIX index, and the VFINX mutual fund do not consume credits.

## Strategies To Avoid Rate Limiting
- Exclude the bid, ask, mid, and last columns from your option chain requests if the current price is not needed.
- Use the extensive option chain filters such as `strikeLimit` to exclude unnecessary strikes from your requests.
- Paying customers can make use of the reduced-price cached mode. Use the `mode=cached` parameter on supported bulk endpoints to retrieve previously cached quotes instead of making a live request. This can save thousands of credits. For more details, refer to the [mode parameter documentation](/api/universal-parameters/mode).

:::note Trial plans
`mode=cached` is not available on Starter Trial and Trader Trial plans.
:::
