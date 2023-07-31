---
title: Transactions
sidebar_position: 1
---

The Transactions endpoint allows users to manage transactions. Depending on the method used (GET, POST, PATCH, DELETE), users can view, add, modify, or delete transactions.

## Endpoint

`https://api.marketdata.app/v1/portfolios/transactions`

## Methods

### GET

Retrieve a list of all transactions or filter the output by including one or more parameters.

#### Request Example

    https://api.marketdata.app/v1/portfolios/transactions
    https://api.marketdata.app/v1/portfolios/transactions/?TransactionID=93040779025
    https://api.marketdata.app/v1/portfolios/transactions/?Symbol=AAPL&Account=29490204

#### Response

- `Account` - The account the transaction belongs to
- `Type` - Transaction type
- `Description` - Transaction description
- `Date` - Transaction date
- `TransactionID` - Unique identifier for the transaction
- `Qty` - Quantity involved in the transaction
- `Symbol` - Stock or asset symbol
- `Price` - Average price per unit of the asset.
- `Commissions` - Broker commissions paid, if any.
- `Fees` - Additional fees, such as regulatory fees
- `Amount` - Total amount of the transaction. The number should be negative for transactions that consume the account's cash balance or positive for transactions that add to the account's cash balance.

### Response Example

```json
{
  "s": "ok",
  "Account": "29490204",
  "Type": "Buy",
  "Description": "Bought 200 AAPL @ 200.48",
  "Date": 1565582400,
  "TransactionID": "93040779025",
  "Qty": 200,
  "Symbol": "AAPL",
  "Price": 200.48,
  "Commissions": 6.95,
  "Fees": 0,
  "Amount": -40102.95
}
```

### POST

Add a new transaction.

#### Request

- `Account` - The account the transaction belongs to
- `Type` - Transaction type
- `Description` - Transaction description
- `Date` - Transaction date
- `TransactionID` - Unique identifier for the transaction
- `Qty` - Quantity involved in the transaction
- `Symbol` - Stock or asset symbol
- `Price` - Price per unit of the asset
- `Commissions` - Commissions paid
- `Fees` - Additional fees
- `Amount` - Total amount of the transaction

### PATCH

Modify an existing transaction.

#### Request

- `TransactionID` - Unique identifier for the transaction (required for identification)
- Any other fields you wish to modify (e.g., `Qty`, `Price`, etc.)

### DELETE

Remove a transaction.

#### Request

- `Transaction ID` - Unique identifier for the transaction (required for identification)

---
