---
title: OPTIONCHAIN
sidebar_position: 3
---

Fetches a current option chain from Market Data.

## Sample Usage

    OPTIONCHAIN("AAPL","all","1/17/2025")
    OPTIONCHAIN("AAPL","side,strike,bid,ask,","1/17/2025")
    OPTIONCHAIN("AAPL","all,noheaders","60 DTE","150,160)
    OPTIONCHAIN("AAPL","all","60 DTE","100-200","calls")

## Syntax

    OPTIONCHAIN(underlying symbol, [attributes], expiration date, [strikes], [filters])

- **underlying symbol** _(REQUIRED)_ Use the stock, etf, or underlying index symbol.
- **attributes** _(OPTIONAL "all" by default)_ Use one or more of the following attributes; seperate multiple attributes with commas:
  - "symbol" - The OCC option symbol.
  - "underlying" - The underlying symbol.
  - "expiration" - The option's expiration date.
  - "side" - Call or put.
  - "strike" - The option's strike price.
  - "first traded" - The date this option first began to trade.
  - "date", "updated" - The date and time of the quote.
  - "bid" – The bid price of the option.
  - "bid size" – The quantity of contracts offered at the bid price.
  - "mid", "price", "mark" – The midpoint price of the option.
  - "ask" – The ask price of the option.
  - "ask size" – The quantity of contracts offered at the ask price.
  - "last" – The last price of the option. Depending on the liquidity of the symbol, the last traded price could have occurred one second ago or one day ago.
  - "open interest" – The number of open contracts.
  - "volume" – The number of contracts negotiated during the day.
  - "in the money" – Will return TRUE if the option contract was in the money at the time of the quote or FALSE if the contract was not in the money at the time of the quote.
  - "intrinsic value" - The intrinsic value of the option, if any.
  - "extrinsic value" - The extrinsic or time value of the option.
  - "underlying price" – The price of the underlying security at the time of this option quote.
  - "iv", "implied volatility" - The implied volatility of the option.
  - "delta" - The delta of the option.
  - "gamma" - The gamma of the option.
  - "theta" - The theta of the option.
  - "vega" - The vega of the option.
  - "rho" - The rho of the option.
  - "all" – Returns all values.
  - "noheaders" – Returns values without column headers.
- **expiration date** - _(REQUIRED)_ - The expiration date of the option chain. Options from this expiration will be returned.
  - "date" - A single date in YYYY-MM-DD or MM/DD/YYYY format enclosed between quotes.
  - \[date cell reference] - A cell reference to a date in Sheets.
  - "dte _number_" - Days to expiry. Return the expiration date most closely matching the indicated number. For example, if today was Jan 1 and you used a DTE of 45, the expiration closest to Feb 15 would be selected.
- **strikes** _(OPTIONAL)_ – Limit the strikes returned from the option chain formula to only the specified strikes. 
  - \[number] - A single number or a cell reference to a number. Example: ```150```
  - \[array of numbers] - Use a one column array containing each strike or a cell reference to the array. Example: ```{1;2;3;4}```
  - "string of numbers" - Seperate multiple strikes with commas. Example: ```"150,160,170"```
  - "logical expression" - A logical expression. Example: ```"<200"``` 
- **filters** _(OPTIONAL)_ – Use specific keywords to further filter the option chain.
  - "call", "calls" - Only return calls.
  - "put", "puts" - Only return puts.
  - "itm", "in the money" - Only return in the money options.
  - "otm", "out of the money" - Only return out of the money options.


## Notes

:::info Notes

All parameters must be enclosed in quotation marks or be references to cells containing text.

---

Dates and times are returned in the same timezone of the exchange.

:::
