---
title: Single IP Address Policy
sidebar_position: 3
---

Each Market Data account may only access the API from one IP address at a time. This policy is a direct requirement of the exchange agreements under which Market Data distributes market data.

## Why This Policy Exists

The exchanges that license their data to Market Data prohibit unauthorized redistribution. When you sign an [exchange agreement](./exchange-agreements), you agree to use the data solely for your own personal or business purposes and not to share or redistribute it to others.

Allowing a single account to be used from multiple IP addresses simultaneously would make it impossible to enforce this restriction, because it would allow one subscriber to feed data to multiple people or systems at once. The single IP policy is how Market Data enforces the exchange's per-subscriber distribution rules.

## What Is and Is Not Permitted

**Permitted:**
- Switching from one device or IP address to another (e.g., moving from your laptop to a cloud server, or reconnecting after your IP changes)
- Using a VPN, provided requests consistently originate from a single IP at any given time

**Not permitted:**
- Connecting simultaneously from more than one IP address
- Sharing your API token with other users
- Redistributing market data received through your account to any third party

## How the Restriction Is Enforced

Market Data monitors for patterns that indicate simultaneous access from multiple IP addresses. A single IP change is permitted. However, if requests alternate back and forth between two IP addresses within a five-minute window — a pattern consistent with two active devices — your account is temporarily blocked for 5 minutes.

If your account has been blocked, see [403: Multiple IP Addresses](/docs/api/troubleshooting/multiple-ip-addresses/) for resolution steps.

## Commercial Use and Multi-Device Access

The single IP policy applies to all standard subscription plans. If your use case legitimately requires API access from multiple IP addresses simultaneously — for example, distributed systems or serving data to multiple users — this constitutes redistribution and requires a commercial license. Please contact sales to discuss licensing options.

## Violations

Attempting to circumvent this policy by sharing accounts or redistributing data will result in permanent account suspension.
