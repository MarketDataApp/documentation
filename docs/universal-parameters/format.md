---
title: Format
sidebar_position: 5
---

The format parameter is used to specify the format for your data. We support JSON and CSV formats. The default format is JSON.

## Parameter

    format=<json|csv>

## Use Example

    /candles/daily/AAPL?format=json

    /candles/daily/AAPL?format=csv

## Values

### json (default)

Use JSON to format the data in Javascript Object Notation (JSON) format. This format is ideal for programmatic use of the data.

### csv

Use CSV to format the data in lightweight comma separated value (CSV) format. This format is ideal for importing the data into spreadsheets.
