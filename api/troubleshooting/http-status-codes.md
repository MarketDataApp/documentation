---
title: HTTP Status Codes
sidebar_position: 2
---

The Market Data API uses standard HTTP status codes to respond to each request. By preparing your application to utilize these status codes, you can often times solve common errors, or retry failed requests.

## Successful Requests (2xx)

These are requests that are answered successfully.

:::caution
Some libraries are not prepared to handle HTTP 203 response codes as successful requests. Ensure the library you are using can accept a 203 response code the same way as a 200 response code.
:::

- `200 OK` - Successfully answered the request.
- `203 NON-AUTHORITATIVE INFORMATION` - Successfully served the request from our caching server. Treat this result the same as STATUS 200.
- `204 NO CONTENT` - Indicates a successful request for explicitly requested cached data, but our cache server lacks cached data for the symbol requested. Resend the request using the live mode.

## Client Errors (4xx)

Client errors occur when Market Data cannot respond to a request due to a problem with the request. The request will need to be modified in order to get a different response.

:::tip
If you believe your request is correct and you received a 4xx reply in error, please ensure you log our complete response to your request, including the full response headers along with the complete JSON error message we deliver in our reply. Open a ticket at our help desk and provide this information to our support staff and we will investigate further.
:::

- `400 BAD REQUEST` - The API endpoint is not being used properly, often due to a parameter that cannot be parsed correctly (e.g., sending a string instead of a number or vice versa). See [URL Parameters](/api/troubleshooting/url-parameters).
- `401 UNAUTHORIZED` - The token supplied with the request is missing, invalid, or cannot be used. See [Authentication](/api/troubleshooting/authentication).
- `402 PAYMENT REQUIRED` - The requested action cannot be performed with your current plan, such as requesting data older than your plan allows, using premium endpoints on Free/Trial, or using `mode=cached` on Free/Trial. See [402: Payment Required](/api/troubleshooting/payment-required).
- `403 FORBIDDEN` - Access denied. Only one device is permitted to access the API at a time. Your IP address has changed, and your account is temporarily blocked for security reasons. Please wait 5 minutes before trying again. See [Multiple IP Addresses](/api/troubleshooting/multiple-ip-addresses).
- `404 NOT FOUND` - No data exists for the requested symbol or time period. Consider trying a different symbol or time frame.
- `413 PAYLOAD TOO LARGE` - The request payload is too large. This is often due to requesting more than 1 year of **intraday** candle data in a single request. Reduce the intraday time window (daily candles can span longer ranges). See [413: Payload Too Large](/api/troubleshooting/payload-too-large).
- `429 TOO MANY REQUESTS` - Credit limit exceeded for your current plan window (daily for Free/Starter/Trader, per-minute for Quant/Prime). See [429: Credit Limit Reached](/api/troubleshooting/running-out-of-credits).
- `429 TOO MANY REQUESTS` - Concurrent request limit reached (more than 50 simultaneous in-flight requests). See [429: Too Many Concurrent Requests](/api/troubleshooting/too-many-concurrent-requests).

## Server Errors (5xx)

Server errors are used to indicate problems with Market Data's service. They are requests that appear to be properly formed, but can't be responded to due to some kind of problem with our servers. 

### Permanent Failures

- `500 INTERNAL SERVER ERROR` - An unknown server issue prevents Market Data from responding to your request. Open a ticket with the helpdesk and include the Ray ID of the request. See [Service Outages](/api/troubleshooting/service-outages).

### Temporary Failures

Most 5xx errors are temporary and resolve themselves on their own. Please retry requests that receive 5xx errors at a later time and they will probably be successful.

- `502 BAD GATEWAY` - Market Data's API server does not respond to the gateway, indicating the API is offline or unreachable. This error is normally sporadic and due to network issues and will typically resolve itself within 1-2 minutes. See [Service Outages](/api/troubleshooting/service-outages).
- `503 SERVICE UNAVAILABLE` - Market Data's API server is accessible but cannot fulfill the request, usually due to server overload. Retry in a few minutes. See [Service Outages](/api/troubleshooting/service-outages).
- `504 GATEWAY TIMEOUT` - Market Data's load balancer received no response from the API, suggesting the request is taking too long to resolve. Retry in 1-2 minutes and report to the helpdesk if the issue persists. See [Service Outages](/api/troubleshooting/service-outages).
- `509 API ENDPOINT OVERLOADED` - The endpoint is currently overloaded. Retry in a few minutes and report to the helpdesk if the issue continues for more than 15 minutes. See [Service Outages](/api/troubleshooting/service-outages).
- `524 A TIMEOUT OCCURRED` - The Market Data API failed to provide an HTTP response before the default 100-second connection timeout, possibly due to server overload or resource struggles. Contact support if this continues for more than 15 minutes. See [Service Outages](/api/troubleshooting/service-outages).
- `529 DATABASE OFFLINE` - The database is offline, overloaded, or not responding. Contact support or submit a ticket if this error persists for more than 15 minutes. See [Service Outages](/api/troubleshooting/service-outages).
- `530 DATABASE ERROR` - The request resulted in a database error. Contact support or submit a ticket with your API request details. See [Service Outages](/api/troubleshooting/service-outages).
- `540 API ENDPOINT OFFLINE` - The Market Data API endpoint expected to respond is offline. Report to the helpdesk if this persists for more than 15 minutes. See [Service Outages](/api/troubleshooting/service-outages).
- `598 API GATEWAY OFFLINE` - The gateway server is not responding or is unavailable. Report to the helpdesk if this issue continues for more than 15 minutes. See [Service Outages](/api/troubleshooting/service-outages).
