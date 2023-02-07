---
title: HTTP Status Codes
sidebar_position: 1
---

The Market Data API uses standard HTTP status codes to report most errors. By preparing your application to utilize these status codes, you can often times solve common errors, or retry failed requests.

## Successful Requests (2xx)

Requests that are answered successful.

- `200 OK` - The request was successfuly answered.
- `203 NON-AUTHORITAVE INFORMATION` - The request was successful, but had to be routed to a backup data provider. You can treat this result the same as STATUS 200.

## Client Errors (4xx)

Client errors occur when Market Data cannot respond to a request due to a problem with the request. The request will need to be changed in order to get a different response.

- `400 - BAD REQUEST` - This indicates that the API endpoint is not being used properly. Usually this happens when a parameter cannot be parsed correctly (i.e. sending a string instead of a number or viceversa).
- `401 - UNAUTHORIZED` - The token supplied with the request is missing, invalid, or cannot be used.
- `402 - PAYMENT REQUIRED` - The request you made cannot be made with your current plan. This may occur if you attempt to access historical data with a free plan or very old historical data with a Starter plan.
- `404 - NOT FOUND` - There is no data for the symbol or time period requested. Try a different symbol or a different timeframe.
- `429 - TOO MANY REQUESTS` - Your account has exceeded the daily request limit. New requests will be allowed at 9:30 AM ET (opening bell).

## Server Errors (5xx)

Server errors are used to indicate problems with Market Data's service. They are requests that appear to be properly formed, but can't be responded to due to some kind of problem with our servers. Most of these errors are temporary and resolve themselves on their own. You can retry requests that receive 5xx errors at a later time and they may successful.

- `500 - INTERNAL SERVER ERROR` - This is a generic error message that indicates that an unknown server issue prevents Market Data from responding to your request. This is a usually temporary failure of Market Data's server. If the error continues for more than 24 hours, open a ticket with the helpdesk.
- `502 - BAD GATEWAY` - This error occurs when Market Data's API server does not respond to the gateway. Market Data's API is offline.
- `504 - GATEWAY TIMEOUT` - Market Data's load balancer did not receive a response from the API. This indicates the request is taking too long for the API to resolve. Try the request again in 1-2 minutes and if the error message remains report it to the helpdesk.
- `509 - API ENDPOINT OVERLOADED` - The endpoint is currently overloaded. Please try again in a few minutes. If this problem continues for more than 15 minutes, report it to the helpdesk.
- `521 - API ENDPOINT OFFLINE` - The Market Data API endpoint that should be responding to your formula's request is offline. If this problem continues for more than 15 minutes, report it to the helpdesk.
- `529 - DATABASE OFFLINE` - The database is offline, overloaded, or not responding. Write to support@marketdata.app or submit a ticket in the customer dashboard if this error continues for more than 15 minutes.
- `530 - DATABASE ERROR` - This request produced a database error. Write to support@marketdata.app or submit a ticket in the customer dashboard with the contents of your API request or spreadsheet formula.
- `598 - API GATEWAY OFFLINE` - The gateway server is not responding or unavailable. If this problem continues for more than 15 minutes, report it to the helpdesk.
