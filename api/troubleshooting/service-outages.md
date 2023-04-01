---
title: Service Outages
sidebar_position: 2
---

Market Data, as stated in our [terms of service](https://www.marketdata.app/terms/), makes no representation as to the reliability, availability, or timeliness of our service. This is not just a standard disclaimer. We have not yet been able to achieve 99.9% relability, which is a metric we consider a minimum level to be considered reliable. Some API requests might take longer the 5 seconds to complete or even time out in some cases.

We highly encourage users with need mission critical applications to have a backup provider in place. Market Data is a low cost provider and we have determined that cost, rather than reliability, is our key driver. 

## How To Confirm Downtime

We utilize the service UptimeRobot to independently monitor our real-time and historical APIs and the results of this monitoring is made available to the public at our [status page](https://stats.uptimerobot.com/6Kv3zIow0A).

### Confirm Downtime Programmatically

UptimeRobot offers a [JSON file](https://stats.uptimerobot.com/api/getMonitorList/6Kv3zIow0A) that is updated every 5 minutes with the uptime status of each of our APIs. If you need to monitor the uptime status of our API, we encourage you to use this file.

## What To Do During Downtime

It is not necessary to advise us of downtime or service outages. We monitor the status of our systems and we investigate and respond to all service outages. During Market Data service outages, we encourage you to switch your systems over to your back-up provider until our systems come back online.
