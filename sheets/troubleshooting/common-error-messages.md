---
title: Common Error Messages
sidebar_position: 1
---

From time to time you may encounter different error messages while using the Google Sheets Add-On. These messages are almost always due to limitations that Google places on Sheets Add-ons, which have certain limitations that most users are not aware of. By learning about the limitations Google has placed on your use of Add-ons, you will be able to avoid these common errors in the future.

## Errors when Opening Your Sheet

Sometimes you may get an error when you open your spreadsheet. These errors are usually related to Add-on authorization issues.

- `#NAME?` - This error in your formulas indicates the Add-on is not loaded properly in the current sheet. Open the sidebar in Extensions > Market Data > Start to load the Add-on in the current sheet.
- `Error: Unable to start a Market Data session with sidebar closed.` - This error occurs when you first open your sheet for the day. Open the sidebar in Extensions > Market Data > Start. Refresh your data using one of the refresh options provided.
- `ScriptError: Authorization is required to perform that action.` - The Market Data Add-on is not installed correctly in this spreadsheet or in your Google account. This typically occurs when customers are logged into multiple Google accounts at the same time.

## Errors in Market Data Sidebar

The Market Data sidebar can detect service outages and other problems with your Google account. If you begin to have trouble with Market Data, open the sidebar and see if an error message is displayed.

- `Multiple Google accounts error.` - Your browser has multiple Google accounts open at once. Google does not permit multi-login with Sheets Add-ons, such as Market Data. You will need to log out of your other Google accounts or use Google Sheets with a single Google account in a private browsing window.
- `Invalid token.` - The token input is not valid. This error is usually the result of an incorrect token in the token field. Check the token and try again.
- `Market Data is offline.` - Your sheet is cannot reach Market Data's servers. Check our status page to see if there is a service outage. As soon as service is restored this error will resolve.

## Errors in Formulas

Formulas will give errors in their output due to three reasons: 

1. Incorrect user input
2. Problems or issues with Market Data or your Market Data account
3. Limits or throttling placed by Google on your Google account. 

You can see the complete list of error messages for each category below:

### Incorrect User Input

The following errors are usually easily correceted by modifying the input to your formula.

- `No data.` - This actually isn't an error, but it is one of the most common messages. It means Market Data does not have any data for the symbol you input. Try a different symbol or a different timeframe.

- `Invalid symbol.` - The symbol you specified is not included our database of valid symbols and we cannot provide you with any data for this symbol. Check to make sure the symbol is valid.
- `Invalid option symbol.` - Use valid OCC symbology for the option symbol. The option symbol you used is not valid. Learn how to form a correct OCC option symbol and try again.
- `Non-string symbol.` - The ‘Symbol’ parameter must be text surrounded by quotes or a cell reference that contains text. You most likely forgot to add quotes around the symbol you are using or you used an incorrect cell reference. Double check the formula to make sure it is formatted correctly.
- `Invalid attribute.` - You are requesting an attribute that is not valid for the data you are requesting. Usually this happens when requesting a real-time quote attribute for historic data or vice versa.
- `Invalid resolution.` - We cannot generate timeseries data for the resolution you are requsting. Read the documentation to see what resolutions are supported.

### Market Data Account Issues

These issues are related to problems with your specific Market Data account and are usually easily solvable. 

- `Missing token.` - You haven't yet added your token in the Market Data sidebar. The token must be added to each new spreadsheet that you create. Open the side bar in Extensions > Market Data > Start and add your token to the sheet.
- `Unable to start a Market Data session with sidebar closed.` - This error occurs when you first open your sheet for the day. Open the sidebar in Extensions > Market Data > Start and refresh your data using one of the refresh options provided.
- `Your Market Data plan has exceeded its daily limit.` - You have used all your Market Data requests for the day. Your account will be refilled with new requests at opening bell (9:30 AM Eastern Time) tomorrow.

### Market Data Service Issues

These issues relate to general Market Data technical or service issues. The only solution is to check back later or submit a support ticket if the problem does not resolve itself after a few minutes.

- `Internal server error, please try again later.` - This is a usually temporary failure of Market Data's server. If the error continues for more than 24 hours, open a ticket with the helpdesk.
- `API Endpoint Offline.` - The Market Data API endpoint that should be responding to your formula's request is offline. If this problem continues for more than 15 minutes, report it to the helpdesk.
- `API Gateway Offline.` - The gateway server is not responding or unavailable. If this problem continues for more than 15 minutes, report it to the helpdesk.
- `Market Data is offline.` - Market Data servers are offline. The Add-on will not function until our servers are back online. [Check our status page](https://www.marketdata.app/status/) to see details about the service outage.
- `Exceeded maximum execution time (line 0)` - It took more than 30 seconds for Market Data's servers to respond to your request. You can retry using the Refresh Errors option in the sidebar and most times this will work. If the problem is frequent, please submit a ticket to our helpdesk with your formula so we can evaluate why it is taking too long to complete the request.

### Google Account Issues

These issues relate to problems with your Google account. Google places strict limits on the use of Add-ons for free (@gmail.com accounts). If you exceed those limits, an error message will be shown and your account will be throttled.

- `Your Google account has exceeded the minute request limit.` - Your account was throttled by Google for making too many requests. Try refreshing your cells using Market Data's refresh options, which are calibrated to avoid throttling issues.
- [`Your Google account has exceeded the urlfetch limit.`](/sheets/troubleshooting/urlfetch) - You have exceeded Google's urlfetch limit. For 24 hours your account will be blocked from using all Google Workspace Add-ons, including Market Data. Please try again 24 hours from now.
