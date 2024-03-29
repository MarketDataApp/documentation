---
title: Free Accounts
sidebar_position: 4
---

Market Data offers two ways for users to use our service for free. We offer the "Free Forever" plan, which allows for 100 API requests per day. We also offer a free 30 day trial (no credit card required) so that users can test our services and determine which plan best meets their needs. Trial accounts work almost exactly the same as paid accounts and have the same [plan limits](/account/plan-limits). There are a few differences, however.

#### Comparison Table
| Feature               | Free Forever | Trial Plans | Paid Plans  |
|-----------------------|--------------|-------------|-------------|
| Delayed Data          | ✅           | ✅           | ❌          |
| Real-Time Data        | ❌           | ❌           | ✅          |
| Standard Endpoints    | ✅           | ✅           | ✅          |
| Premium Endpoints     | ❌           | ❌           | ✅          |
| Historical Data       | 1 Year       | 1 Year      | Full Access |

## Delayed Data

Trial accounts have data that is delayed (usually by at least 15 minutes). We supply data to both Free Forever and free trial accounts on a "best effort" basis, so delays may vary depending on usage. Check the `date` column in the Add-on or the `updated` key in the API's JSON response to get the exact date and time of the data you've received.

## Standard vs Premium Endpoints

Free and trial plans have access to most standard endpoints that give pricing information. However, our premium endpoints that provide fundamental data (such as earnings data) are only accessable with a paid subscription.

## Historical Data

Free and trial plans cannot access data older than 1 year. Feel free to use your trial to test our historical data going back one year. However, if you need older data, a subscription is required.
