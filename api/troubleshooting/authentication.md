---
title: "401: Authentication"
sidebar_position: 3
---

Authentication issues usually arise due to incorrect headers, omission of the authorization header, or problems with URL parameters. If you encounter a 401 error, it's usually related to issues with your `Authorization` header. The most common issues are:

- Incorrect token
- Invalid characters to separate the query string from the path
- Invalid characters to separate query parameters from each other

Troubleshooting authentication issues is crucial for ensuring uninterrupted access to our API services. Most authentication issues are related to header-based authentication, but URL parameter authentication can also be troublesome to users who are getting started with Market Data as their first REST API. This guide aims to provide you with steps to resolve common problems. 

:::tip
Even though it is more complex to set-up, we encourage all users to take the extra time required to configure header-based authentication for our API, as this is the most secure method of authentication.
:::

### Troubleshooting URL Parameter Authentication

Usually URL parameter authentication goes wrong because customers use **invalid characters to separate the query string from the path**. The correct character to use is `?` and the correct character to use to separate query parameters is `&`. If you use the wrong characters, the API will not be able to parse the query string correctly and will be unable to authenticate your request. Learn more about the correct format of URL parameters [here](/api/troubleshooting/url-parameters).

For example, suppose your token was `token1234` and you were also using the `dateformat` parameter to request a timestamp as the output format for the time. For a stocks/quotes request, the correct URL would be:

```http
https://api.marketdata.app/v1/stocks/quotes/SPY/?token=token1234&dateformat=timestamp
```

- Note how the token is separated from the path by a `?` and the dateformat parameter is separated from the token by a `&`. 

The ordering of the parameters is not important. You do not need to put `token` as the first parameter. It would also be perfectly valid to use the following URL:

```http
https://api.marketdata.app/v1/stocks/quotes/SPY/?dateformat=timestamp&token=token1234
```

No matter the order of the parameters, the API will be able to parse the query string and authenticate your request **as long as the correct characters are used to separate the query string from the path and the query parameters from each other.**

### Troubleshooting Header Authentication

The most common issues customers face with header-based authentication are:

- Omission of the header
- Incorrect header name
- Invalid header format
- Incorrect token

#### Steps for Troubleshooting 401 Errors

1. **Test the Token with URL Parameter Authentication**
   
   ```bash
   curl -X GET "https://api.marketdata.app/v1/stocks/quotes/SPY/?token=YOUR_TOKEN"
   ```

Use CURL to test your token using URL parameter authentication. If it works, you know that your token is valid. If you are using a token that is not valid, you will receive a 401 error. If you are using a token that is valid, you will receive a `200 OK` response along with a stock quote.

2. **Inspect Request Headers**

To inspect the headers your application is sending, especially the `Authorization` header, use our dedicated [headers endpoint](/api/utilities/headers). This will help you identify any discrepancies in the headers that might be causing authentication issues.

```bash
curl -X GET "https://api.marketdata.app/headers/" -H "Authorization: Bearer YOUR_TOKEN"
```

Make a request to https://api.marketdata.app/headers/ from your application and save the headers. This endpoint will return a JSON response of the headers your application is sending, with sensitive headers like `Authorization` partially redacted for security. Compare the headers from your application's request to the expected headers. 

If your application's `Authorization` header is different from what you expect, there may be an issue with how your application is setting headers. If the headers match your expectations, the issue may lie elsewhere, possibly with the token itself.

3. **Log Response Headers and Submit a Helpdesk Ticket**
   
   ```bash
   curl -X GET "https://api.marketdata.app/v1/stocks/quotes/SPY/" -H "Authorization: Bearer YOUR_TOKEN" -i
   ```

Finally, we'll now make a header-authentication request using your token. Make a request using the CURL command above. If you receive a 401 error, the issue is with your token. If you receive a `200 OK` response, the issue is with your application's code. 

:::tip
If the issue persists, include the log data and the Ray ID (listed in the CF-Ray header) when you submit a helpdesk ticket. This will help our support team locate your specific request in our server logs and assist you more effectively.
:::

## Opening a Support Ticket

### When to Open a Ticket

Open a ticket if you experience persistent issues or errors that cannot be resolved through this troubleshooting guide.

### What to Include

Include the log data and the Ray ID for faster resolution. By attaching this information to your support ticket, it becomes much easier for our staff to understand and solve your ticket.
