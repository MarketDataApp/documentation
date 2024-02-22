---
title: Date Format
sidebar_position: 3
---

The dateformat parameter allows you specify the format you wish to receive date and time information in.

## Parameter

    dateformat=\<timestamp\|unix\|spreadsheet\>

## Use Example

    /candles/daily/AAPL?dateformat=timestamp

    /candles/daily/AAPL?dateformat=unix

    /candles/daily/AAPL?dateformat=spreadsheet

## Values

### timestamp

Receive dates and times as a timestamp. Market Data will return time stamped data in the timezone of the exchange. For example, closing bell on Dec 30, 2020 for the NYSE would be: **2020-12-30 16:00:00 -05:00**.

### unix

Receive dates and times in unix format (seconds after the unix epoch). Market Data will return unix date and time data. For example, closing bell on Dec 30, 2020 for the NYSE would be: **1609362000**.

### spreadsheet

Receive dates and times in spreadsheet format (days after the Excel epoch). For example, closing bell on Dec 30, 2020 for the NYSE would be: **44195.66667**. Spreadsheet format does not support time zones. All times will be returned in the local timezone of the exchange.
