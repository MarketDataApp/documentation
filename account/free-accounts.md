---
title: Free Accounts
sidebar_position: 4
---

Market Data offers two ways for users to use our service for free. We offer the "Free Forever" plan, which allows for 100 API requests per day. We also offer a free 30 day trial (no credit card required) so that users can test our services and determine which plan best meets their needs. Trial accounts work almost exactly the same as paid accounts and have the same [plan limits](/account/plan-limits). There are a few differences, however.

#### Comparison Table
| Feature               | Free Forever | Trial Plans | Paid Plans  |
|-----------------------|--------------|-------------|-------------|
| 24 Hour Delayed Data  | ✅           | ✅           | ❌          |
| 15 Minute Delayed Data | ❌           | ❌           | ✅          |
| Real-Time Data        | ❌           | ❌           | ✅          |
| Standard Endpoints    | ✅           | ✅           | ✅          |
| Premium Endpoints     | ❌           | AAPL Only   | ✅          |
| Historical Data       | 1 Year       | 1 Year      | Full Access |

## 24 Hour Delayed Data

Free Forever and trial accounts only have access to data that is delayed by at least 24 hours. Check the `date` column in the Add-on or the `updated` key in the API's JSON response to get the exact date and time of the quote data you've received.

## Real-Time Data and Free Trials

Free trials of real-time data are not permitted by the exchanges. As a vendor, we are required to pay exchange fees for users who receive real-time exchange data. Because of these mandatory exchange fees, we cannot offer free trials of real-time data. Real-time data is only available with paid subscription plans.

## Standard vs Premium Endpoints

Free and trial plans have access to most standard endpoints that give pricing information. However, our premium endpoints that provide fundamental data (such as earnings data) are only accessible with a paid subscription.

## Historical Data

Free and trial plans cannot access data older than 1 year. We welcome you to use our free trial to test our historical data going back one year. However, if you need older data, a subscription is required.
