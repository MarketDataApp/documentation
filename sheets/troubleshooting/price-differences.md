---
title: Price Differences
sidebar_position: 8
---

You may notice that from time to time prices differ when using Market Data compared to Google Finance, TradingView, Yahoo Finance, or other financial websites, especially after hours. This is normal and it to be expected since those platforms display real-time prices using trades (i.e. the last trade or closing price), while Market Data displays real-time prices using quotes.

## Trades vs Quotes

A trade is a transaction that took place between a buyer and a seller in the past. A quote is a bid/ask price from the top of the order book and represents the price a buyer or seller would pay right now if a new transaction were to take place. Trades are indiciatve of the current stock price, but they are a lagging indicator. A quote represents the most current price.

## STOCKDATA vs GOOGLEFINANCE After Hours

When you run `STOCKDATA` after hours you will be shown the midpoint price between the bid and the ask. `GOOGLEFINANCE` after hours will always provide you with the last trade (i.e. the closing price). During the extended session (after hours) trading, the bid and the ask can be much further apart than during the market hours. This means the midpoint price between the bid and the ask could be much further away from the last price than usual. 

To get more detailed information, use the "all" parameter with STOCKDATA like this: `=STOCKDATA("TICKER","ALL")`. This will provide you with a more detailed quote with column names and help you understand where the price is coming from. 

#### Example From 3 AM

![price differences](/img/price-differences.png)

In the example shown, we've requested a price using both STOCKDATA and GOOGLEFINANCE at 3 AM in the early morning for a stock that was thinly traded in the extended session. Note how STOCKDATA shows a price of $128.64 (midpoint between the bid/ask) while GOOGLEFINANCE shows $129.42, the day's closing price. When STOCKDATA is run with the "ALL" parameter we can see the bid/ask and verify how the midpoint price is calculated.

## Force STOCKDATA to Use Trades

If you prefer to see trades instead of quotes for real-time prices, you can modify the STOCKDATA formula slightly and the price shown will be the last trade instead of the most up to date quote. Instead of using `=STOCKDATA("TICKER")`, use instead `=STOCKDATA("TICKER","LAST")`. This will force the formula to use the last price instead of the midpoint price when outputting the result to a single cell.

Please be aware that by using this method, the price shown will be a historical price instead of a price that is likely to result in an order fill. If you are using the formula for trading, the midpoint price is recommended.
