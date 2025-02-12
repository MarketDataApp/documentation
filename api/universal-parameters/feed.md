---
title: Data Feed tg p
sidebar_position: 9
---

The `feed` parameter allows the user to modify the data feed used for the API's response, forcing it to use cached data.

Our API offers four types of data feeds: `live`, `cached`, `delayed`, and `historical`. These options are designed to meet diverse user needs, balancing between the immediacy of data and cost efficiency. Below is a detailed overview of each feed type, including examples and use-cases to help you choose the best option for your requirements.

:::info Premium Parameter
This parameter can only be used with paid plans. Free plans and trial plans do not have the ability to control their data feed. Free plans will always receive delayed data.
:::

## Live Feed

The `live` feed provides real-time data, delivering the most current market information available. This option is ideal for scenarios requiring the latest data for immediate decision-making.

### Pricing for Live Feed

- Quotes: **1 credit per symbol** included in the response that has quote data (bid/ask/mid/last price).
- Candles: **1 credit per 1,000 candles** included in the response.
- Bulk Candles: **1 credit per symbol*** included in the response.
- Other Endpoints: **1 credit per response**.

### Requesting Live Data

To request real-time data, append `feed=live` to your API call or do nothing at all. If you omit the feed query parameter the live feed is used by default. Here's an example:

```http
GET https://api.marketdata.app/v1/options/chain/SPY/?feed=live
GET https://api.marketdata.app/v1/options/chain/SPY/
```

Both of these requests are equally valid and return the latest data for the specified symbol, ensuring you have up-to-the-second information.

## Cached Feed

The `cached` feed provides data that could be a few seconds to a few minutes old, offering a cost-effective solution for accessing large volumes of quote data. When you use cached data, there is no guarantee of how fresh the data will be. Tickers that are popular with Market Data customers are refreshed more often.

### Pricing for Cached Feed

- Quotes: **1 credit per request**, regardless of the number of symbols. This makes it an economical choice for bulk data retrieval using endpoints like [Option Chain](/api/options/chain) and [Bulk Stock Quotes](/api/stocks/bulkquotes).
- Historical Quotes: Unavailable
- Candles: Unavailable
- Bulk Candles: Unavailable
- Other Endpoints: Unavailable

### Use-Case for Cached Feed

The `cached` feed is perfect for users who need to access recent quote data across multiple symbols without the need for immediate pricing. It allows for significant cost savings, particularly when retrieving data for multiple symbols in a single request.

### Requesting Cached Data

To access the cached data, include `feed=cached` in your API request. For example:

```http
GET https://api.marketdata.app/v1/options/chain/SPY/?feed=cached
```

This query retrieves data from our cache, offering an affordable way to gather extensive data with a single credit.

### Cached Feed Response Codes

When the `feed=cached` parameter is added, the API's response codes are modified slightly. You will no longer get `200 OK` responses, but instead 203 and 204 responses:

- `203 NON-AUTHORITATIVE INFORMATION` - This response indicates the response was successful and served from our cache server. You can treat this the same as a 200 response.
- `204 NO CONTENT` - This response indicates that the request was correct and would ordinarily return a success response, but our caching server does not have any cache data for the symbol requested. Make a live request to fetch real-time data for this symbol.

## Delayed Feed

The `delayed` feed provides data that is delayed by at least 15 minutes. All free and trial accounts receive delayed data by default. Paid accounts can also request delayed data if they wish.

### Pricing for Delayed Feed

- Pricing is the same as the live feed.

### Requesting Delayed Data

To access delayed data, include `feed=delayed` in your API request. For example:

```http
GET https://api.marketdata.app/v1/options/chain/SPY/?feed=delayed
```

This query retrieves data that is at least 15 minutes old, allowing compliance with exchange regulatory requirements.

## Historical Feed

The `historical` feed provides data that is delayed by 1 day. Data becomes historical only after the opening bell of the next session. For example, the closing price on Friday would not be considered historical until the opening bell on Monday.

### Pricing for Historical Feed

- Pricing is the same as the live feed.

### Use-Case for Historical Feed

The `historical` feed is designed for commercial users who are redistributing data to clients. This is useful for compliance with specific exchange redistribution requirements.

### Requesting Historical Data

To access historical data, include `feed=historical` in your API request. For example:

```http
GET https://api.marketdata.app/v1/options/chain/SPY/?feed=historical
```

Historical data can typically be redistributed at no additional cost apart from your Market Data plan. Please note that a commercial plan is required for any redistribution.

## Feed Comparison

| Feature                  | Live Feed                       | Cached Feed                    | Delayed Feed                   | Historical Feed               |
|--------------------------|---------------------------------|--------------------------------|--------------------------------|-------------------------------|
| **Data Timeliness**      | Real-time, up-to-the-second data | Seconds to minutes old | Delayed by 15 minutes     | Delayed by 1 day         |
| **Pricing**              | 1 credit per symbol with quote data | 1 credit per request, regardless of symbol count | Same as live feed              | Same as live feed             |
| **Ideal Use-Case**       | Time-sensitive decisions requiring the latest data | Large volumes of data at lower cost | Compliance with data redistribution regulations | Compliance with data redistribution regulations |
| **Default Option**       | Yes for Paid accounts (if `feed` parameter is omitted) | No (must specify `feed=cached`) | Yes for Free and Trial accounts (cannot change feed) | No (must specify `feed=historical`) |
| **Paid Accounts Access** | ✅ | ✅ | ✅ | ✅ |
| **Free/Trial Accounts Access** | ❌ | ❌ | ✅ | ❌ |

- **Opt for the `live` feed** when you require the most current data for each symbol, and the immediate freshness of the data justifies the additional credits.
- **Select the `cached` feed** for bulk data retrieval or when working with a larger set of symbols, to capitalize on the cost efficiency of retrieving extensive data at a lower price.
- **Choose the `delayed` feed** for scenarios where data timeliness is less critical, but compliance with redistribution regulations is necessary.
- **Use the `historical` feed** for accessing data that is at least one day old, ensuring compliance with specific exchange redistribution requirements.