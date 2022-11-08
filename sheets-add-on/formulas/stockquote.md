---
title: STOCKQUOTE
sidebar_position: 1
---

Fetches a single or multiple stock quotes from Market Data.

:::tip

Group together all your stock quotes and request them all at once with a single ```STOCKQUOTE``` formula to _significantly_ speed up your sheet's loading time.

:::

## Sample Usage

    STOCKQUOTE("AAPL")

    STOCKQUOTE("AAPL", "bid")

    STOCKQUOTE("AAPL,MSFT,GOOG", "all")

    STOCKQUOTE({"AAPL";"MSFT";"GOOG"}, "all")

    STOCKQUOTE(A1:C1, "all")
    
## Syntax

    STOCKQUOTE(symbol, attributes)

- **symbol(s)** _(REQUIRED)_ The stock’s ticker symbol. Seperate multiple symbols with commas or use a single column array or a single column of cell references.

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

:::info

All parameters must be enclosed in quotation marks or be references to cells containing text.

---

Dates and times are returned in the same timezone of the exchange.

:::
