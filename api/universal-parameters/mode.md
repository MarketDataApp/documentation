---
title: Data Mode
sidebar_position: 1
tags:
  - "API: Premium"
sidebar_custom_props:
  badge: p
---

The `mode` parameter allows you to control **how an API request is fulfilled**, including data freshness guarantees and credit usage. The `mode` parameter determines the response behavior used to fulfill each request.

Our API supports four freshness modes — `live`, `delayed`, `eod`, and `historical` — plus `cached`, which serves recently stored data at a reduced credit cost. These options balance immediacy, availability, and cost efficiency. Below is a detailed overview of each mode, including examples and recommended use-cases.

:::info Premium Parameter
This parameter is available only on paid plans. Free and trial plans cannot change the data mode. They receive historical data — the last fully-closed session — and a request for any fresher mode (`mode=live`, `mode=delayed`, or `mode=eod`) returns [402 Payment Required](/api/troubleshooting/payment-required). See [Data Freshness](/docs/account/data-freshness/) for what each plan receives.
:::

## Live Mode

The `live` mode returns real-time data, providing the most current market information available. This mode is intended for time-sensitive use cases that require up-to-the-second pricing.

:::note
`mode=live` returns the freshest data your entitlements allow. It does not shorten an exchange-imposed delay. See [Data Freshness](/docs/account/data-freshness/) for the freshness of each endpoint.
:::

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

This makes cached mode particularly cost-effective for bulk quote retrieval using endpoints such as [Option Chain](/api/options/chain) and [Bulk Stock Quotes](/api/stocks/quotes).

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

`204` is the deterministic cache-miss signal — it can only be returned by `mode=cached` (or `mode=cache` / `mode=stale`). For the full mapping of status codes across all modes, see [Status Codes](#status-codes) below.

## Delayed Mode

The `delayed` mode returns data delayed by **at least 15 minutes**. It is available on paid plans (Starter and up), which may request delayed data explicitly.

For when delayed data crosses into "historical" (a fully-closed prior session) — and why that happens at different times for stocks (4:15 PM ET) vs options (9:30 AM ET the next trading day) — see [Data Freshness](/docs/account/data-freshness).

### Pricing for Delayed Mode

* Pricing is identical to live mode.

### Requesting Delayed Data

```http
GET https://api.marketdata.app/v1/options/chain/SPY/?mode=delayed
```

This request returns market data that is delayed by a minimum of 15 minutes.

## EOD and Historical Modes

Two further modes return a closed session rather than a delay on the current one.

* `mode=eod` returns the most recent session whose 4:15 PM ET cutoff has passed. Requires a paid plan.
* `mode=historical` returns the most recent fully-closed session — the API waits for the next session to open before it counts a session as closed. This is what free and trial accounts receive, and the only mode they may request explicitly.

### Pricing for EOD and Historical Modes

* Pricing is identical to live mode.

### Requesting EOD or Historical Data

```http
GET https://api.marketdata.app/v1/options/chain/SPY/?mode=eod
GET https://api.marketdata.app/v1/options/chain/SPY/?mode=historical
```

## Mode Comparison

| Feature                        | Live Mode                            | Cached Mode                | Delayed Mode                    | EOD Mode                     | Historical Mode           |
|--------------------------------|--------------------------------------|----------------------------|---------------------------------|------------------------------|---------------------------|
| **Data Timeliness**            | Real-time                            | Seconds to minutes old     | ≥ 15 minutes delayed            | Last session past 4:15 PM ET | Last fully-closed session |
| **Pricing**                    | 1 credit per symbol with quote data  | 1 credit per request       | Same as live                    | Same as live                 | Same as live              |
| **Ideal Use-Case**             | Time-sensitive decisions             | Bulk quote retrieval       | Non-time-sensitive applications | End-of-day reporting         | Backtesting and research  |
| **Default Behavior**           | Paid accounts (if `mode` is omitted) | Must specify `mode=cached` | Must specify `mode=delayed`     | Must specify `mode=eod`      | Free & trial accounts     |
| **Paid Accounts Access**       | ✅                                   | ✅                         | ✅                              | ✅                           | ✅                        |
| **Free/Trial Accounts Access** | ❌                                   | ❌                         | ❌                              | ❌                           | ✅                        |

Free and trial accounts receive historical data on every request. See [Data Freshness](/docs/account/data-freshness/) for the freshness of each endpoint on each plan.

* Choose **`mode=live`** when immediate data freshness is required.
* Use **`mode=cached`** to reduce credit usage when working with large symbol sets.
* Select **`mode=delayed`** for applications where timing precision is not critical.
* Select **`mode=eod`** or **`mode=historical`** when a closed session is what you want.

## Status Codes

Market Data uses HTTP status codes to communicate where a successful response came from. **All three of `200`, `203`, and `204` are success responses — your client must accept all of them.**

| Status                              | Meaning                                                                                                       | When it occurs                                                                                                                                     |
|-------------------------------------|---------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------|
| `200 OK`                            | Response was freshly fetched from the upstream provider.                                                      | Any mode, when no cache layer can satisfy the request.                                                                                             |
| `203 Non-Authoritative Information` | Response was served from a cache layer (Redis, database quote cache, response log, option-chain cache, etc.). | Any mode. Common during market hours regardless of `mode=live`, `mode=delayed`, or no `mode` specified. The body is identical in shape to a `200`. |
| `204 No Content`                    | No cached data is available within the requested constraints. No credits charged.                             | Only when `mode=cached` (also `mode=cache` / `mode=stale`). Never returned by other modes.                                                         |

:::caution Mode does not deterministically map to status code
A common (incorrect) assumption is that `mode=live` always returns `200` and `mode=delayed` always returns `203`. Both can return either `200` or `203` depending on whether a cache layer can satisfy the request at the moment. Only `mode=cached` is deterministic — it returns `203` on cache hit or `204` on cache miss, never `200`.
:::

### Handling `204` (cache miss on `mode=cached`)

When `mode=cached` returns `204`, the typical pattern is to fall back to a live request. A short Python example:

```python
import requests

def get_option_chain(token):
    url = "https://api.marketdata.app/v1/options/chain/AAPL/"
    headers = {"Authorization": f"Bearer {token}"}

    r = requests.get(url, params={"mode": "cached"}, headers=headers)
    if r.status_code in (200, 203):
        return r.json()
    if r.status_code == 204:
        # Cache miss — fall back to live (incurs normal live-mode credit cost)
        r = requests.get(url, params={"mode": "live"}, headers=headers)
        if r.status_code in (200, 203):
            return r.json()
    r.raise_for_status()
```

A few notes on the retry pattern:

- A retry with `mode=live` is billed at the full live-mode credit cost — see [Pricing for Live Mode](#pricing-for-live-mode). The original `204` response is free.
- Cap the retry at one attempt. A subsequent `204` should not occur on `mode=live`, but a circuit breaker is still wise.
- If your plan does not include `mode=cached` access (Free/Trial), `mode=cached` requests return `402 Payment Required` rather than `204`. See [402: Payment Required](/api/troubleshooting/payment-required).

For the full list of HTTP status codes returned by the API (including `4xx` and `5xx`), see [Troubleshooting](/api/troubleshooting).
