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

The tables below show the freshness category for every API endpoint, by plan. Real-time stock and options data also requires non-professional status. See [Exchange Entitlements](./entitlements) for the underlying entitlement model.

### Free Forever

All pricing data is Historical (24-hour delayed). Metadata and computed-index endpoints remain Real-time.

| Endpoint | Freshness | Notes |
|----------|-----------|-------|
| `/v1/stocks/quotes/`       | Historical | |
| `/v1/stocks/candles/`      | Historical | |
| `/v1/stocks/bulkcandles/`  | Historical | |
| `/v1/stocks/prices/`       | Historical | |
| `/v1/options/quotes/`      | Historical | |
| `/v1/options/chain/`       | Historical | |
| `/v1/options/strikes/`     | Real-time  | Contract metadata, no pricing |
| `/v1/options/expirations/` | Real-time  | Contract metadata |
| `/v1/options/lookup/`      | Real-time  | Contract metadata |
| `/v1/indices/quotes/`      | Real-time  | Indices are computed continuously |
| `/v1/indices/candles/`     | Real-time  | Indices are computed continuously |
| `/v1/markets/status/`      | Real-time  | Calendar metadata |
| `/v1/funds/*`              | See note   | Pending product confirmation |

### Starter Trial

Same as Free Forever — all pricing data is Historical (24-hour delayed).

| Endpoint | Freshness | Notes |
|----------|-----------|-------|
| `/v1/stocks/quotes/`       | Historical | |
| `/v1/stocks/candles/`      | Historical | |
| `/v1/stocks/bulkcandles/`  | Historical | |
| `/v1/stocks/prices/`       | Historical | |
| `/v1/options/quotes/`      | Historical | |
| `/v1/options/chain/`       | Historical | |
| `/v1/options/strikes/`     | Real-time  | Contract metadata, no pricing |
| `/v1/options/expirations/` | Real-time  | Contract metadata |
| `/v1/options/lookup/`      | Real-time  | Contract metadata |
| `/v1/indices/quotes/`      | Real-time  | Indices are computed continuously |
| `/v1/indices/candles/`     | Real-time  | Indices are computed continuously |
| `/v1/markets/status/`      | Real-time  | Calendar metadata |
| `/v1/funds/*`              | See note   | Pending product confirmation |

### Trader Trial

Same as Starter Trial — all pricing data is Historical (24-hour delayed).

| Endpoint | Freshness | Notes |
|----------|-----------|-------|
| `/v1/stocks/quotes/`       | Historical | |
| `/v1/stocks/candles/`      | Historical | |
| `/v1/stocks/bulkcandles/`  | Historical | |
| `/v1/stocks/prices/`       | Historical | |
| `/v1/options/quotes/`      | Historical | |
| `/v1/options/chain/`       | Historical | |
| `/v1/options/strikes/`     | Real-time  | Contract metadata, no pricing |
| `/v1/options/expirations/` | Real-time  | Contract metadata |
| `/v1/options/lookup/`      | Real-time  | Contract metadata |
| `/v1/indices/quotes/`      | Real-time  | Indices are computed continuously |
| `/v1/indices/candles/`     | Real-time  | Indices are computed continuously |
| `/v1/markets/status/`      | Real-time  | Calendar metadata |
| `/v1/funds/*`              | See note   | Pending product confirmation |

### Starter

Real-time stock data, 15-minute Delayed options data.

| Endpoint | Freshness | Notes |
|----------|-----------|-------|
| `/v1/stocks/quotes/`       | Real-time  | IEX entitlement |
| `/v1/stocks/candles/`      | Real-time  | UTP entitlement may impose 15-min delay on intraday candles — see footnote |
| `/v1/stocks/bulkcandles/`  | Real-time  | Same as `/candles/` |
| `/v1/stocks/prices/`       | Real-time  | |
| `/v1/options/quotes/`      | Delayed    | 15 minutes |
| `/v1/options/chain/`       | Delayed    | 15 minutes |
| `/v1/options/strikes/`     | Real-time  | Contract metadata |
| `/v1/options/expirations/` | Real-time  | Contract metadata |
| `/v1/options/lookup/`      | Real-time  | Contract metadata |
| `/v1/indices/quotes/`      | Real-time  | |
| `/v1/indices/candles/`     | Real-time  | |
| `/v1/markets/status/`      | Real-time  | Calendar metadata |
| `/v1/funds/*`              | See note   | Pending product confirmation |

### Trader

Real-time data for both stocks and options.

| Endpoint | Freshness | Notes |
|----------|-----------|-------|
| `/v1/stocks/quotes/`       | Real-time  | |
| `/v1/stocks/candles/`      | Real-time  | |
| `/v1/stocks/bulkcandles/`  | Real-time  | |
| `/v1/stocks/prices/`       | Real-time  | |
| `/v1/options/quotes/`      | Real-time  | OPRA entitlement |
| `/v1/options/chain/`       | Real-time  | OPRA entitlement |
| `/v1/options/strikes/`     | Real-time  | Contract metadata |
| `/v1/options/expirations/` | Real-time  | Contract metadata |
| `/v1/options/lookup/`      | Real-time  | Contract metadata |
| `/v1/indices/quotes/`      | Real-time  | |
| `/v1/indices/candles/`     | Real-time  | |
| `/v1/markets/status/`      | Real-time  | Calendar metadata |
| `/v1/funds/*`              | See note   | Pending product confirmation |

### Quant

Real-time data for both stocks and options. Same freshness profile as Trader.

| Endpoint | Freshness | Notes |
|----------|-----------|-------|
| `/v1/stocks/quotes/`       | Real-time  | |
| `/v1/stocks/candles/`      | Real-time  | |
| `/v1/stocks/bulkcandles/`  | Real-time  | |
| `/v1/stocks/prices/`       | Real-time  | |
| `/v1/options/quotes/`      | Real-time  | OPRA entitlement |
| `/v1/options/chain/`       | Real-time  | OPRA entitlement |
| `/v1/options/strikes/`     | Real-time  | Contract metadata |
| `/v1/options/expirations/` | Real-time  | Contract metadata |
| `/v1/options/lookup/`      | Real-time  | Contract metadata |
| `/v1/indices/quotes/`      | Real-time  | |
| `/v1/indices/candles/`     | Real-time  | |
| `/v1/markets/status/`      | Real-time  | Calendar metadata |
| `/v1/funds/*`              | See note   | Pending product confirmation |

### Prime

Real-time data for both stocks and options. Same freshness profile as Trader and Quant.

| Endpoint | Freshness | Notes |
|----------|-----------|-------|
| `/v1/stocks/quotes/`       | Real-time  | |
| `/v1/stocks/candles/`      | Real-time  | |
| `/v1/stocks/bulkcandles/`  | Real-time  | |
| `/v1/stocks/prices/`       | Real-time  | |
| `/v1/options/quotes/`      | Real-time  | OPRA entitlement |
| `/v1/options/chain/`       | Real-time  | OPRA entitlement |
| `/v1/options/strikes/`     | Real-time  | Contract metadata |
| `/v1/options/expirations/` | Real-time  | Contract metadata |
| `/v1/options/lookup/`      | Real-time  | Contract metadata |
| `/v1/indices/quotes/`      | Real-time  | |
| `/v1/indices/candles/`     | Real-time  | |
| `/v1/markets/status/`      | Real-time  | Calendar metadata |
| `/v1/funds/*`              | See note   | Pending product confirmation |

## Notes

- **Real-time data and professional status:** Real-time stock and options data is only available to non-professional users. Professional users on any paid plan revert to Delayed data unless they have signed the OPRA professional subscriber agreement. See [Exchange Entitlements](./entitlements) and [Professional Status](https://www.marketdata.app/education/stocks/professional-status-explained/).
- **`/v1/funds/*` freshness** is documented per fund-data type and is pending publication here. Until then, refer to the individual endpoint pages under [Funds API](../api/funds/).
- **UTP entitlement and intraday stock candles:** the [UTP entitlement](./entitlements#utp-entitlement) grants "15-minute delayed intraday stock candles." On plans with Real-time stock quotes (Starter and above), this means intraday candles may carry a 15-minute delay even though quotes do not. Confirm with the [Plan Limits](./plan-limits) page for your plan.
