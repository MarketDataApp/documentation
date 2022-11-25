---
title: Plan Limits
sidebar_position: 2
---

Each Market Data plan comes with certain limitations to allow for shared use of our servers. We offer several plans with different price points depending on the quantity of data needed.

:::tip

If our standard plans do not fit your use-case, please do not hesitate to speak with sales. We'd be happy to provide you with a custom plan that meets your needs.

:::

## Prices / Requests Limits

Each time you or our Add-on makes a request to the API, the system will increase your daily request counter. Normally each call to our API will be counted as a single request. However, if you request prices for multiple symbols, the a request will be added for each symbol that is included.

:::caution

For users working with options, take care before repeatly requesting quotes for an entire option chain. Each option symbol you request will consume a request. If you were to download the entire SPX option chain (which has 6200+ option symbols), you would exchaust your daily request limit very quickly. Use our extensive option chain filtering parameters to request only the prices you need.

:::

### Daily Limit

All plans have a hard limit on the number of prices or requests that can be made per day. Exceeding the daily limit will cause an error and your account will be unable to make new requests until the next trading day.

### Throttling

Plans with unlimited daily API calls are subject to throttling and can receive a total of 1000 prices per second. If this throttling is unacceptable for your use case, please let us know how we can meet your needs. The Starter and Trader plans (and any plan with a published daily request limit has no per second throttling.

## Backtests

Plans with unlimited backtests are subjet to server throttling after 100,000 daily backtests have been performed.
