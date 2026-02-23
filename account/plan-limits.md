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
|-----------------------|--------------|-----------|-----------|------------|-------------|
| Daily Credits         | 100          | 10,000    | 100,000   | No Limit   | No Limit    |
| Per-Minute Credits    | No Limit     | No Limit  | No Limit  | 10,000     | 100,000     |
| Historical Data       | 1 Year       | 5 Years   | No Limit  | No Limit   | No Limit    |
| Stocks Data Type      | Delayed      | Real-time | Real-time | Real-time  | Real-time   |
| Options Data Type     | Delayed      | 15-minute delayed | Real-time | Real-time  | Real-time   |
| API Endpoints         | Standard     | Premium   | Premium   | Premium + Custom | Premium + Custom |

## Credits
Each time you call the API, the system increases your credits counter. Normally each successful response consumes 1 credit. However, **if you request multiple symbols in a single API call using `stocks/quotes`, `stocks/prices`, `stocks/bulkcandles`, or `options/chain`, each symbol included in the response consumes credits**.

:::caution 
For users working with options, take care before repeatedly requesting quotes for an entire option chain. **Each option symbol included in the response consumes credits**. If you download the entire SPX option chain (which has 20,000+ option symbols), you can exhaust your credit limit very quickly. Use our option chain filters to request only the strikes and expirations you need.
:::

:::note Trial plans
Starter Trial and Trader Trial do not support `mode=cached`.
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

- Free Forever provides delayed stocks/options data.
- Starter provides real-time stocks and 15-minute delayed options data.
- Trader, Quant, and Prime provide real-time stocks/options data.

:::info
Free trials of paid plans provide delayed data. Real-time data is only available with paid versions of the Trader plan and above.
:::

## API Endpoints

The Free Forever plan only provides access to pricing data. Premium endpoints and spreadsheet formulas that contain reference data are not available on free plans. Quant and Prime plans also have access to custom-built endpoints to satisfy the needs of their specific application.

## About Usage Windows

- Free Forever, Starter, and Trader use daily windows that reset at 9:30 AM Eastern Time (NYSE opening bell).
- Quant and Prime use per-minute credit windows.
- All limits are hard limits. Once reached, requests are blocked until the relevant window resets.
