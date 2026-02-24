---
title: Data Mode
sidebar_position: 1
tags:
  - "API: Premium"
sidebar_custom_props:
  badge: p
---

The `mode` parameter allows you to control **how an API request is fulfilled**, including data freshness guarantees and credit usage. The `mode` parameter determines the response behavior used to fulfill each request.

Our API supports three modes: `live`, `cached`, and `delayed`. These options balance immediacy, availability, and cost efficiency. Below is a detailed overview of each mode, including examples and recommended use-cases.

:::info Premium Parameter
This parameter is available only on paid plans. Free and trial plans cannot change the data mode and will always receive delayed data.
:::

## Live Mode

The `live` mode returns real-time data, providing the most current market information available. This mode is intended for time-sensitive use cases that require up-to-the-second pricing.

### Pricing for Live Mode

- Quotes: **1 credit per symbol** included in the response that has quote data (bid/ask/mid/last).
- Candles: **1 credit per 1,000 candles** included in the response.
- Bulk Candles: **1 credit per symbol*** included in the response.
- Other Endpoints: **1 credit per response**.

### Requesting Live Data

To request real-time data, append `mode=live` to your API call or omit the parameter entirely. If the `mode` parameter is not specified, `live` mode is used by default for paid accounts.

```http
GET https://api.marketdata.app/v1/options/chain/SPY/?mode=live
GET https://api.marketdata.app/v1/options/chain/SPY/
````

Both requests are valid and return the most recent data available for the specified symbol.

## Cached Mode

The `cached` mode returns recently stored data that may be a few seconds to several minutes old. This mode is designed to reduce credit usage when retrieving large amounts of quote data.

Data freshness is not guaranteed. Symbols with higher usage across Market Data customers tend to be refreshed more frequently.

### Pricing for Cached Mode

* Quotes: **1 credit per request**, regardless of the number of symbols.
* Historical Quotes: Unavailable
* Candles: Unavailable
* Bulk Candles: Unavailable
* Other Endpoints: Unavailable

This makes cached mode particularly cost-effective for bulk quote retrieval using endpoints such as [Option Chain](/api/options/chain) and [Bulk Stock Quotes](/api/stocks/bulkquotes).

### Requesting Cached Data

```http
GET https://api.marketdata.app/v1/options/chain/SPY/?mode=cached
```

This request attempts to fulfill the response from Market Data’s cache. If cached data is available, the response is returned at a reduced credit cost.

### Using `maxage` with Cached Mode

The `maxage` parameter can be combined with `mode=cached` to control how old cached data may be before it is considered unusable.

#### How `maxage` Works

* **Purpose**: Sets a maximum acceptable age for cached data
* **Behavior**: If no cached data exists within the specified age window, the API returns an empty response with no credit charge
* **Format**: Accepts absolute datetimes or relative durations (e.g. `1h`, `5min`)

#### Example Scenarios

Assume the most recent cached options chain for AAPL is 3 minutes old.

**Scenario 1: Data within `maxage` limit**

```http
GET https://api.marketdata.app/v1/options/chain/AAPL/?mode=cached&maxage=5min
```

* **Result**: `203` response with data (1 credit charged)
* **Reason**: Cached data is newer than 5 minutes

**Scenario 2: Data exceeds `maxage` limit**

```http
GET https://api.marketdata.app/v1/options/chain/AAPL/?mode=cached&maxage=1min
```

* **Result**: `204` empty response (0 credits charged)
* **Reason**: Cached data exceeds the specified age limit

#### Strategic Usage

Using `maxage` enables efficient fallback logic:

1. First attempt to retrieve cached data with a defined freshness threshold
2. If a `204` response is returned, selectively request live data for required symbols
3. This maximizes cost efficiency while preserving data freshness where it matters

### Cached Mode Response Codes

When `mode=cached` is used, successful responses do not return `200 OK`. Instead:

* `203 NON-AUTHORITATIVE INFORMATION` – Request succeeded and was fulfilled from cache
* `204 NO CONTENT` – No cached data available within constraints; no credits charged

## Delayed Mode

The `delayed` mode returns data delayed by **at least 15 minutes**. This mode is the default for all free and trial accounts. Paid accounts may also request delayed data explicitly.

### Pricing for Delayed Mode

* Pricing is identical to live mode.

### Requesting Delayed Data

```http
GET https://api.marketdata.app/v1/options/chain/SPY/?mode=delayed
```

This request returns market data that is delayed by a minimum of 15 minutes.

## Mode Comparison

| Feature                        | Live Mode                            | Cached Mode                | Delayed Mode                    |
| ------------------------------ | ------------------------------------ | -------------------------- | ------------------------------- |
| **Data Timeliness**            | Real-time                            | Seconds to minutes old     | ≥ 15 minutes delayed            |
| **Pricing**                    | 1 credit per symbol with quote data  | 1 credit per request       | Same as live                    |
| **Ideal Use-Case**             | Time-sensitive decisions             | Bulk quote retrieval       | Non-time-sensitive applications |
| **Default Behavior**           | Paid accounts (if `mode` is omitted) | Must specify `mode=cached` | Free & trial accounts           |
| **Paid Accounts Access**       | ✅                                    | ✅                          | ✅                               |
| **Free/Trial Accounts Access** | ❌                                    | ❌                          | ✅                               |

* Choose **`mode=live`** when immediate data freshness is required.
* Use **`mode=cached`** to reduce credit usage when working with large symbol sets.
* Select **`mode=delayed`** for applications where timing precision is not critical.
