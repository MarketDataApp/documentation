---
title: Trades
sidebar_position: 3
---

The Trades endpoint allows users to manage their trades. Depending on the method used (GET, POST, PATCH, DELETE), users can view/search, create, modify, or delete trades. The Trades endpoint requires the user to associate previously created transactions with the trade. A trade may be created with no associated transactions, but it will be an orphan trade and have no activity until transactions are added to it.

## Endpoint

`https://api.marketdata.app/v1/portfolios/trades`

## Methods

### GET

Retrieve a list of all trades or filter the output by including one or more parameters.

#### Request Example

    https://api.marketdata.app/v1/portfolios/trades
    https://api.marketdata.app/v1/portfolios/trades/?ID=203284
    https://api.marketdata.app/v1/portfolios/trades/?AccountOwnerID=294

#### Response

- `ID` - Unique identifier for the trade
- `Account Owner ID` - ID of the account owner
- `Identifier` - Unique identifier for the trade as provided by the user
- `Name` - Name of the trade
- `Description` - Description of the trade
- `Notes` - Notes associated with the trade, including date and note content
- `Transactions` - List of transaction IDs associated with the trade

#### Response Example

```json
{
  "s": "ok",
  "ID": "203284",
  "Account Owner ID": "294",
  "Identifier": "19-AAPL-03",
  "Name": "March AAPL Puts",
  "Description": "I sold puts on AAPL for March for an ongoing Wheel strategy.",
  "Notes": [
    {
      "Date": 1566187200,
      "Note": "Sold puts before earnings to collect some nice premium."
    }
  ],
  "Transactions": ["23040779025", "42945920492"]
}
```

### POST

Create a new trade.

#### Request

- `ID` - Unique identifier for the trade
- `Account Owner ID` - ID of the account owner
- `Identifier` - Unique identifier for the trade as provided by the user
- `Name` - Name of the trade
- `Description` - Description of the trade
- `Notes` - Notes associated with the trade
- `Transactions` - List of transaction IDs to associate with the trade

### PATCH

Modify an existing trade.

#### Request

- `ID` - Unique identifier for the trade (required for identification)
- Any other fields you wish to modify (e.g., `Name`, `Description`, etc.)

### DELETE

Remove a trade.

#### Request

- `ID` - Unique identifier for the trade (required for identification)
