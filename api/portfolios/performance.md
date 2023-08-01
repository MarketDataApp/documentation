---
title: Performance
sidebar_position: 3
---

The Performance endpoint provides detailed performance metrics for any current or past trade based on the transaction history associated with the trade.

## Endpoint

`https://api.marketdata.app/v1/portfolio/performance`

## Methods

### GET

Retrieve the performance data for any current or past trade(s). The performance endpoint can also retrieve bulk performance data for a single user by querying by Account Owner ID. Or by using no parameters whatsoever a bulk download of all trade performance data for the entire account can be made.

#### Request Parameters

- `tradeId` (optional) - The ID of the trade you want to retrieve performance data for.
- `accountOwnerId` (optional) - The ID of the account owner to retrieve bulk performance data for all their trades.

#### Request Example

    https://api.marketdata.app/v1/trades/performance?tradeId=123456789
    https://api.marketdata.app/v1/trades/performance?accountOwnerId=987654321
    https://api.marketdata.app/v1/trades/performance

#### Response

- `Realized P/L`: The realized profit or loss for the trade.
- `Unrealized P/L`: The unrealized profit or loss for the trade.
- `Max Profit`: The maximum profit potential for the trade.
- `Max Loss`: The maximum loss potential for the trade.
- `Breakevens at Expiry`: The breakeven price at the expiry of the trade.
- `Delta`: The rate of change of the position's price with respect to changes in the underlying asset's price.
- `Gamma`: The rate of change of the position's delta with respect to changes in the underlying asset's price.
- `Theta`: The rate of change of the position's price with respect to time.
- `Vega`: The rate of change of the position's price with respect to changes in volatility.
- `Rho`: The rate of change of the position's price with respect to changes in the interest rate.
- `Probability of Profit`: The probability that the trade will be profitable at expiry.

#### Response Example

```json
{
    "Realized P/L": 0,
    "Unrealized P/L": 8,
    "Max Profit": 640,
    "Max Loss": -18969.00,
    "Breakevens at Expiry": 189.69,
    "Delta": 43.2,
    "Gamma": -2.2,
    "Theta": 3.7,
    "Vega": -35.9,
    "Rho": 17.2,
    "Probability of Profit": 0.641
}
```

