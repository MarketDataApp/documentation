---
title: Human Readable
sidebar_position: 8
---

The human parameter will use human-readable attribute names in the JSON or CSV output instead of the standard camelCase attribute names. Use of this parameter will result in API output that can be loaded directly into a table or viewer and presented to an end-user with no further transformation required on the front-end.

## Parameter

    human=<true|false>

## Use Example

    https://api.marketdata.app/v1/stocks/quotes/AAPL/?human=true

## Response Example

```json
{
  "Symbol":[
    "AAPL"
  ],
  "Ask":[
    152.63
  ],
  "Ask Size":[
    400
  ],
  "Bid":[
    152.61
  ],
  "Bid Size":[
    600
  ],
  "Mid":[
    152.62
  ],
  "Last":[
    152.63
  ],
  "Volume":[
    35021819
  ],
  "Date":[
    1668531422
  ]
}
```

## Values

### True

The API will output human-readable attribute names instead of the standard camelCase attribute names. The output will be capitalized as a title, with the first letter of each major word capitalized. The `s` status response is also surpressed.

### False (default)

Output of attribute names will be according to API specifications using camelCase. If the `human` attribute is omitted, the default behavior is `false`.
