---
title: Brokerage Connections
sidebar_position: 3
---

:::info

Brokerage connections are not yet implemented, but are coming soon.

:::

Market Data can be connected to your broker or external API data provider for real-time or delayed qoutes, streaming prices, historical data, or to download your trades. When you first establish your broker connection, you will be able to determine what it will be used for.

## Connection Priority

When you connect an external broker or data provider we will automatically route all your requests to your connected broker. Market Data will only attempt to satisfy the request if your broker connection is unable to do so. 

:::tip

Requests satisfied by your connected broker do not count against your daily request limit.

:::

