---
title: STOCKQUOTE
sidebar_position: 1
---

Fetches a stock quote(s) from Market Data.

## Sample Usage

    STOCKQUOTE("AAPL")

    STOCKQUOTE("AAPL", "bid")

    STOCKQUOTE("AAPL,MSFT,GOOG", "all")
    
    STOCKQUOTE(A1:D1, "all")

## Syntax

    STOCKQUOTE(symbol, attributes)

- **symbol** _(REQUIRED)_ The stock’s ticker symbol. Seperate multiple symbols with commas or use a single column cell range input.

- **attributes** _(Optional)_ Use one of the following attributes when requesting a quote:
  - "symbol", "ticker" - The symbol for the stock.
  - "price", "mid", "mark" – The midpoint price of the stock.
  - "bid" – The bid price of the stock.
  - "ask" – The ask price of the stock.
  - "bid size" – The quantity of shares offered at the bid price.
  - "ask size" – The quantity of shares offered at the ask price.
  - "last" – The last price of the stock.
  - "volume" – The quantity of shares traded.
  - "date", "updated" - The date and time of the stock quote.
  - "all" – Returns all values.

## Notes

:::tip

Group together all your stock quotes and request them all at once with a single ```STOCKQUOTE``` formula to _significantly_ speed up your sheet's loading time.

---

:::info Notes

All parameters must be enclosed in quotation marks or be references to cells containing text.

---

Dates and times are returned in the same timezone of the exchange.

:::