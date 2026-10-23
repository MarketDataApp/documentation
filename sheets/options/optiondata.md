---
title: OPTIONDATA
description: The OPTIONDATA formula fetches current or historical option quotes for one contract or a whole range of contracts. See the syntax, samples and limits.
sidebar_position: 1
---

Fetches current or historical option quotes from Market Data, for one option contract or many at once.

## Sample Usage
```excel-formula
=OPTIONDATA("AAPL271217C00250000")
=OPTIONDATA("AAPL271217C00250000", "bid")
=OPTIONDATA("AAPL271217C00250000", "date,bid,ask", "9/1/2022", "1/31/2023")
=OPTIONDATA("AAPL271217C00250000", "all", TODAY()-30, 30)
```
### Multiple Contracts
```excel-formula
=OPTIONDATA(A1:A500)
=OPTIONDATA(A1:A500, "bid,ask,noheaders")
=OPTIONDATA("AAPL271217C00250000,AAPL271217P00250000", "mid")
=OPTIONDATA(A1:A500, "mid", "9/15/2026")
=OPTIONDATA(A1:D50, "symbol,mid")
```
## Syntax
```excel-formula
=OPTIONDATA(option symbol, [attributes], start date, end date)
```

- **option symbol** _(REQUIRED)_ Use the current OCC option symbol format for the option symbol, even for historic options prior to the symbol format change in 2010. Several contracts can be fetched at once: pass a range of cells in a single row or a single column, several OCC symbols separated by commas, or a table of four columns with one contract per row. See [Working With Multiple Contracts](#working-with-multiple-contracts).
- **attribute** _(OPTIONAL "price" by default)_ Use at least one of the following attributes; seperate multiple attributes with commas:
  - "symbol" - The OCC option symbol.
  - "underlying" - The underlying symbol.
  - "expiration" - The option's expiration date.
  - "side" - Call or put.
  - "strike" - The option's strike price.
  - "first traded" - The date this option first began to trade.
  - "dte" - Days to expiration: the calendar days until the option expires, counted from today on a current quote and from the quote date on a historical one.
  - "date", "updated" - The date and time of the quote.
  - "price", "mid", "mark" – The midpoint price of the option.
  - "bid" – The bid price of the option.
  - "ask" – The ask price of the option.
  - "last" – The last price of the option. Depending on the liquidity of the symbol, the last traded price could have occurred one second ago or one day ago.
  - "bid size" – The quantity of contracts offered at the bid price.
  - "ask size" – The quantity of contracts offered at the ask price.
  - "volume" – The number of contracts negotiated during the day.
  - "open interest" – The number of open contracts. Open interest is published once per trading day, before the open, and does not change intraday. On a historical request it is the figure settled out of the previous session, so it lags every other field in the row by one session.
  - "underlying price" – The price of the underlying security at the time of this option quote.
  - "in the money" – Will return TRUE if the option contract was in the money at the time of the quote or FALSE if the contract was not in the money at the time of the quote.
  - "intrinsic value" - The intrinsic value of the option, if any.
  - "extrinsic value" - The extrinsic or time value of the option.
  - "iv", "implied volatility" - The implied volatility of the option.
  - "delta" - The delta of the option.
  - "gamma" - The gamma of the option.
  - "theta" - The theta of the option.
  - "vega" - The vega of the option.
  - "all" – Returns all values.
  - "noheaders" – Returns values without column headers.
- **start date** _(OPTIONAL)_ – The start date when fetching historical data. If start date is specified, but endDate is not, only the single day's data is returned. When fetching more than one contract, only a single date may be used.
- **end date** _(OPTIONAL)_ – The end date when fetching historical data, or the number of calendar days (not trading days) from startDate for which to return data.

## Usage Information

### Data Availability

The `OPTIONDATA` function can return both current option quotes and historical option quotes, depending on whether date parameters are specified. **Data availability restrictions based on user type and exchange entitlements only apply to current quotes.** Historical data is available to all users, with access limits based on your plan.

:::info[What are entitlements?]
Entitlements are permissions granted by exchanges that allow access to their data. To get real-time options data, users need to sign the [OPRA agreement](/account/entitlements). [Learn more about entitlements](/account/entitlements).
:::

#### Current Quotes (No Date Parameters)

When you use `OPTIONDATA` without date parameters, it returns current option quote data. **The data type you receive depends on your user type and OPRA entitlement.** This may include real-time data, 15-minute delayed data, or historical data (1 day old), depending on your entitlements and user classification.

| User Type        | OPRA Entitlement | Data Type              |
|------------------|------------------|------------------------|
| Non-Professional | ✅               | Real-time              |
| Non-Professional | ❌               | 15-min delayed         |
| Professional     | Any              | Historical (1 day old) |
| Unknown          | Any              | Historical (1 day old) |

#### Historical Quotes (With Date Parameters)

When you use `OPTIONDATA` with date parameters, it returns historical option quote data. **Historical data is available to all users regardless of exchange entitlements.** However, the age of historical data you can access depends on your plan:

| Plan                          | Historical Data Availability |
|-------------------------------|------------------------------|
| Free Forever                  | 1 year                       |
| Trial Plans (Starter, Trader) | 1 year                       |
| Starter                       | 5 years                      |
| Trader, Quant, Prime          | No limit (full access)       |

:::info[Plan Limits]
If you attempt to access historical data older than your plan's limit permits, the formula will return an error. [Learn more about plan limits](/account/plan-limits).
:::

### Working With Multiple Contracts

A single `OPTIONDATA` formula can fetch quotes for many option contracts at once. Pass a range of cells, several OCC symbols separated by commas, or a table of contracts as the option symbol.

- One row comes back for each contract, in the same order as your cells, even when the range is a row. Wrap the formula in `TRANSPOSE()` to lay the results out horizontally.
- A contract that cannot be served (not found, expired, or misspelled) keeps its place, so the results stay aligned with your contracts. Its row shows what you entered in the symbol column, with the other columns blank, so you can spot it. Request the `symbol` attribute to see it; without it the row is blank.
- Use a single historical date (start date only). Date ranges are not supported with more than one contract.
- A range must be a single row, a single column, or a table of exactly four columns. Any other table, such as three or five columns, returns an error.
- A row of four cells can describe one contract in parts: underlying, expiration date, strike and side (for example, `AAPL | 12/17/2027 | 250 | call`). On its own, a row like that is read as a single contract, so it also accepts a date range.
- With more than one contract the results include a header row. Add `noheaders` to the attributes to line the results up with your cells.
- For best results use OCC symbols, or a table with dates in `YYYY-MM-DD` format and numeric strikes. Contracts written in words are slower to read, and a long list of them may fill in over a few refreshes.

#### Tables of Contracts

A table of four columns is read as one contract per row, with the underlying, expiration date, strike and side in its columns:

|   | A    | B          | C   | D    |
|---|------|------------|-----|------|
| 1 | AAPL | 2027-12-17 | 250 | call |
| 2 | AAPL | 2027-12-17 | 250 | put  |
| 3 | MSFT | 2027-12-17 | 500 | call |

`=OPTIONDATA(A1:D3, "symbol,mid")` returns a header row and one row for each of the three contracts.

- The columns can be in any order. The first row sets it, and every other row is read the same way.
- Because of that, the first row must be a contract, not a header. A table that starts with a header row returns an error, so start the range on the first contract (for example, `A2:D50`).
- A later row that does not fit the order of the first row (columns swapped, a missing or misspelled cell) fails on its own, without affecting the other rows.

## Notes

- All parameters must be enclosed in quotation marks or be references to cells containing text. A possible exception is when end date is specified as a number of days.
- Results will be returned as a value within a single cell if a single attribute is requested for a single contract. Multiple attributes, multiple contracts or multi-day results will be returned with column headers.
- Dates and times are returned in the same timezone of the exchange.