---
title: Accounts
sidebar_position: 1
---

The Accounts endpoint allows users to manage their accounts. Depending on the method used (GET, POST, PATCH, DELETE), users can view/search, create, modify, or delete accounts.

## Endpoint

`https://api.marketdata.app/v1/portfolios/accounts`

## Methods

### GET

Retrieve a list of all accounts or filter the output by including one or more parameters.

#### Request Example

    https://api.marketdata.app/v1/portfolios/accounts
    https://api.marketdata.app/v1/portfolios/accounts/?ID=203284
    https://api.marketdata.app/v1/portfolios/accounts/?AccountOwnerID=294

#### Response

- `ID` - Unique identifier for the account
- `Account Owner ID` - ID of the account owner
- `Broker` - Brokerage firm name
- `Account Number` - Number associated with the account
- `Account Title` - Full title of the account
- `Account Alias` - Alias or nickname for the account
- `Account Type` - Type of account (e.g., Margin)
- `Currency` - Currency used in the account (e.g., USD)
- `Status` - Status of the account (e.g., Active)

### Response Example

```json
{
  "s": "ok",
  "ID": "203284",
  "Account Owner ID": "294",
  "Broker": "Interactive Brokers",
  "Account Number": "330382N",
  "Account Title": "John Smith Rollover IRA Interactive Brokers, Custodian",
  "Account Alias": "John's Traditional IRA",
  "Account Type": "Margin",
  "Currency": "USD",
  "Status": "Active"
}
```

### POST

Create a new account.

#### Request

- `ID` - Unique identifier for the account
- `Account Owner ID` - ID of the account owner
- `Broker` - Brokerage firm name
- `Account Number` - Number associated with the account
- `Account Title` - Full title of the account
- `Account Alias` - Alias or nickname for the account
- `Account Type` - Type of account (e.g., Margin)
- `Currency` - Currency used in the account (e.g., USD)
- `Status` - Status of the account (e.g., Active)

### PATCH

Modify an existing account.

#### Request

- `ID` - Unique identifier for the account (required for identification)
- Any other fields you wish to modify (e.g., `Account Alias`, `Status`, etc.)

### DELETE

Remove an account.

#### Request

- `ID` - Unique identifier for the account (required for identification)
