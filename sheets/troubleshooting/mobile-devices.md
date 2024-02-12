---
title: Mobile Devices
sidebar_position: 5
---

Google Workspace Add-ons are not supported on mobile devices yet. This means there is no way to launch the Market Data sidebar on your mobile device. However, if you would like to use our service on your mobile device there are several workarounds you can try. Our custom formulas like [STOCKDATA](/sheets/stocks/stockdata) and [OPTIONDATA](/sheets/options/optiondata) will work on your mobile device.

:::caution
The following recommendations are only for users who want to experiment with Market Data on their mobile device. We do not officially support mobile devices with our add-on.
:::

## Enable Your Sheet For Mobile

There are two steps needed to enable your sheet for mobile device use:

1. Add your token.
2. Disable the sidebar check.

#### Adding Your Token

To use your sheet with a mobile device, you must first open the sheet on a computer and add your token to the sheet. Since there is no way to open the sidebar on a mobile device, this step can only be completed on your computer.

#### Disable the Sidebar Check

The system currently validates that the sidebar has been opened before allowing you to execute Market Data formulas. Disable this in your sheet by using the following command (type it into any cell):

    =DEBUG("disable_sidebar_check")

Please be aware that command will stop the sidebar check when running your custom formulas. If you leave your spreadsheet open for an extended period of time formulas will continue to execute and you may run into [urlfetch errors](/sheets/troubleshooting/urlfetch). If you find yourself running into urlfetch errors, enable the sidebar check again using the following command (type it into any cell):

    =DEBUG("enable_sidebar_check")

## Using Market Data in Mobile

You can continue to use all the Market Data formulas in mobile as you would on a computer. However, to refresh your sheet, since you cannot use the refresh button, there is a workaround:

:::tip
Insert a row above row 1 to refresh all cells in your sheet. After adding the new row, delete it again. This quick sequence of adding and deleting a new row 1 on your sheet will cause all cells in your active sheet to refresh.
:::
