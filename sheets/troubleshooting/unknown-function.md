---
title: Unknown Function Error
sidebar_position: 7
---

# Troubleshooting the #NAME Error in the Market Data Add-on

When you encounter a #NAME error in your spreadsheet while using the Market Data Google Sheets add-on, it typically indicates that the add-on hasn't been properly initialized or connected to your open spreadsheet. This prevents you from using any of the market data functions like =STOCKDATA(), =OPTIONDATA(), etc.

If you've already activated the add-on in your Google account but still see this error, here are several solutions to resolve the issue:

## Multiple Google Account Sessions

If you're using multiple Google accounts in the same browser, this can sometimes cause authentication issues with Google Sheets add-ons. This is a common scenario when switching between personal and work accounts.

To resolve this:

1. Create separate Chrome profiles for different Google accounts
   - This keeps your work and personal accounts completely separated
   - Ensures proper add-on authentication for each account
   - Log-in to a single Google account per Chrome session
   
2. Alternative solution: Use an incognito window
   - Open Chrome Menu > File > New Incognito Window
   - Sign in to your Google account
   - Access your spreadsheet with the Market Data add-on

## Re-enable the Add-on

If the above solution doesn't work, try re-enabling the add-on specifically for your current spreadsheet:

1. Go to Extensions > Add-ons > Manage add-ons
2. Find the Market Data add-on
3. Unroll the options and uncheck "Use in this document"
4. Reload your spreadsheet
5. Return to the add-ons manager
6. Check "Use in this document" again

## Perform a Clean Installation

If you're still experiencing issues, try a complete reinstallation:

1. Visit https://myaccount.google.com/permissions
2. Remove the Market Data add-on from your permissions list
3. Go to Google Workspace Marketplace
4. Uninstall the Market Data add-on
5. Reinstall the add-on
6. Reload your spreadsheet

## Google Workspace Users

If you're using Google Workspace (formerly G Suite) through your organization, there might be additional considerations:

1. Check Workspace Settings
   - Contact your IT administrator to verify that third-party add-ons are allowed
   - Ensure the Market Data add-on is on your organization's allowed apps list
   - Confirm you have the necessary permissions to install and use add-ons

2. Domain-wide Installation
   - If your organization uses domain-wide installation, the add-on should be installed by your IT administrator
   - Wait for the add-on to propagate across your organization (can take up to 24 hours)
   - Ensure your account is part of the organizational unit where the add-on is deployed

## Additional Troubleshooting Steps

If none of the above solutions work, try these general fixes:

1. Clear your browser cache and cookies
2. Verify your subscription status is active
3. Try accessing the spreadsheet from a different browser
4. Check if the issue persists in a new spreadsheet

## Still Need Help?

If you've tried all the above steps and still encounter issues:

1. Contact our support team via the helpdesk
2. Include the following information:
   - Screenshot of the error
   - Steps you've already tried
   - Whether you're using personal Google account or Google Workspace

Our support team typically responds within a few hours during market hours.
