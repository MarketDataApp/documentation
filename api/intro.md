---
title: Introduction
sidebar_position: 1
slug: /
---

The Market Data API is designed around REST and supports standard HTTP response codes and methods. All responses are delivered via JSON for programmatic use of the information or via CSV files to load into your preferred spreadsheet application.

:::info Root Endpoint
https://api.marketdata.app/
:::

## Try Our API

The easiest way to try out our API is using our [Swagger User Interface](https://api.marketdata.app/), which will allow you to try out your API requests directly from your browser.

:::tip
Our endpoints have **lots of optional parameters** to allow users to sort and filter responses. It can be overwhelming to new users at first. When you're first getting started testing our API in Swagger, scroll to the required parameters and ignore all the optional ones. Most endpoints require only a ticker symbol as a required parameter.
:::

#### Get Started Quick — No Registration Required!

You can try stock, option, and index endpoints with several different symbols that are unlocked and require no authorization token. 

- Try any stock endpoint with **AAPL**, no registration required.
- Try any option endpoint with any AAPL contract, for example: **AAPL250117C00150000**. No registration required.
- Try any index endpoint using **VIX**, no registration required.

Once you would like to experiment with other symbols, [register a free account](https://www.marketdata.app/signup/) (no credit card required) and you will get 100 free requests per day. Make the decision to pay only after making a complete trial of our API.
