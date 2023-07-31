---
title: Transactions
sidebar_position: 1
---

The Transactions endpoint allows users to manage transactions. Depending on the method used (GET, POST, PATCH, DELETE), users can view, add, modify, or delete transactions.

## Endpoint

`/v1/portfolios/transactions`

## Methods

### GET

Retrieve a list of all transactions.

#### Response

- `Type`: Transaction type
- `Description`: Transaction description
- `Date`: Transaction date
- `Transaction ID`: Unique identifier for the transaction
- `Qty`: Quantity involved in the transaction
- `Symbol`: Stock or asset symbol
- `Price`: Price per unit of the asset
- `Commissions`: Broker commissions paid, if any
- `Fees`: Additional fees, such as regulatory fees
- `Amount`: Total amount of the transaction

### Response Example

```json
{
  "s": "ok",
  "Type": "Buy",
  "Description": "Bought 200 AAPL @ 200.48",
  "Date": "8/12/2019",
  "TransactionID": 93040779025,
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

- `Type`: Transaction type
- `Description`: Transaction description
- `Date`: Transaction date
- `Transaction ID`: Unique identifier for the transaction
- `Qty`: Quantity involved in the transaction
- `Symbol`: Stock or asset symbol
- `Price`: Price per unit of the asset
- `Commissions`: Commissions paid
- `Fees`: Additional fees
- `Amount`: Total amount of the transaction

### PATCH

Modify an existing transaction.

#### Request

- `Transaction ID`: Unique identifier for the transaction (required for identification)
- Any other fields you wish to modify (e.g., `Qty`, `Price`, etc.)

### DELETE

Remove a transaction.

#### Request

- `Transaction ID`: Unique identifier for the transaction (required for identification)

---
