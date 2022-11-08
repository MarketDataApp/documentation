---
title: Multiple Google Accounts Error
sidebar_position: 3
---

Google does not support multi-login with Google Workspace Add-ons. Google's official statement on the issue:

> [Multi-login, or being logged into multiple Google Accounts at once, isn't supported for Apps Script, add-ons, or web apps.](https://developers.google.com/apps-script/guides/projects#fix_issues_with_multiple_google_accounts)

For users who work with multiple Google accounts during the day, such as a work and home account at the same time, this can be a serious problem, since it will cause errors with Add-ons such as Market Data, which need to access your Google account to function properly.

## Error Messages

This error may present itself when you first open the sheet or during your use of the sheet, depending on whether Market Data has been installed in the secondary Google account. The error messages you may see are as follows:

- `ScriptError: Authorization is required to perform that action.`
- `Multiple Google accounts error.`

## Workarounds

Fortunately this is an easy error to fix. There are two confirmed workarounds:

1. Log out of all your Google accounts then log-in to the account that uses Market Data and use it while being signed-in to a single account. 
2. Open a private browsing window (Icognito mode) and open the Google account you use with Market Data in the private window.

### Unconfirmed Workaround

There is also an unconfirmed workaround that some users have reported success with and that will allow you to remain logged-in to multiple Google accounts at once: 

- Set the Google account you use with the Market Data Add-On as your Default Google account.
- The default Google account is simply the account you sign-in first to Google with. You can check this by clicking the profile icon in the upper right corner. 
- If another account is showing up as the Default account, then you are not using Market Data with your default Google account.

To fix this, use the following steps (not guaranteed to work, but reported successful by multiple users):

1. Sign out of all your Google accounts.
2. Sign-in to the Google account you use with Market Data. This is now your default Google account.
3. Sign-in to the rest of your Google accounts.
4. Switch back to the default account.
5. Open Google Sheets and try using Market Data.
6. If Market Data works without errors for you, you can continue to use all your Google accounts with multiple sign-in, just make sure to always sign-in first to the account that uses Market Data.
