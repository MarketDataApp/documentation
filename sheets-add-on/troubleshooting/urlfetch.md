---
title: Urlfetch Errors
sidebar_position: 2
---

Urlfetch is the service that Google Add-Ons use to fetch data from an external service (such as Market Data). Consumer (gmail.com) accounts have a limit of 20,000 urlfetch calls per day, while business accounts (Google Workspace) can make up to 100,000 urlfetch calls daily. 

Each time Market Data recalculates the data in a cell, that will consume one call from your urlfetch limit. Google will recalculate your spreadsheet about once per hour, so if you use 1000 Market Data formulas in your sheet and leave your spreadsheet open for 8 hours that will consume about 8000 urlfetch calls.

:::caution

Urlfetch calls are different from Market Data requests. Even if you have our Trader plan and can make 50,000 requests per day, if you use a consumer (gmail.com) account, you'll only be able to make 20,000 urlfetch calls with your spreadsheet. Your urlfetch limit is set by Google and cannot be modified by Market Data.

:::

## Error Messages You May See In The Add-on Due to Urlfetch Issues

- `Your Google account has exceeded the urlfetch limit.`
- `ScriptError: Exception: Service invoked too many times for one day: urlfetch`
- `Urlfetch error.`

Each of these error messages indicate that your Google account has exceeded the urlfetch limit.

## Consequences Of Surpassing the Urlfetch Limit

Google will block your account from making new urlfetch requests for 24 hours when you surpass the limit. So when you see the urlfetch error, you must wait a full 24 hours before making another request with the affected Google account.

During this time, you may continue to use Market Data via the API or our Sheets Add-on in another Google account. The block is placed only on the Google account which exceeded the limit. Your use of Market Data with other Google accounts will not be affected. If you have a secondary Google account, you can continue to use the Sheets Add-on with that account.

## Strategies To Reduce Urlfetch Usage

There are a number of stratgies you can use to reduce your use of urlfetch calls.
