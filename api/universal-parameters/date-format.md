---
title: Date Format
sidebar_position: 3
---

The dateformat parameter allows you to specify the format you wish to receive date and time information in. Regardless of format, all timestamps for US markets use the **America/New_York** timezone. See [Response Timezone](/docs/api/dates-and-times#response-timezone) for full details on timezone handling.

## Parameter

    dateformat=\<timestamp\|unix\|spreadsheet\>

## Use Example

    /candles/D/AAPL/?dateformat=timestamp

    /candles/D/AAPL/?dateformat=unix

    /candles/D/AAPL/?dateformat=spreadsheet

## Values

### timestamp

Receive dates and times as an ISO 8601 timestamp with timezone offset. All US market data is returned in America/New_York. For example, closing bell on Dec 30, 2020 for the NYSE would be: **2020-12-30 16:00:00 -05:00**.

### unix

Receive dates and times in unix format (seconds after the unix epoch). For example, closing bell on Dec 30, 2020 for the NYSE would be: **1609362000**. Unix timestamps are anchored to America/New_York — see [Response Timezone](/docs/api/dates-and-times#response-timezone) for how to interpret them correctly.

### spreadsheet

Receive dates and times in spreadsheet format (days after the Excel epoch). For example, closing bell on Dec 30, 2020 for the NYSE would be: **44195.66667**. Spreadsheet format does not include a timezone offset. All times are expressed in America/New_York.
