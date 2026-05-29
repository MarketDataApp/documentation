---
title: Plan Limits
sidebar_position: 3
---

Each Market Data plan comes with certain limitations to allow for shared use of our servers. We offer several plans with different price points depending on the quantity of data needed.

## Standard Plans

|                    | Free Forever | Starter           | Trader    | Quant            | Prime Plans      |
|--------------------|--------------|-------------------|-----------|------------------|------------------|
| Daily Credits      | 100          | 10,000            | 100,000   | No Limit         | No Limit         |
| Per-Minute Credits | No Limit     | No Limit          | No Limit  | 10,000           | 100,000          |
| Historical Data    | 1 Year       | 5 Years           | No Limit  | No Limit         | No Limit         |
| Stocks Data Type   | Delayed      | Real-time         | Real-time | Real-time        | Real-time        |
| Options Data Type  | Delayed      | 15-minute delayed | Real-time | Real-time        | Real-time        |
| API Endpoints      | Standard     | Premium           | Premium   | Premium + Custom | Premium + Custom |

## Credits
Each time you call the API, the system increases your credits counter. Normally each successful response consumes 1 credit. However, **if you request multiple symbols in a single API call using `stocks/quotes`, `stocks/prices`, `stocks/bulkcandles`, or `options/chain`, each symbol included in the response consumes credits**.

:::caution 
For users working with options, take care before repeatedly requesting quotes for an entire option chain. **Each option symbol included in the response consumes credits**. If you download the entire SPX option chain (which has 20,000+ option symbols), you can exhaust your credit limit very quickly. Use our option chain filters to request only the strikes and expirations you need.
:::

:::note Trial plans
Starter Trial and Trader Trial do not support `mode=cached`.
:::

## Device Restrictions

All plans are subject to a single IP address limit. Each account may only connect from one IP address at a time. Multiple simultaneous connections, account sharing, and data redistribution are not permitted.

See the [Single IP Address Policy](/docs/account/data-policies/single-ip/) for details.

#### Throttling

All plans are subject to a maximum of 50 simultaneous requests at any given time.

## Historical Data Age Limit

Free Forever accounts can access up to 1 year of historical data and Starter accounts can access up to 5 years. Trader, Quant, and Prime plans have no historical data age limit. If you request data older than your plan allows, the request will be denied.

## Data Type

- Free Forever provides delayed stocks/options data.
- Starter provides real-time stocks and 15-minute delayed options data.
- Trader, Quant, and Prime provide real-time stocks/options data.

:::info
Free trials of paid plans provide delayed data. Real-time data is only available with paid versions of the Trader plan and above.
:::

For endpoint-level freshness rules and the Delayed → Historical rollover timing — including why options data only rolls at 9:30 AM ET the next trading day rather than at the prior session's close — see [Data Freshness](./data-freshness).

## API Endpoints

The Free Forever plan only provides access to pricing data. Premium endpoints and spreadsheet formulas that contain reference data are not available on free plans. Quant and Prime plans also have access to custom-built endpoints to satisfy the needs of their specific application.

## About Usage Windows

- Free Forever, Starter, and Trader use daily windows that reset at 9:30 AM Eastern Time (NYSE opening bell).
- Quant and Prime use per-minute credit windows.
- Any single API request is permitted as long as you have at least 1 credit remaining in the current window, even if the request consumes more credits than you have available. After the request, your balance may go negative and further requests will be blocked until the window resets.
