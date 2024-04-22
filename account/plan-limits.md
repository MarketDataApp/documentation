---
title: Plan Limits
sidebar_position: 2
---

Each Market Data plan comes with certain limitations to allow for shared use of our servers. We offer several plans with different price points depending on the quantity of data needed.

:::tip
Most users don't run into trouble with our limits. However, if our standard plans do not fit your use-case, please do not hesitate to speak with sales. We'd be happy to provide you with a custom plan that meets your needs.
:::

## Standard Plans

|                       | Free Forever | Starter   | Trader    | Commercial Plans |
|-----------------------|--------------|-----------|-----------|------------------|
| Daily Credits         | 100          | 10,000    | 100,000   | No Limit         |
| Historical Data       | 1 Year       | 5 Years   | No Limit  | No Limit         |
| Data Type             | Delayed      | Real-time | Real-time | Real-time        |
| API Endpoints         | Standard     | Premium   | Premium   | Premium + Custom |

## Credits
Each time you make a request to the API, the system will increase your credits counter. Normally each successful response will increase your counter by 1 and each call to our API will be counted once. However, **if you request multiple symbols in a single API call using the bulkquotes, bulkcandles, or option chain endpoint, a request will be used for each symbol that is included in the response**. 

:::caution 
For users working with options, take care before repeatly requesting quotes for an entire option chain. **Each option symbol included in the response will consume a request**. If you were to download the entire SPX option chain (which has 20,000+ option symbols), you would exhaust your request limit very quickly. Use our extensive option chain filtering parameters to request only the strikes/expirations you need. 
:::

#### Throttling

Plans with unlimited daily API calls are subject to throttling and can spend a total of 60,000 credits per minute. If this throttling is unacceptable for your use case, please let us know how we can meet your needs. The Starter and Trader plans (and any plan with a published daily request limit) has no per minute throttling.

## Historical Data Age Limit

The Free Forever and Starter plans include historical age limits on historical data queries. If you attempt to access data older than the plan's limits permit, the request will be denied.

## Data Type

The Free Forever plan provides users with delayed data. All paid plans offer real-time data.

:::info
Free trials of paid plans also provide delayed data. Only the paid versions of the Starter and Trader plans offer acccess to real-time data.
:::

## API Endpoints

The Free Forever plan only provides access to pricing data. Premium endpoints and spreadsheet formulas that contain reference data are not available on free plans. In addition to our public endpoints, Commercial plans also have access to custom-built endpoints to satisfy the needs of their specific application.

## About Daily Limits

All usage counters (requests, unique symbols, backtests, etc.) for all plans are reset at 9:30 AM Eastern Time (NYSE opening bell). All limits are hard limits and once reached, you won't be able to continue until the next trading day.
