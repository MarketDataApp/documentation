---
title: Authentication
sidebar_position: 1
---

Troubleshooting authentication issues is crucial for ensuring uninterrupted access to our API services. Most authentication issues are related to header-based authentication, and this guide aims to provide you with steps to resolve common problems. Even though it is more complex to set-up, we encourage all users to take the extra time required to configure header-based authentication for our API, as this is the most secure method of authentication.

### What Typically Goes Wrong

Authentication issues usually arise due to incorrect headers or omission of the authorization header. If you encounter a 401 error, it's usually related to issues with your `Authorization` header.

### Troubleshooting Header-based Authentication

#### Steps for Troubleshooting 401 Errors

1. **Test the Token with URL Parameter Authentication**
   
   ```bash
   curl -X GET "https://api.marketdata.app/v1/stocks/quotes/AADI/?token=YOUR_API_KEY"
   ```

2. **Inspect Request Headers**
   
   ```bash
   curl -X GET "https://httpbin.org/headers" -H "Authorization: Bearer YOUR_API_KEY"
   ```

3. **Log Response Headers and Submit a Helpdesk Ticket**
   
   ```bash
   curl -X GET "https://api.marketdata.app/v1/stocks/quotes/AADI/" -H "Authorization: Bearer YOUR_API_KEY" -i
   ```

:::tip
If the issue persists, include the log data and the Ray ID when you submit a helpdesk ticket. This will help our support team assist you more effectively.
:::

## Opening a Support Ticket

### When to Open a Ticket

Open a ticket if you experience persistent issues or errors that cannot be resolved through this troubleshooting guide.

### What to Include

Include the log data and the Ray ID for faster resolution. By attaching this information to your support ticket, it becomes much easier for our staff to understand and solve your ticket.
