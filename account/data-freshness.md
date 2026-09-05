---
title: Data Freshness
sidebar_position: 5.5
---

Market Data classifies the data you receive into three freshness categories:

- **Real-time** — under 15 minutes old. Live trading data.
- **Delayed** — 15+ minutes old, but from the current trading session.
- **Historical** — from a previous, fully-closed trading session.

Which category applies depends on your plan, the data type, and the time of day.

## When Delayed data becomes Historical

Historical requires both a >15-minute delay floor *and* a data-type-specific session-closed condition. The session-closed condition is **different for stocks and options**:

- **Stocks:** Historical at session close + 15 min — **4:15:01 PM ET** on a regular trading day. Between 4:00 PM and 4:15 PM ET, the data is still Delayed (the 15-minute Delayed window hasn't elapsed yet).
- **Options:** Historical at the *next* session's open — **9:30:01 AM ET** the next trading day, not at the prior session's close.

Friday's options quotes therefore do **not** become Historical until **9:30:01 AM ET Monday** — they remain Delayed all weekend.

If you query an options endpoint at 6:33 AM ET Wednesday on a plan that provides Historical-only options data, you will receive **Monday's** close, not Tuesday's. Tuesday's options data does not roll to Historical until 9:30:01 AM ET Wednesday. This is the most common cause of "the data doesn't match my broker" support requests — the behavior is correct, the customer is just querying before the next session has opened.

## By Plan

The tables below show the freshness category for every API endpoint, by plan, and assume non-professional status. Real-time exchange data is never available to professional subscribers — see the [Notes](#notes) below. For the underlying entitlement model, see [Exchange Entitlements](/account/entitlements).

:::info[Real-time stock pricing comes from `/v1/stocks/prices/`]
[`/v1/stocks/prices/`](/api/stocks/prices) delivers Real-time stock prices with no delay on every paid plan. `/v1/stocks/quotes/`, `/v1/stocks/candles/`, and `/v1/stocks/bulkcandles/` carry the standard 15-minute exchange delay. Point your application at `/v1/stocks/prices/` when you need the current price.
:::

### Free Forever

All pricing data is Historical (24-hour delayed). Metadata endpoints remain Real-time.

| Endpoint                   | Freshness  | Notes                        |
|----------------------------|------------|------------------------------|
| `/v1/stocks/quotes/`       | Historical |                              |
| `/v1/stocks/candles/`      | Historical |                              |
| `/v1/stocks/bulkcandles/`  | Historical |                              |
| `/v1/stocks/prices/`       | Historical |                              |
| `/v1/options/quotes/`      | Historical |                              |
| `/v1/options/chain/`       | Historical |                              |
| `/v1/options/expirations/` | Real-time  | Contract metadata            |
| `/v1/options/lookup/`      | Real-time  | Contract metadata            |
| `/v1/markets/status/`      | Real-time  | Calendar metadata            |
| `/v1/funds/*`              | See note   | Pending product confirmation |

### Starter Trial

Same as Free Forever — all pricing data is Historical (24-hour delayed).

| Endpoint                   | Freshness  | Notes                        |
|----------------------------|------------|------------------------------|
| `/v1/stocks/quotes/`       | Historical |                              |
| `/v1/stocks/candles/`      | Historical |                              |
| `/v1/stocks/bulkcandles/`  | Historical |                              |
| `/v1/stocks/prices/`       | Historical |                              |
| `/v1/options/quotes/`      | Historical |                              |
| `/v1/options/chain/`       | Historical |                              |
| `/v1/options/expirations/` | Real-time  | Contract metadata            |
| `/v1/options/lookup/`      | Real-time  | Contract metadata            |
| `/v1/markets/status/`      | Real-time  | Calendar metadata            |
| `/v1/funds/*`              | See note   | Pending product confirmation |

### Trader Trial

Same as Starter Trial — all pricing data is Historical (24-hour delayed).

| Endpoint                   | Freshness  | Notes                        |
|----------------------------|------------|------------------------------|
| `/v1/stocks/quotes/`       | Historical |                              |
| `/v1/stocks/candles/`      | Historical |                              |
| `/v1/stocks/bulkcandles/`  | Historical |                              |
| `/v1/stocks/prices/`       | Historical |                              |
| `/v1/options/quotes/`      | Historical |                              |
| `/v1/options/chain/`       | Historical |                              |
| `/v1/options/expirations/` | Real-time  | Contract metadata            |
| `/v1/options/lookup/`      | Real-time  | Contract metadata            |
| `/v1/markets/status/`      | Real-time  | Calendar metadata            |
| `/v1/funds/*`              | See note   | Pending product confirmation |

### Starter

Real-time stock prices. Stock quotes, stock candles, and options data carry the 15-minute exchange delay.

| Endpoint                   | Freshness   | Notes                        |
|----------------------------|-------------|------------------------------|
| `/v1/stocks/quotes/`       | 15m delayed |                              |
| `/v1/stocks/candles/`      | 15m delayed |                              |
| `/v1/stocks/bulkcandles/`  | 15m delayed |                              |
| `/v1/stocks/prices/`       | Real-time   |                              |
| `/v1/options/quotes/`      | 15m delayed |                              |
| `/v1/options/chain/`       | 15m delayed |                              |
| `/v1/options/expirations/` | Real-time   | Contract metadata            |
| `/v1/options/lookup/`      | Real-time   | Contract metadata            |
| `/v1/markets/status/`      | Real-time   | Calendar metadata            |
| `/v1/funds/*`              | See note    | Pending product confirmation |

### Trader

Real-time stock prices and Real-time options data. Stock quotes and candles carry the 15-minute exchange delay.

| Endpoint                   | Freshness   | Notes                        |
|----------------------------|-------------|------------------------------|
| `/v1/stocks/quotes/`       | 15m delayed |                              |
| `/v1/stocks/candles/`      | 15m delayed |                              |
| `/v1/stocks/bulkcandles/`  | 15m delayed |                              |
| `/v1/stocks/prices/`       | Real-time   |                              |
| `/v1/options/quotes/`      | Real-time   | OPRA entitlement             |
| `/v1/options/chain/`       | Real-time   | OPRA entitlement             |
| `/v1/options/expirations/` | Real-time   | Contract metadata            |
| `/v1/options/lookup/`      | Real-time   | Contract metadata            |
| `/v1/markets/status/`      | Real-time   | Calendar metadata            |
| `/v1/funds/*`              | See note    | Pending product confirmation |

### Quant

Same freshness profile as Trader.

| Endpoint                   | Freshness   | Notes                        |
|----------------------------|-------------|------------------------------|
| `/v1/stocks/quotes/`       | 15m delayed |                              |
| `/v1/stocks/candles/`      | 15m delayed |                              |
| `/v1/stocks/bulkcandles/`  | 15m delayed |                              |
| `/v1/stocks/prices/`       | Real-time   |                              |
| `/v1/options/quotes/`      | Real-time   | OPRA entitlement             |
| `/v1/options/chain/`       | Real-time   | OPRA entitlement             |
| `/v1/options/expirations/` | Real-time   | Contract metadata            |
| `/v1/options/lookup/`      | Real-time   | Contract metadata            |
| `/v1/markets/status/`      | Real-time   | Calendar metadata            |
| `/v1/funds/*`              | See note    | Pending product confirmation |

### Prime

Same freshness profile as Trader and Quant.

| Endpoint                   | Freshness   | Notes                        |
|----------------------------|-------------|------------------------------|
| `/v1/stocks/quotes/`       | 15m delayed |                              |
| `/v1/stocks/candles/`      | 15m delayed |                              |
| `/v1/stocks/bulkcandles/`  | 15m delayed |                              |
| `/v1/stocks/prices/`       | Real-time   |                              |
| `/v1/options/quotes/`      | Real-time   | OPRA entitlement             |
| `/v1/options/chain/`       | Real-time   | OPRA entitlement             |
| `/v1/options/expirations/` | Real-time   | Contract metadata            |
| `/v1/options/lookup/`      | Real-time   | Contract metadata            |
| `/v1/markets/status/`      | Real-time   | Calendar metadata            |
| `/v1/funds/*`              | See note    | Pending product confirmation |

## Notes

- **Real-time data and professional status:** Real-time exchange data is only available to non-professional subscribers. Professional subscribers **never** receive Real-time exchange data, no matter which exchange agreements they sign. Signing an agreement does not change this, and no self-service plan changes it. Delayed / historical data access remains available, depending on the data policies of each exchange. Real-time exchange data for professional use requires direct exchange licensing — [contact our sales team](https://www.marketdata.app/contact/) to discuss it. See [Professional Status Policy](/docs/account/data-policies/professional-status/), [Exchange Entitlements](/account/entitlements), and [Professional Status Explained](https://www.marketdata.app/education/stocks/professional-status-explained/).
- **`/v1/funds/*` freshness** is documented per fund-data type and is pending publication here. Until then, refer to the individual endpoint pages under [Funds API](/api/funds/).
- **Stock quotes and candles carry the 15-minute exchange delay.** `/v1/stocks/quotes/`, `/v1/stocks/candles/`, and `/v1/stocks/bulkcandles/` are delayed 15 minutes on every plan under the [UTP entitlement](/account/entitlements#utp-entitlement). The delay comes from the exchange, so `mode=live` does not shorten it — see [Data Mode](/api/universal-parameters/mode).
