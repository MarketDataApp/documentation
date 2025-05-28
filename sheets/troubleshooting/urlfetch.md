---
title: Urlfetch Errors
sidebar_position: 2
---

Urlfetch is the service that Google Add-Ons use to fetch data from an external service (such as Market Data). The limit is set by Google on a per account basis. Consumer accounts (gmail) have a limit of 20,000 urlfetch calls per day, while business accounts (Google Workspace) can make up to 100,000 urlfetch calls daily. 

Each time Market Data recalculates the data in a cell, that will consume one call from your urlfetch limit. **Google will recalculate your spreadsheet about once per hour**, so if you use 1000 Market Data formulas in your sheet and leave your spreadsheet open for 8 hours that will consume about 8000 urlfetch calls.

:::caution
Urlfetch calls are different from Market Data requests. Even if you have our Trader plan and can make 100,000 requests per day, if you use a consumer (gmail.com) account, you'll only be able to make 20,000 urlfetch calls with your spreadsheet. Your urlfetch limit is set by Google and cannot be modified by Market Data.
:::

| Feature                  | Consumer Accounts (Gmail) | Google Workspace Accounts |
|--------------------------|---------------------------|---------------------------|
| **Daily Urlfetch Limit** | 20,000 urlfetch calls              | 100,000 urlfetch calls             |
| **Typical Use Case**     | Personal use, small projects | Business use, large projects |
| **Recalculation Impact** | Higher risk of hitting limit with frequent recalculations | Lower risk due to higher limit |
| **Market Data Requests** | Limited by lower urlfetch quota | More flexibility with higher quota |
| **Account Blocking**     | 24-hour block after exceeding limit | 24-hour block after exceeding limit |
| **Strategies Needed**    | More aggressive strategies to reduce usage | Fewer strategies needed due to higher limit |

## Error Messages You May See In The Add-on Due to Urlfetch Issues

Although there is no way to determine how many urlfetch calls can be made by your account, Market Data can detect when the limit has been exceeded and will display an error message. Each of the following error messages indicate that your Google account has exceeded the urlfetch limit:

- `Your Google account has exceeded the urlfetch limit.`
- `The Add-On cannot communicate with Market Data's servers due to your Google account exceeding the daily urlfetch limit.`
- `ScriptError: Exception: Service invoked too many times for one day: urlfetch.`
- `Urlfetch error.`

## Consequences Of Surpassing the Urlfetch Limit

Google will block your account from making new urlfetch requests for 24 hours when you surpass the limit. When you see the urlfetch error message, you must wait a full 24 hours before making another request with the affected Google account.

## Strategies To Reduce Urlfetch Usage

There are a number of strategies you can use to reduce your use of urlfetch calls.

### Copy & Paste Values For Historical Data

When you query Market Data for historical data, such as the price of a stock in the past, consider copying and using the _paste values_ option once the formula finishes its output. This deletes the Market Data formula, but it will preserve the formula's output. 

There are a number of advantages to removing historical formulas and replacing them with the output:
- It will prevent future repeat queries for the same historical data, preserving your urlfetch quota.
- It will also prevent future Market Data requests, preserving your Market Data request quota.
- Your spreadsheet will load more quickly on initial open.
- Your spreadsheet will recalculate more quickly every hour.

If you make a habit of using Copy & Paste Values for your historical outputs, your overall Market Data experience will be significantly improved.

### Use A Single Formula For All Your Real-Time Quotes

Instead of using multiple [`STOCKDATA`](/sheets/stockdata) formulas in your spreadsheet, use a single formula and send all the tickers you need at once. Not only will this use just one urlfetch call, but it will also speed up the loading process of your spreadsheet.

### Refresh Prices Less Often

If you are typically updating your prices every 10 minutes, for example, consider updating every 20 or 30 minutes. You can also make use of the "Current Sheet" refresh to only refresh prices on the current sheet instead of the entire workbook.

### Check For Troublesome Add-ons, Scripts & Macros

Your urlfetch quota is shared between all your Google Workspace Add-ons. If you are using other add-ons that are also making urlfetch calls, you may burn through your quota very quickly. Some add-ons may also cause your spreadsheet to recalculate cells much more frequently than Google's default of once per hour. If you have 1000 Market Data formulas and another add-on is recalculating your sheet once every 3 minutes, you'll hit the urlfetch limit in an hour. 

#### How To Investigate Your Google Account's Add-ons, Scripts & Macros
Use the following links to investigate what other scripts and Add-ons may be running in your Google account:

- [Workspace Add-ons installed in your account](https://workspace.google.com/marketplace/myapps)
- [Scripts authorized to run in your account](https://script.google.com/home/all)
- [Log of scripts which are executing](https://script.google.com/home/executions) 

#### Uninstall Unused Add-ons

Unless you are 100% sure that your other add-ons don't cause excessive recalculation of your spreadsheet and don't make excessive urlfetch calls, consider uninstalling add-ons that are no longer in use.

## Strategies to Increase Your Urlfetch Limit

### Switch From Gmail To Google Workspace

If you are currently using a standard Gmail account and find yourself frequently hitting the urlfetch limit, consider switching to a Google Workspace account. Google Workspace accounts often come with higher quotas for various services, including urlfetch. This upgrade can provide you with the additional capacity you need to continue using Market Data without interruptions.