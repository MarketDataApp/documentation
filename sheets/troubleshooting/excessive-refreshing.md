---
title: Excessive Refreshing
sidebar_position: 6
---

Due to Google's strict quota on urlfetch requests, unwanted refreshing of cells can become troublesome. Google will refresh your spreadsheet if any of the following take place:

- Reopening a spreadsheet
- Adding/deleting a row
- Adding/deleting a column
- Sorting a row/column

## Background Formula Refreshing

Google Sheets automatically refreshes all formulas in the background once per hour, even when the spreadsheet is not actively being edited. This background refresh can trigger urlfetch requests for any formulas that use our functions, potentially causing you to hit the quota limit unexpectedly.

**Strategy to Avoid Background Refreshing**: Close the spreadsheet tab when you're not actively working on it. This prevents Google from performing the hourly background refresh of all formulas, which can help you stay within the urlfetch quota limits.

## Add-ons, Scripts & Macros

If you have other add-ons, scripts, or macros that perform any cell or row actions such as those listed above, your sheet may recaculate excessively, causing you to hit the urlfetch quota very quickly. We recommend disabling them.
