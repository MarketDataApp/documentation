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

#### Throttling

Plans with unlimited daily API calls are subject to throttling and can receive a total of 1000 prices per second. If this throttling is unacceptable for your use case, please let us know how we can meet your needs. The Starter and Trader plans (and any plan with a published daily request limit has no per second throttling.

## Unique Daily Symbols Limits

Our Free Forever and Starter plans include limits on the number of daily symbols that can be requested. Once this limit has been reached, you may only continue to request prices and data of the symbols you have already used during the day. 

## Historical Data Age Limit

Our Free Forever and Starter plans include historical age limits on historical data queries. If you attempt to access data older than the plan's limits permit, the request will be denied.

## Brokerage Connections

:::info

Backtests are not yet implemented.

:::

Brokerage connection limits apply both per broker and per account at the same broker. For example, the Starter plan allows you to connect a single brokerage account. If you have more than one account at the same broker, you could only connect one of the two.

## Backtests

:::info

Backtests are not yet implemented.

:::

Plans with unlimited backtests are subjet to throttling after 10,000 daily backtests have been performed. This means backtests will still be performed, but only after other users' backtests have completed. Users on the Starter and Trader plans (and any plan with a published daily backtest limit) have no throttling and can process backtests immediately.

## About Daily Limits

All usage counters (requests, unique symbols, backtests, etc.) for all plans are reset at 9:30 AM Eastern Time (NYSE opening bell). All limits are hard limits and once reached, you won't be able to continue until the next trading day.
