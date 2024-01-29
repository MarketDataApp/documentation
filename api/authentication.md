---
title: Authentication
sidebar_position: 2
---

The Market Data API uses a token for authentication. The token is required for each request and it can be added to the request's authorization header or supplied or as a parameter in the URL.

:::tip
We recommend using header-based authentication to ensure your token is not stored or cached. While Market Data makes a conscientious effort to delete tokens from our own server logs, we cannot guarantee that your token will not be stored by any of our third party cloud infrastructure partners.
:::

## Header Authentication

Add the token to the ```Authorization``` header using the word ```Token```. For example:

```http
GET /v1/stocks/quotes/AAPL/ HTTP/1.1
Host: api.marketdata.app
Accept: application/json
Authorization: Token {token}
```

## URL Parameter Authentication

Add the token as a variable directly in the URL using the format ```token={token}```. For example:

```
https://api.marketdata.app/v1/stocks/quotes/SPY/?token={token}
```

:::caution
If you associate a brokerage connection with a token, URL Parameter Authentication will be disabled for that token. Only Header Authentication will be allowed.
:::

### Demo The API With No Authentication

You can try stock, option, and index endpoints with several different symbols that are unlocked and do not require a token. 

- Try any stock endpoint with **AAPL**, no token required.
- Try any option endpoint with any AAPL contract, for example: **AAPL250117C00150000**. No token required.
- Try any index endpoint using **VIX**, no token required.
