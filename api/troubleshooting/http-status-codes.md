---
title: HTTP Status Codes
sidebar_position: 1
---

The Market Data API uses standard HTTP status codes to report most errors. By preparing your application to utilize these status codes, you can often times solve common errors, or retry failed requests.

## Successful Requests (2xx)

Requests that are answered successful.

- `200 OK` - The request was successfuly answered.

## Client Errors (4xx)

Client errors occur when Market Data cannot respond to a request due to a problem with the request. The request will need to be changed in order to get a different response.

- `404 - NOT FOUND` - There is no data for the symbol or time period requested. Try a different symbol or a different timeframe.

## Server Errors (5xx)

Server errors are used to indicate problems with Market Data's service. They are requests that appear to be properly formed, but can't be responded to due to some kind of problem with our servers. Most of these errors are temporary and resolve themselves on their own. You can retry requests that receive 5xx errors at a later time and they may successful.

- `500 - INTERNAL SERVER ERROR` - This is a generic error message that indicates that an unknown server issue prevents Market Data from responding to your request. This is a usually temporary failure of Market Data's server. If the error continues for more than 24 hours, open a ticket with the helpdesk.
- `509 - API ENDPOINT OVERLOADED` - The endpoint is currently overloaded. Please try again in a few minutes. If this problem continues for more than 15 minutes, report it to the helpdesk.
- `521 - API ENDPOINT OFFLINE` - The Market Data API endpoint that should be responding to your formula's request is offline. If this problem continues for more than 15 minutes, report it to the helpdesk.
- `598 - API GATEWAY OFFLINE` - The gateway server is not responding or unavailable. If this problem continues for more than 15 minutes, report it to the helpdesk.

