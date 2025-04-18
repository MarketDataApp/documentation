---
title: Plan Limits
sidebar_position: 2
---

Each Market Data plan comes with certain limitations to allow for shared use of our servers. We offer several plans with different price points depending on the quantity of data needed.

:::tip
Most users don't run into trouble with our limits. However, if our standard plans do not fit your use-case, please do not hesitate to speak with sales. We'd be happy to provide you with a custom plan that meets your needs.
:::

## Standard Plans

|                       | Free Forever | Starter   | Trader    | Quant      | Prime Plans |
|-----------------------|--------------|-----------|-----------|------------|--------------|
| Daily Credits         | 100          | 10,000    | 100,000   | No Limit   | No Limit    |
| Historical Data       | 1 Year       | 5 Years   | No Limit  | No Limit   | No Limit    |
| Data Type             | Delayed      | Delayed   | Real-time | Real-time  | Real-time   |
| API Endpoints         | Standard     | Premium   | Premium   | Premium + Custom | Premium + Custom |

## Credits
Each time you make a request to the API, the system will increase your credits counter. Normally each successful response will increase your counter by 1 and each call to our API will be counted once. However, **if you request multiple symbols in a single API call using the bulkquotes, bulkcandles, or option chain endpoint, a request will be used for each symbol that is included in the response**. 

:::caution 
For users working with options, take care before repeatedly requesting quotes for an entire option chain. **Each option symbol included in the response will consume a request**. If you were to download the entire SPX option chain (which has 20,000+ option symbols), you would exhaust your request limit very quickly. Use our extensive option chain filtering parameters to request only the strikes/expirations you need. 
:::

## Device Restrictions

To comply with exchange regulations regarding data redistribution, all plans are subject to strict device connection limits:

- Each account may only connect from a single IP address at a time
- Multiple simultaneous connections from different devices are not permitted
- Account sharing and data redistribution are prohibited without a commercial license

These restrictions are enforced across all plans to ensure compliance with exchange regulations that prohibit unauthorized data redistribution. Prime plans requiring multi-device access should contact sales for appropriate licensing options.

#### Throttling

All plans are subject to a maximum of 50 simultaneous requests at any given time.

## Historical Data Age Limit

The Free Forever and Starter plans include historical age limits on historical data queries. If you attempt to access data older than the plan's limits permit, the request will be denied.

## Data Type

The Free Forever and Starter plans provide users with delayed data. Real-time data is available with Trader, Quant, and Prime plans.

:::info
Free trials of paid plans provide delayed data. Real-time data is only available with paid versions of the Trader plan and above.
:::

## API Endpoints

The Free Forever plan only provides access to pricing data. Premium endpoints and spreadsheet formulas that contain reference data are not available on free plans. Quant and Prime plans also have access to custom-built endpoints to satisfy the needs of their specific application.

## About Daily Limits

All usage counters (requests, unique symbols, backtests, etc.) for all plans are reset at 9:30 AM Eastern Time (NYSE opening bell). All limits are hard limits and once reached, you won't be able to continue until the next trading day.
